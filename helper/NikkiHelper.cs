// Nikki's Windows helper: long-running, talks JSON lines over stdio.
// stdout: {"type":"ready"} | {"type":"media",...} | {"type":"volume","level":0-100,"muted":bool} | {"type":"error","message":...}
//         | {"type":"spectrum","bands":[12 numbers 0-1]} (~30/s while something sounds, see Spectrum)
// stdin:  toggle | play | pause | next | prev | seek <seconds> | volume <0-100> | mute | unmute | spectrum on | spectrum off
// NikkiHelper.exe --spectrum-test: checks the analysis on a test tone and silence, exit code 0 when it is right
// Built with the C# 5 compiler that ships with Windows (see build.cmd): no C# 6+ syntax, and WinRT
// async calls are waited on directly because .NET Framework's await bridge does not bind to the system .winmd files.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using Windows.Foundation;
using Windows.Media.Control;
using Windows.Storage.Streams;

class NikkiHelper
{
    static GlobalSystemMediaTransportControlsSessionManager manager;
    static readonly object outLock = new object();
    static readonly object mediaLock = new object();
    static readonly Dictionary<string, string> lastSent = new Dictionary<string, string>();
    static readonly string coverDir = Path.Combine(Path.GetTempPath(), "nikki-covers");

    static void Main(string[] args)
    {
        Console.OutputEncoding = new UTF8Encoding(false);
        Console.InputEncoding = new UTF8Encoding(false);
        if (args.Length > 0 && args[0] == "--spectrum-test") Environment.Exit(Spectrum.SelfTest() ? 0 : 1);
        try { Run(args); }
        catch (Exception e)
        {
            Error(e);
            Environment.Exit(1);
        }
    }

    static void Run(string[] args)
    {
        manager = Wait(GlobalSystemMediaTransportControlsSessionManager.RequestAsync());
        Directory.CreateDirectory(coverDir);
        Emit("{\"type\":\"ready\"}");
        Report();
        ReportVolume();
        if (args.Length > 0 && args[0] == "--once") return;

        // Session and volume events are unreliable across players and devices, so poll; Send only writes on change.
        var poll = new Thread(() =>
        {
            while (true)
            {
                Thread.Sleep(1000);
                try { Report(); } catch (Exception e) { Error(e); }
                try { ReportVolume(); } catch (Exception e) { Error(e); }
            }
        });
        poll.IsBackground = true;
        poll.Start();

        string line;
        while ((line = Console.ReadLine()) != null)
        {
            try { Command(line.Trim()); } catch (Exception e) { Error(e); }
        }
    }

    static T Wait<T>(IAsyncOperation<T> op)
    {
        while (op.Status == AsyncStatus.Started) Thread.Sleep(5);
        if (op.Status == AsyncStatus.Error) throw op.ErrorCode;
        if (op.Status == AsyncStatus.Canceled) throw new OperationCanceledException();
        return op.GetResults();
    }

    static void Command(string line)
    {
        if (line == "spectrum on" || line == "spectrum off")
        {
            Spectrum.Set(line == "spectrum on");
            return;
        }
        if (line.StartsWith("volume "))
        {
            int level;
            if (int.TryParse(line.Substring(7), out level)) Volume.SetLevel(Math.Max(0, Math.Min(100, level)) / 100f);
            ReportVolume();
            return;
        }
        if (line == "mute" || line == "unmute")
        {
            Volume.SetMute(line == "mute");
            ReportVolume();
            return;
        }
        var s = manager.GetCurrentSession();
        if (s == null || line.Length == 0) return;
        if (line == "toggle") Wait(s.TryTogglePlayPauseAsync());
        else if (line == "play") Wait(s.TryPlayAsync());
        else if (line == "pause") Wait(s.TryPauseAsync());
        else if (line == "next") Wait(s.TrySkipNextAsync());
        else if (line == "prev") Wait(s.TrySkipPreviousAsync());
        else if (line.StartsWith("seek "))
        {
            double sec;
            if (double.TryParse(line.Substring(5), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out sec))
                Wait(s.TryChangePlaybackPositionAsync((long)(sec * 10000000)));
        }
        Report();
    }

