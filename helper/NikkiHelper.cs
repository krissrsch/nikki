// Nikki's Windows helper: long-running, talks JSON lines over stdio.
// stdout: {"type":"ready"} | {"type":"media",...} | {"type":"error","message":...}
// stdin:  toggle | play | pause | next | prev | seek <seconds>
// Built with the C# 5 compiler that ships with Windows (see build.cmd): no C# 6+ syntax, and WinRT
// async calls are waited on directly because .NET Framework's await bridge does not bind to the system .winmd files.
using System;
using System.IO;
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
    static string lastSent = "";
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
        if (args.Length > 0 && args[0] == "--once") return;

        // Session events are unreliable across players, so poll; Report only writes on change.
        var poll = new Thread(() =>
        {
            while (true)
            {
                Thread.Sleep(1000);
                try { Report(); } catch (Exception e) { Error(e); }
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
        lock (outLock)
        {
            if (json == lastSent) return;
            lastSent = json;
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
