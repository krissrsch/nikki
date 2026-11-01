// Is a fullscreen app (game, video) in front of the island's monitor?
// SHQueryUserNotificationState alone only looks at the window that has the focus: with a game on one monitor and the terminal on
// the other, the game lost the focus, Windows said "no fullscreen" and the island came back over the game. So the watcher asks
// per monitor: the top large window there covers it completely, without a title bar, not maximized? That is fullscreen, focus or not.

// One line per second: the monitors that have a fullscreen window, as "left,top,right,bottom" in pixels, joined by ";" (empty: none).
// Windows to look past: our own, cloaked (hidden UWP), click-through or non-activating overlays, tool windows, the desktop and the taskbar.
const CS = `
using System; using System.Collections.Generic; using System.Runtime.InteropServices; using System.Text;
public static class Cov {
  delegate bool EnumProc(IntPtr h, IntPtr l);
  struct Rc { public int L, T, R, B; }
  struct Mi { public int size; public Rc mon, work; public uint flags; }
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc p, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsZoomed(IntPtr h);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out Rc r);
  [DllImport("user32.dll", EntryPoint = "GetWindowLongW")] static extern int GetLong(IntPtr h, int i);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr h, uint f);
  [DllImport("user32.dll")] static extern bool GetMonitorInfo(IntPtr m, ref Mi mi);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int a, out int v, int n);
  [DllImport("shell32.dll")] static extern int SHQueryUserNotificationState(out int s);
  static bool Mon(IntPtr h, out Mi mi) { mi = new Mi(); mi.size = Marshal.SizeOf(typeof(Mi)); IntPtr m = MonitorFromWindow(h, 2); return m != IntPtr.Zero && GetMonitorInfo(m, ref mi); }
  static string Key(Mi m) { return m.mon.L + "," + m.mon.T + "," + m.mon.R + "," + m.mon.B; }
  public static string Run(uint own) {
    var decided = new HashSet<string>(); var covered = new List<string>();
    EnumWindows(delegate (IntPtr h, IntPtr l) {
      if (!IsWindowVisible(h) || IsIconic(h)) return true;
      uint pid; GetWindowThreadProcessId(h, out pid); if (pid == own) return true;
      int cloaked; if (DwmGetWindowAttribute(h, 14, out cloaked, 4) == 0 && cloaked != 0) return true;
      int ex = GetLong(h, -20); if ((ex & (0x20 | 0x08000000 | 0x80)) != 0) return true; // transparent, no-activate, tool window
      var cls = new StringBuilder(64); GetClassName(h, cls, 64); string c = cls.ToString();
      if (c == "Progman" || c == "WorkerW" || c == "Shell_TrayWnd" || c == "Shell_SecondaryTrayWnd") return true;
      Rc r; Mi mi; if (!GetWindowRect(h, out r) || !Mon(h, out mi)) return true;
      long w = (long)(Math.Min(r.R, mi.mon.R) - Math.Max(r.L, mi.mon.L)), hh = (long)(Math.Min(r.B, mi.mon.B) - Math.Max(r.T, mi.mon.T));
      if (w <= 0 || hh <= 0 || w * hh * 2 < (long)(mi.mon.R - mi.mon.L) * (mi.mon.B - mi.mon.T)) return true; // small windows do not hide a game behind them
      string k = Key(mi); if (!decided.Add(k)) return true; // the top large window of a monitor decides
      bool whole = r.L <= mi.mon.L && r.T <= mi.mon.T && r.R >= mi.mon.R && r.B >= mi.mon.B;
      if (whole && !IsZoomed(h) && (GetLong(h, -16) & 0xC00000) != 0xC00000) covered.Add(k);
      return true;
    }, IntPtr.Zero);
    // what Windows itself calls fullscreen (exclusive Direct3D, presentation mode, Store apps): the monitor of the window in front
    int q; SHQueryUserNotificationState(out q);
    IntPtr fg = GetForegroundWindow(); uint fpid = 0; if (fg != IntPtr.Zero) GetWindowThreadProcessId(fg, out fpid);
    Mi fm; if ((q == 2 || q == 3 || q == 4 || q == 7) && fg != IntPtr.Zero && fpid != own && Mon(fg, out fm) && !covered.Contains(Key(fm))) covered.Add(Key(fm));
    return string.Join(";", covered.ToArray());
  }
}`;

export function fullscreenScript(pid) {
  return `Add-Type -TypeDefinition @'${CS}\n'@
[void][Cov]::SetProcessDPIAware()
while (Get-Process -Id ${pid} -ErrorAction SilentlyContinue) { [Console]::WriteLine([Cov]::Run(${pid})); Start-Sleep -Milliseconds 1000 }`;
}

// the args for powershell.exe: encoded, so no quoting of the C# can go wrong
export const powershellArgs = (script) => ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')];

// "0,0,1920,1080;1920,3,3840,1083" → [{ l, t, r, b }]
export function parseCovered(line) {
  return String(line ?? '')
    .split(';')
    .map((s) => s.split(',').map(Number))
    .filter((n) => n.length === 4 && n.every(Number.isFinite))
    .map(([l, t, r, b]) => ({ l, t, r, b }));
}

// rect: the island's monitor in pixels ({ x, y, width, height }); a few pixels off are the same monitor
export const coversMonitor = (covered, rect, tol = 4) =>
  covered.some((c) => Math.abs(c.l - rect.x) <= tol && Math.abs(c.t - rect.y) <= tol && Math.abs(c.r - (rect.x + rect.width)) <= tol && Math.abs(c.b - (rect.y + rect.height)) <= tol);
