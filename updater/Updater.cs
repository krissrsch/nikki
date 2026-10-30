// Updater.exe: builds the app from this project folder and swaps it into the installed copy without reinstalling.
// Rebuild it with updater\build.cmd. `Updater.exe --dry-run` only prints the paths it would use and changes nothing.
using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading;
using Microsoft.Win32;

class Updater
{
    const string AppName = "Nikki";

    static int Main(string[] args)
    {
        Console.OutputEncoding = Encoding.UTF8;
        bool dryRun = Array.IndexOf(args, "--dry-run") >= 0;
        try
        {
            string project = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\');
            string install = FindInstall();
            string exe = install == null ? null : Path.Combine(install, AppName + ".exe");
            // electron-builder writes `npm run pack` to <directories.output>\win-unpacked, and output is "." (package.json)
            string src = Path.Combine(project, "win-unpacked");

            if (dryRun)
            {
                Console.WriteLine("Projekt:     " + project + (File.Exists(Path.Combine(project, "package.json")) ? "" : "  (keine package.json!)"));
                Console.WriteLine("Installiert: " + (exe ?? "(nicht gefunden)") + (exe != null && !File.Exists(exe) ? "  (fehlt!)" : ""));
                Console.WriteLine("Quelle:      " + src + (File.Exists(Path.Combine(src, AppName + ".exe")) ? "" : "  (noch nicht gebaut)"));
                Console.WriteLine("Trockenlauf: nichts gebaut, beendet oder kopiert.");
                return exe != null && File.Exists(exe) ? 0 : 1;
            }

            if (!File.Exists(Path.Combine(project, "package.json"))) return Fail("Updater.exe muss im Projektordner liegen.");
            if (exe == null || !File.Exists(exe))
                return Fail(AppName + " ist nicht installiert. Bitte einmal Nikki-Setup.exe aus dem Projektordner ausführen.");

            Console.WriteLine("1/3 Baue die neue Version …");
            if (Run("cmd.exe", "/c npm run pack", project) != 0)
                return Fail("Build fehlgeschlagen, siehe Ausgabe oben. Die installierte App bleibt unverändert.");
            // check before the app is closed: without a fresh build there is nothing to copy (and /MIR must never mirror an old one)
            if (!File.Exists(Path.Combine(src, AppName + ".exe")))
                return Fail("Nach dem Build fehlt " + Path.Combine(src, AppName + ".exe") + ". Die installierte App bleibt unverändert.");

            Console.WriteLine("2/3 Beende die laufende App …");
            // Never launch Nikki.exe --quit: that starts a second Electron and fights over the GPU/disk cache.
            Run("taskkill.exe", "/IM " + AppName + ".exe", Environment.SystemDirectory, noWindow: true); // asks it to close
            WaitGone(AppName);
            KillAll(AppName);
            Thread.Sleep(1000); // release cache file locks before MIR / relaunch

            Console.WriteLine("3/3 Kopiere die neue Version …");
            try { Directory.Delete(Path.Combine(install, "resources", "app", "graphify-out"), true); } catch { }
            // No pipe redirect — robocopy exit code via cmd; stdout discarded by the shell.
            int rc = Run("cmd.exe",
                "/c robocopy.exe " + Q(src) + " " + Q(install) +
                " /MIR /XF \"Uninstall " + AppName + ".exe\" /XD graphify-out /NFL /NDL /NJH /NJS /NP >nul 2>nul",
                project, noWindow: true);
            bool copied = rc < 8 && File.Exists(exe);

            if (File.Exists(exe))
            {
                EnsureDesktopShortcut(exe);
                Start(install, exe); // also after a failed copy: the user must not be left without Nikki
            }
            if (!copied) return Fail("Kopieren fehlgeschlagen (robocopy-Code " + rc + ")." + (File.Exists(exe) ? " Nikki läuft wieder mit dem alten Stand." : ""));
            Console.WriteLine("Fertig, die App läuft wieder.");
        }
        catch (Exception ex)
        {
            return Fail(ex.Message);
        }
        Environment.Exit(0);
        return 0;
    }

    // The NSIS installer installs under the package name (Programs\desktopcompanion), so ask Windows where it put Nikki:
    // its uninstall entry, then the running process.
    static string FindInstall()
    {
        using (var uninstall = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall"))
        {
            if (uninstall != null)
                foreach (string id in uninstall.GetSubKeyNames())
                    using (var entry = uninstall.OpenSubKey(id))
                    {
                        string name = entry == null ? null : entry.GetValue("DisplayName") as string;
                        if (name == null || !(name == AppName || name.StartsWith(AppName + " "))) continue;
                        // electron-builder keeps InstallLocation in its own key; DisplayIcon is "<dir>\Nikki.exe,0"
                        using (var own = Registry.CurrentUser.OpenSubKey(@"Software\" + id))
                        {
                            string location = own == null ? null : own.GetValue("InstallLocation") as string;
                            if (!string.IsNullOrEmpty(location)) return location.TrimEnd('\\');
                        }
                        string icon = entry.GetValue("DisplayIcon") as string;
                        if (!string.IsNullOrEmpty(icon)) return Path.GetDirectoryName(icon.Split(',')[0].Trim('"'));
                    }
        }
        foreach (var p in Process.GetProcessesByName(AppName))
            try { return Path.GetDirectoryName(p.MainModule.FileName); } catch { }
        return null;
    }

    static void Start(string install, string exe)
    {
        // Fire-and-forget: do not WaitForExit on a process that could hold console handles.
        Process.Start(new ProcessStartInfo
        {
            FileName = "cmd.exe",
            Arguments = "/c start \"\" /D " + Q(install) + " " + Q(exe),
            WorkingDirectory = install,
            UseShellExecute = false,
            CreateNoWindow = true,
        });
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
    }

    static void WaitGone(string name)
    {
        for (int i = 0; i < 50 && Process.GetProcessesByName(name).Length > 0; i++) Thread.Sleep(100);
    }

    static void KillAll(string name)
    {
        foreach (var p in Process.GetProcessesByName(name))
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
        if (!Console.IsInputRedirected)
        {
            Console.WriteLine("Taste drücken zum Schließen …");
            Console.ReadKey(true);
        }
        return 1;
    }
}
