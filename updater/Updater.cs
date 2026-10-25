// Updater.exe: builds the app from this project folder and swaps it into the installed copy
// (%LOCALAPPDATA%\Programs\Nikki) without reinstalling. Rebuild it with updater\build.cmd.
using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading;

class Updater
{
    const string AppName = "Nikki";
    const string OldName = "DesktopCompanion";

    static int Main()
    {
        Console.OutputEncoding = Encoding.UTF8;
        try
        {
            string project = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\');
            string programs = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs");
            string install = Path.Combine(programs, AppName);
            string exe = Path.Combine(install, AppName + ".exe");
            string oldInstall = Path.Combine(programs, OldName);
            string oldExe = Path.Combine(oldInstall, OldName + ".exe");

            if (!File.Exists(Path.Combine(project, "package.json"))) return Fail("Updater.exe muss im Projektordner liegen.");
            if (!File.Exists(exe) && !File.Exists(oldExe))
                return Fail(AppName + " ist nicht installiert. Bitte einmal das Setup aus dist\\ ausführen.");

            Console.WriteLine("1/3 Baue die neue Version …");
            if (Run("cmd.exe", "/c npm run pack", project) != 0)
                return Fail("Build fehlgeschlagen, siehe Ausgabe oben. Die installierte App bleibt unverändert.");

            Console.WriteLine("2/3 Beende die laufende App …");
            // Never launch Nikki.exe --quit: that starts a second Electron and fights over the GPU/disk cache.
            SoftKill(AppName);
            SoftKill(OldName);
            WaitGone(AppName, OldName);
            KillAll(AppName, OldName);
            Thread.Sleep(1000); // release cache file locks before MIR / relaunch

            Console.WriteLine("3/3 Kopiere die neue Version …");
            string src = Path.Combine(project, "dist", "win-unpacked");
            try { Directory.Delete(Path.Combine(install, "resources", "app", "graphify-out"), true); } catch { }
            try { Directory.Delete(Path.Combine(oldInstall, "resources", "app", "graphify-out"), true); } catch { }
            // No pipe redirect — robocopy exit code via cmd; stdout discarded by the shell.
            int rc = Run("cmd.exe",
                "/c robocopy.exe " + Q(src) + " " + Q(install) +
                " /MIR /XF \"Uninstall " + AppName + ".exe\" \"Uninstall " + OldName + ".exe\" /XD graphify-out /NFL /NDL /NJH /NJS /NP >nul 2>nul",
                project, noWindow: true);
            if (rc >= 8) return Fail("Kopieren fehlgeschlagen (robocopy-Code " + rc + ").");
            if (!File.Exists(exe)) return Fail("Nach dem Kopieren fehlt " + AppName + ".exe.");

            EnsureDesktopShortcut(exe);
            // Fire-and-forget: do not WaitForExit on a process that could hold console handles.
            Process.Start(new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = "/c start \"\" /D " + Q(install) + " " + Q(exe),
                WorkingDirectory = install,
                UseShellExecute = false,
                CreateNoWindow = true,
            });
            Console.WriteLine("Fertig, die App läuft wieder.");
        }
        catch (Exception ex)
        {
            return Fail(ex.Message);
        }
        Environment.Exit(0);
        return 0;
    }

    static void SoftKill(string processName)
    {
        // taskkill without /F asks the process to close; ignore "not found"
        Run("taskkill.exe", "/IM " + processName + ".exe", Environment.SystemDirectory, noWindow: true);
    }

    static void EnsureDesktopShortcut(string targetExe)
    {
        string desk = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        string lnk = Path.Combine(desk, AppName + ".lnk");
        string work = Path.GetDirectoryName(targetExe) ?? "";
        string ps =
            "$s=(New-Object -ComObject WScript.Shell).CreateShortcut(" + Ps(lnk) + ");" +
            "$s.TargetPath=" + Ps(targetExe) + ";" +
            "$s.WorkingDirectory=" + Ps(work) + ";" +
            "$s.Description=" + Ps(AppName) + ";" +
            "$s.Save()";
        Run("cmd.exe",
            "/c powershell.exe -NoProfile -ExecutionPolicy Bypass -Command " + Q(ps) + " >nul 2>nul",
            work, noWindow: true);
        try { File.Delete(Path.Combine(desk, OldName + ".lnk")); } catch { }
    }

    static void WaitGone(params string[] names)
    {
        for (int i = 0; i < 50; i++)
        {
            bool any = false;
            foreach (var n in names) if (Process.GetProcessesByName(n).Length > 0) { any = true; break; }
            if (!any) return;
            Thread.Sleep(100);
        }
    }

    static void KillAll(params string[] names)
    {
        foreach (var n in names)
            foreach (var p in Process.GetProcessesByName(n))
                try { p.Kill(); p.WaitForExit(3000); } catch { }
    }

    static string Q(string s) { return "\"" + s + "\""; }
    static string Ps(string s) { return "'" + s.Replace("'", "''") + "'"; }

    static int Run(string file, string args, string cwd, bool noWindow = false)
    {
        var psi = new ProcessStartInfo(file, args)
        {
            UseShellExecute = false,
            WorkingDirectory = cwd,
            CreateNoWindow = noWindow,
        };
        using (var p = Process.Start(psi))
        {
            if (p == null) return -1;
            p.WaitForExit();
            return p.ExitCode;
        }
    }

    static int Fail(string msg)
    {
        Console.ForegroundColor = ConsoleColor.Red;
        Console.WriteLine(msg);
        Console.ResetColor();
        Console.WriteLine("Taste drücken zum Schließen …");
        Console.ReadKey(true);
        return 1;
    }
}
