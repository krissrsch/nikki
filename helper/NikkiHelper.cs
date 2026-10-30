// Nikki's Windows helper: long-running, talks JSON lines over stdio.
// stdout: {"type":"ready"} | {"type":"media",...} | {"type":"volume","level":0-100,"muted":bool} | {"type":"error","message":...}
// stdin:  toggle | play | pause | next | prev | seek <seconds> | volume <0-100> | mute | unmute
// Built with the C# 5 compiler that ships with Windows (see build.cmd): no C# 6+ syntax, and WinRT
// async calls are waited on directly because .NET Framework's await bridge does not bind to the system .winmd files.
using System;
using System.Collections.Generic;
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

    static void Error(Exception e)
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

    static void Emit(string json)
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
    interface IMMDeviceEnumerator
    {
        [PreserveSig] int EnumAudioEndpoints(int dataFlow, int stateMask, out IntPtr devices);
        [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice device);
    }

    [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDevice
    {
        [PreserveSig] int Activate(ref Guid iid, int clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object iface);
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
    static IAudioEndpointVolume Endpoint()
    {
        var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumerator();
        IMMDevice device;
        if (enumerator.GetDefaultAudioEndpoint(0 /* eRender */, 1 /* eMultimedia */, out device) != 0 || device == null) return null;
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