    static void Report()
    {
        lock (mediaLock)
        {
            var s = manager.GetCurrentSession();
            if (s == null)
            {
                Send("{\"type\":\"media\",\"active\":false}");
                return;
            }
            var props = Wait(s.TryGetMediaPropertiesAsync());
            var info = s.GetPlaybackInfo();
            var tl = s.GetTimelineProperties();
            string title = props != null ? props.Title : "";
            string artist = props != null ? props.Artist : "";
            string cover = "";
            if (props != null && props.Thumbnail != null)
            {
                try { cover = SaveCover(props.Thumbnail, title + "|" + artist); } catch (Exception e) { Error(e); }
            }

            var sb = new StringBuilder();
            sb.Append("{\"type\":\"media\",\"active\":true");
            sb.Append(",\"app\":").Append(Q(s.SourceAppUserModelId));
            sb.Append(",\"title\":").Append(Q(title));
            sb.Append(",\"artist\":").Append(Q(artist));
            sb.Append(",\"album\":").Append(Q(props != null ? props.AlbumTitle : ""));
            sb.Append(",\"status\":").Append(Q(info.PlaybackStatus.ToString().ToLowerInvariant()));
            sb.Append(",\"position\":").Append(Num(tl.Position.TotalSeconds));
            sb.Append(",\"duration\":").Append(Num((tl.EndTime - tl.StartTime).TotalSeconds));
            // Position is a snapshot from LastUpdatedTime; the UI extrapolates while playing.
            sb.Append(",\"updatedAt\":").Append(tl.LastUpdatedTime.ToUnixTimeMilliseconds());
            sb.Append(",\"cover\":").Append(Q(cover));
            sb.Append("}");
            Send(sb.ToString());
        }
    }

    static void ReportVolume()
    {
        float level;
        bool muted;
        if (!Volume.Get(out level, out muted)) return;
        Send("{\"type\":\"volume\",\"level\":" + (int)Math.Round(level * 100) + ",\"muted\":" + (muted ? "true" : "false") + "}");
    }

    static string SaveCover(IRandomAccessStreamReference thumb, string key)
    {
        string name;
        using (var sha = SHA1.Create())
            name = BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(key))).Replace("-", "").Substring(0, 16) + ".img";
        string file = Path.Combine(coverDir, name);
        if (File.Exists(file)) return file;
        var stream = Wait(thumb.OpenReadAsync());
        try
        {
            uint size = (uint)stream.Size;
            var reader = new DataReader(stream);
            Wait(reader.LoadAsync(size));
            var bytes = new byte[size];
            reader.ReadBytes(bytes);
            File.WriteAllBytes(file, bytes);
        }
        finally { stream.Dispose(); }
        return file;
    }

    internal static void Error(Exception e)
    {
        Emit("{\"type\":\"error\",\"message\":" + Q(e.Message) + "}");
    }

    static void Send(string json)
    {
        // Dedupe per message type ("media", "volume"): the type is the first field.
        string type = json.Substring(0, Math.Min(json.Length, 18));
        lock (outLock)
        {
            string prev;
            if (lastSent.TryGetValue(type, out prev) && prev == json) return;
            lastSent[type] = json;
        }
        Emit(json);
    }

    internal static void Emit(string json)
    {
        lock (outLock)
        {
            Console.Out.WriteLine(json);
            Console.Out.Flush();
        }
    }

    static string Num(double d)
    {
        return Math.Round(d, 2).ToString(System.Globalization.CultureInfo.InvariantCulture);
    }

    static string Q(string s)
    {
        if (s == null) return "\"\"";
        var sb = new StringBuilder("\"");
        foreach (char c in s)
        {
            if (c == '"') sb.Append("\\\"");
            else if (c == '\\') sb.Append("\\\\");
            else if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4"));
            else sb.Append(c);
        }
        return sb.Append('"').ToString();
    }
}

// Master volume of the default playback device via Core Audio (IAudioEndpointVolume).
static class Volume
{
    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    class MMDeviceEnumerator { }

    [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IMMDeviceEnumerator
    {
        [PreserveSig] int EnumAudioEndpoints(int dataFlow, int stateMask, out IntPtr devices);
        [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice device);
    }

    [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IMMDevice
    {
        [PreserveSig] int Activate(ref Guid iid, int clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object iface);
        [PreserveSig] int OpenPropertyStore(int access, out IntPtr store);
        [PreserveSig] int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
    }

    [ComImport, Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioEndpointVolume
    {
        [PreserveSig] int RegisterControlChangeNotify(IntPtr notify);
        [PreserveSig] int UnregisterControlChangeNotify(IntPtr notify);
        [PreserveSig] int GetChannelCount(out uint count);
        [PreserveSig] int SetMasterVolumeLevel(float levelDb, ref Guid context);
        [PreserveSig] int SetMasterVolumeLevelScalar(float level, ref Guid context);
        [PreserveSig] int GetMasterVolumeLevel(out float levelDb);
        [PreserveSig] int GetMasterVolumeLevelScalar(out float level);
        [PreserveSig] int SetChannelVolumeLevel(uint channel, float levelDb, ref Guid context);
        [PreserveSig] int SetChannelVolumeLevelScalar(uint channel, float level, ref Guid context);
        [PreserveSig] int GetChannelVolumeLevel(uint channel, out float levelDb);
        [PreserveSig] int GetChannelVolumeLevelScalar(uint channel, out float level);
        [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, ref Guid context);
        [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)] out bool mute);
    }

    // The default device can change (headphones), so it is looked up on every call.
    internal static IMMDevice DefaultDevice()
    {
        var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumerator();
        IMMDevice device;
        return enumerator.GetDefaultAudioEndpoint(0 /* eRender */, 1 /* eMultimedia */, out device) == 0 ? device : null;
    }

    internal static string DefaultDeviceId()
    {
        var device = DefaultDevice();
        string id;
        return device != null && device.GetId(out id) == 0 ? id : null;
    }

    static IAudioEndpointVolume Endpoint()
    {
        var device = DefaultDevice();
        if (device == null) return null;
        Guid iid = typeof(IAudioEndpointVolume).GUID;
        object iface;
        if (device.Activate(ref iid, 23 /* CLSCTX_ALL */, IntPtr.Zero, out iface) != 0) return null;
        return iface as IAudioEndpointVolume;
    }

    public static bool Get(out float level, out bool muted)
    {
        level = 0; muted = false;
        var ep = Endpoint();
        return ep != null && ep.GetMasterVolumeLevelScalar(out level) == 0 && ep.GetMute(out muted) == 0;
    }

    public static void SetLevel(float level)
    {
        var ep = Endpoint();
        Guid ctx = Guid.Empty;
        if (ep != null) ep.SetMasterVolumeLevelScalar(level, ref ctx);
    }

    public static void SetMute(bool mute)
    {
        var ep = Endpoint();
        Guid ctx = Guid.Empty;
        if (ep != null) ep.SetMute(mute, ref ctx);
    }
}

// Spectrum of what the default playback device plays, for the glow under the closed notch: WASAPI loopback in shared mode,
// only between "spectrum on" and "spectrum off". 1024-point FFT with a Hann window, 12 log bands 40 Hz-12 kHz, 0-1 against a peak
// that follows the loudest band at once and falls 3 dB a second (quiet and loud music both fill the bars), fast up, slow down.
// ~30 lines a second while something sounds; after half a second of quiet one line of zeros, then nothing.
// A new default device (headphones) starts the capture over; an error is said once, then it tries again later and the rest runs on.
static class Spectrum
{
    const int N = 1024, Bands = 12, FrameMs = 33, QuietMs = 500;
    const double MinHz = 40, MaxHz = 12000, RangeDb = 36, FloorDb = -60, FallDb = 0.1, Still = 0.0005;
    static readonly object gate = new object();
    static bool want;
    static Thread thread;
    static string said; // the last error, said once

    static readonly double[] hann = new double[N], re = new double[N], im = new double[N], level = new double[Bands], shown = new double[Bands];
    static readonly int[] lo = new int[Bands], hi = new int[Bands];
    static double peak;

    [ComImport, Guid("1CB9AD4C-DBFA-4C32-B178-C2F568A703B2"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioClient
    {
        void Initialize(int shareMode, int streamFlags, long bufferDuration, long periodicity, IntPtr format, IntPtr sessionGuid);
        void GetBufferSize(out uint frames);
        void GetStreamLatency(out long latency);
        void GetCurrentPadding(out uint frames);
        [PreserveSig] int IsFormatSupported(int shareMode, IntPtr format, out IntPtr closest);
        void GetMixFormat(out IntPtr format);
        void GetDevicePeriod(out long defaultPeriod, out long minimumPeriod);
        void Start();
        void Stop();
        void Reset();
        void SetEventHandle(IntPtr handle);
        void GetService(ref Guid iid, [MarshalAs(UnmanagedType.IUnknown)] out object service);
    }

    [ComImport, Guid("C8ADBD64-E71E-48A0-A4DE-185C395CD317"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioCaptureClient
    {
        void GetBuffer(out IntPtr data, out uint frames, out uint flags, out ulong devicePosition, out ulong qpcPosition);
        void ReleaseBuffer(uint frames);
        void GetNextPacketSize(out uint frames);
    }

    public static void Set(bool on)
    {
        lock (gate)
        {
            want = on;
            if (on && thread == null)
            {
                thread = new Thread(Loop);
                thread.IsBackground = true;
                thread.Start();
            }
            Monitor.PulseAll(gate);
        }
    }

    static bool Wanted()
    {
        lock (gate) return want;
    }

    static void Loop()
    {
        int delay = 1000;
        while (true)
        {
            lock (gate) while (!want) Monitor.Wait(gate);
            try
            {
                Capture();
                delay = 1000;
            }
            catch (Exception e)
            {
                if (e.Message != said) NikkiHelper.Error(e);
                said = e.Message;
                Thread.Sleep(delay);
                delay = Math.Min(delay * 2, 30000);
            }
        }
    }

    static void Capture()
    {
        var device = Volume.DefaultDevice();
        if (device == null) throw new InvalidOperationException("Kein Wiedergabegerät für das Spektrum");
        string id;
        device.GetId(out id);
        Guid iid = typeof(IAudioClient).GUID;
        object o;
        Marshal.ThrowExceptionForHR(device.Activate(ref iid, 23 /* CLSCTX_ALL */, IntPtr.Zero, out o));
        var client = (IAudioClient)o;
        IAudioCaptureClient capture = null;
        bool sounding = false;
        try
        {
            IntPtr fmt;
            client.GetMixFormat(out fmt);
            int channels, rate, block, bytes;
            bool isFloat;
            try
            {
                ReadFormat(fmt, out channels, out rate, out block, out bytes, out isFloat);
                client.Initialize(0 /* shared */, 0x00020000 /* AUDCLNT_STREAMFLAGS_LOOPBACK */, 1000000 /* 100 ms */, 0, fmt, IntPtr.Zero);
            }
            finally { Marshal.FreeCoTaskMem(fmt); }
            Guid cid = typeof(IAudioCaptureClient).GUID;
            object c;
            client.GetService(ref cid, out c);
            capture = (IAudioCaptureClient)c;
            Prepare(rate);
            var ring = new float[N]; // the last N samples, mono; the oldest at pos
            int pos = 0, fresh = 0;
            var buf = new byte[0];
            var clock = Stopwatch.StartNew();
            long nextFrame = 0, nextCheck = 1000, lastLoud = -QuietMs;
            client.Start();
            said = null;
            while (Wanted())
            {
                uint packet;
                capture.GetNextPacketSize(out packet);
                while (packet > 0)
                {
                    IntPtr data;
                    uint frames, flags;
                    ulong devicePosition, qpcPosition;
                    capture.GetBuffer(out data, out frames, out flags, out devicePosition, out qpcPosition);
                    int size = (int)frames * block;
                    bool silent = (flags & 2 /* AUDCLNT_BUFFERFLAGS_SILENT */) != 0;
                    if (buf.Length < size) buf = new byte[size];
                    if (!silent) Marshal.Copy(data, buf, 0, size);
                    for (int f = 0; f < frames; f++)
                    {
                        float sum = 0;
                        if (!silent) for (int ch = 0; ch < channels; ch++) sum += Sample(buf, f * block + ch * bytes, bytes, isFloat);
                        ring[pos] = sum / channels;
                        pos = (pos + 1) % N;
                    }
                    fresh += (int)frames;
                    capture.ReleaseBuffer(frames);
                    capture.GetNextPacketSize(out packet);
                }
                long now = clock.ElapsedMilliseconds;
                if (now >= nextFrame)
                {
                    nextFrame = now + FrameMs;
                    // nothing plays: Windows sends no packets at all, which counts as quiet too
                    bool loud = fresh > 0 && Analyze(ring, pos);
                    fresh = 0;
                    if (loud) lastLoud = now;
                    if (now - lastLoud < QuietMs)
                    {
                        Step(loud);
                        Send(shown);
                        sounding = true;
                    }
                    else if (sounding)
                    {
                        Array.Clear(shown, 0, Bands);
                        Send(shown);
                        sounding = false;
                    }
                }
                if (now >= nextCheck)
                {
                    nextCheck = now + 1000;
                    if (Volume.DefaultDeviceId() != id) return; // headphones in or out: start over on the new device
                }
                Thread.Sleep(10);
            }
        }
        finally
        {
            try { client.Stop(); } catch { }
            if (sounding) Send(new double[Bands]); // switched off or a new device: the bars go back
            if (capture != null) Marshal.ReleaseComObject(capture);
            Marshal.ReleaseComObject(client);
            Marshal.ReleaseComObject(device);
        }
    }

    // The mix format is 32-bit float nearly always; 16/24/32-bit PCM and 64-bit float are read too, anything else is not.
    static void ReadFormat(IntPtr f, out int channels, out int rate, out int block, out int bytes, out bool isFloat)
    {
        int tag = (ushort)Marshal.ReadInt16(f, 0);
        channels = Marshal.ReadInt16(f, 2);
        rate = Marshal.ReadInt32(f, 4);
        block = Marshal.ReadInt16(f, 12);
        int bits = Marshal.ReadInt16(f, 14);
        if (tag == 0xFFFE) tag = Marshal.ReadInt16(f, 24); // WAVE_FORMAT_EXTENSIBLE: its SubFormat GUID starts with the real tag
        isFloat = tag == 3;
        bytes = bits / 8;
        bool ok = channels > 0 && rate > 0 && block == channels * bytes && (isFloat ? bytes == 4 || bytes == 8 : tag == 1 && bytes >= 2 && bytes <= 4);
        if (!ok) throw new NotSupportedException("Audioformat " + tag + "/" + bits + " Bit kann das Spektrum nicht lesen");
    }

    static float Sample(byte[] b, int at, int bytes, bool isFloat)
    {
        if (isFloat) return bytes == 4 ? BitConverter.ToSingle(b, at) : (float)BitConverter.ToDouble(b, at);
        if (bytes == 2) return BitConverter.ToInt16(b, at) / 32768f;
        if (bytes == 3) return ((b[at] << 8) | (b[at + 1] << 16) | (b[at + 2] << 24)) / 2147483648f;
        return BitConverter.ToInt32(b, at) / 2147483648f;
    }

    // the FFT bins of each band at this sample rate; every band gets at least one
    static void Prepare(int rate)
    {
        for (int k = 0; k < N; k++) hann[k] = 0.5 - 0.5 * Math.Cos(2 * Math.PI * k / (N - 1));
        for (int b = 0; b < Bands; b++)
        {
            double f0 = MinHz * Math.Pow(MaxHz / MinHz, b / (double)Bands), f1 = MinHz * Math.Pow(MaxHz / MinHz, (b + 1) / (double)Bands);
            lo[b] = Math.Max(1, (int)Math.Ceiling(f0 * N / rate));
            hi[b] = Math.Min(N / 2 - 1, Math.Max(lo[b], (int)Math.Ceiling(f1 * N / rate) - 1));
        }
        peak = FloorDb;
        Array.Clear(shown, 0, Bands);
    }

    // level[]: dB per band of the last N samples (oldest at pos); false when it is quieter than the stillness threshold
    static bool Analyze(float[] ring, int pos)
    {
        double sq = 0;
        for (int k = 0; k < N; k++)
        {
            double x = ring[(pos + k) % N];
            sq += x * x;
            re[k] = x * hann[k];
            im[k] = 0;
        }
        if (Math.Sqrt(sq / N) < Still) return false;
        Fft(re, im);
        for (int b = 0; b < Bands; b++)
        {
            double e = 0;
            for (int k = lo[b]; k <= hi[b]; k++) e += re[k] * re[k] + im[k] * im[k];
            // a full-scale sine reads about 0 dB: the window halves its amplitude, the FFT scales it by N/2
            level[b] = 10 * Math.Log10(e * 16.0 / ((double)N * N) + 1e-12);
        }
        return true;
    }

    // shown[] 0-1 against the falling peak; up quickly, down slowly
    static void Step(bool loud)
    {
        double top = FloorDb;
        if (loud) for (int b = 0; b < Bands; b++) top = Math.Max(top, level[b]);
        peak = Math.Max(peak - FallDb, top);
        for (int b = 0; b < Bands; b++)
        {
            double v = loud ? Math.Max(0, Math.Min(1, 1 - (peak - level[b]) / RangeDb)) : 0;
            shown[b] += (v - shown[b]) * (v > shown[b] ? 0.7 : 0.2);
        }
    }

    static void Fft(double[] xr, double[] xi)
    {
        int n = xr.Length;
        for (int i = 1, j = 0; i < n; i++)
        {
            int bit = n >> 1;
            for (; (j & bit) != 0; bit >>= 1) j ^= bit;
            j ^= bit;
            if (i < j)
            {
                double t = xr[i]; xr[i] = xr[j]; xr[j] = t;
                t = xi[i]; xi[i] = xi[j]; xi[j] = t;
            }
        }
        for (int len = 2; len <= n; len <<= 1)
        {
            double ang = -2 * Math.PI / len, wr = Math.Cos(ang), wi = Math.Sin(ang);
            for (int i = 0; i < n; i += len)
            {
                double cr = 1, ci = 0;
                for (int k = 0; k < len / 2; k++)
                {
                    int a = i + k, b = a + len / 2;
                    double tr = xr[b] * cr - xi[b] * ci, ti = xr[b] * ci + xi[b] * cr;
                    xr[b] = xr[a] - tr; xi[b] = xi[a] - ti;
                    xr[a] += tr; xi[a] += ti;
                    double next = cr * wr - ci * wi;
                    ci = cr * wi + ci * wr;
                    cr = next;
                }
            }
        }
    }

    static void Send(double[] v)
    {
        var sb = new StringBuilder("{\"type\":\"spectrum\",\"bands\":[");
        for (int b = 0; b < Bands; b++) sb.Append(b > 0 ? "," : "").Append(v[b].ToString("0.00", CultureInfo.InvariantCulture));
        NikkiHelper.Emit(sb.Append("]}").ToString());
    }

    // --spectrum-test: a 1 kHz tone peaks in its band (692-1117 Hz, band 6) and fills it, silence stays quiet
    public static bool SelfTest()
    {
        const int rate = 48000;
        Prepare(rate);
        var ring = new float[N];
        for (int k = 0; k < N; k++) ring[k] = (float)(0.5 * Math.Sin(2 * Math.PI * 1000 * k / rate));
        bool loud = Analyze(ring, 0);
        Step(loud);
        int top = 0;
        for (int b = 1; b < Bands; b++) if (level[b] > level[top]) top = b;
        bool quiet = !Analyze(new float[N], 0);
        Send(shown);
        bool ok = loud && top == 6 && shown[6] > 0.6 && quiet;
        NikkiHelper.Emit("{\"type\":\"selftest\",\"ok\":" + (ok ? "true" : "false") + ",\"top\":" + top + "}");
        return ok;
    }
}
