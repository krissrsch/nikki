// The user's real Windows clipboard around a test: snapshot every format, put test text in, put the snapshot back.
// Win32 through PowerShell (Add-Type), so nothing new gets installed. The test's own text carries the markers that keep it
// out of the clipboard history (Win+V) and the cloud clipboard; the restore carries them too, so it adds no second copy there.
import { spawnSync } from 'node:child_process';

const CS = String.raw`
using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Runtime.InteropServices;
public static class NikkiClip {
  [DllImport("user32.dll")] static extern bool OpenClipboard(IntPtr owner);
  [DllImport("user32.dll")] static extern bool CloseClipboard();
  [DllImport("user32.dll")] static extern bool EmptyClipboard();
  [DllImport("user32.dll")] static extern uint EnumClipboardFormats(uint format);
  [DllImport("user32.dll")] static extern IntPtr GetClipboardData(uint format);
  [DllImport("user32.dll")] static extern IntPtr SetClipboardData(uint format, IntPtr mem);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClipboardFormatName(uint format, StringBuilder name, int max);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern uint RegisterClipboardFormat(string name);
  [DllImport("kernel32.dll")] static extern IntPtr GlobalAlloc(uint flags, UIntPtr bytes);
  [DllImport("kernel32.dll")] static extern IntPtr GlobalLock(IntPtr mem);
  [DllImport("kernel32.dll")] static extern bool GlobalUnlock(IntPtr mem);
  [DllImport("kernel32.dll")] static extern UIntPtr GlobalSize(IntPtr mem);
  [DllImport("gdi32.dll")] static extern uint GetEnhMetaFileBits(IntPtr emf, uint size, byte[] data);
  [DllImport("gdi32.dll")] static extern IntPtr SetEnhMetaFileBits(uint size, byte[] data);
  const uint TEXT = 13, EMF = 14;
  static readonly string[] Hidden = { "CanIncludeInClipboardHistory", "CanUploadToCloudClipboard" };

  static void Open() {
    for (int i = 0; i < 100; i++) { if (OpenClipboard(IntPtr.Zero)) return; Thread.Sleep(30); }
    throw new Exception("clipboard busy");
  }
  // GDI handles (bitmap, metafile picture, palette), owner-display and private formats are no memory blocks;
  // Windows makes the bitmap and the metafile picture again from DIB and EMF
  static bool Skip(uint f) { return f == 2 || f == 3 || f == 9 || (f >= 0x80 && f <= 0x8E) || (f >= 0x200 && f <= 0x3FF); }
  static byte[] Read(uint f, IntPtr h) {
    if (f == EMF) { uint n = GetEnhMetaFileBits(h, 0, null); byte[] e = new byte[n]; GetEnhMetaFileBits(h, n, e); return e; }
    IntPtr p = GlobalLock(h);
    if (p == IntPtr.Zero) return null;
    try { int n = (int)GlobalSize(h).ToUInt64(); byte[] b = new byte[n]; Marshal.Copy(p, b, 0, n); return b; }
    finally { GlobalUnlock(h); }
  }
  static void Put(uint f, byte[] b) {
    if (f == EMF) { SetClipboardData(f, SetEnhMetaFileBits((uint)b.Length, b)); return; }
    IntPtr h = GlobalAlloc(2, new UIntPtr((uint)Math.Max(b.Length, 1)));
    IntPtr p = GlobalLock(h);
    Marshal.Copy(b, 0, p, b.Length);
    GlobalUnlock(h);
    SetClipboardData(f, h);
  }
  static void PutHidden() { foreach (string name in Hidden) Put(RegisterClipboardFormat(name), new byte[4]); }

  // one line per format: id, name (empty for standard formats), data as base64
  public static int Save(string file) {
    StringBuilder sb = new StringBuilder();
    int count = 0;
    Open();
    try {
      uint f = 0;
      while ((f = EnumClipboardFormats(f)) != 0) {
        if (Skip(f)) continue;
        IntPtr h = GetClipboardData(f);
        if (h == IntPtr.Zero) continue;
        byte[] b = Read(f, h);
        if (b == null) continue;
        StringBuilder name = new StringBuilder(256);
        GetClipboardFormatName(f, name, 256);
        // OLE's plumbing (a window handle into the app that copied), not content: OLE builds it again from the formats
        if (name.ToString() == "DataObject" || name.ToString() == "Ole Private Data") continue;
        sb.Append(f).Append('\t').Append(name.ToString()).Append('\t').Append(Convert.ToBase64String(b)).Append('\n');
        count++;
      }
    } finally { CloseClipboard(); }
    File.WriteAllText(file, sb.ToString());
    return count;
  }
  public static void Restore(string file) {
    string[] lines = File.ReadAllText(file).Split(new[] { '\n' }, StringSplitOptions.RemoveEmptyEntries);
    bool marked = false;
    Open();
    try {
      EmptyClipboard();
      foreach (string line in lines) {
        string[] p = line.Split('\t');
        if (Array.IndexOf(Hidden, p[1]) >= 0) marked = true;
        Put(p[1].Length > 0 ? RegisterClipboardFormat(p[1]) : uint.Parse(p[0]), Convert.FromBase64String(p[2]));
      }
      if (lines.Length > 0 && !marked) PutHidden();
    } finally { CloseClipboard(); }
  }
  public static void SetText(string text, bool exclude) {
    Open();
    try {
      EmptyClipboard();
      Put(TEXT, Encoding.Unicode.GetBytes(text + "\0"));
      PutHidden();
      if (exclude) Put(RegisterClipboardFormat("ExcludeClipboardContentFromMonitorProcessing"), new byte[4]);
    } finally { CloseClipboard(); }
  }
  public static string Text() {
    Open();
    try {
      IntPtr h = GetClipboardData(TEXT);
      if (h == IntPtr.Zero) return "";
      string s = Encoding.Unicode.GetString(Read(TEXT, h));
      int end = s.IndexOf('\0');
      return end < 0 ? s : s.Substring(0, end);
    } finally { CloseClipboard(); }
  }
}`;

// args go through the environment: no quoting of user text or paths in a command line
function ps(call, env = {}) {
  const script = `$ErrorActionPreference = 'Stop'\n$ProgressPreference = 'SilentlyContinue'\nAdd-Type -TypeDefinition @'\n${CS}\n'@\n[Console]::OutputEncoding = [Text.Encoding]::UTF8\n${call}`;
  const encoded = Buffer.from(script, 'utf16le').toString('base64'); // stdin (-Command -) breaks the multi-line here-string
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], { env: { ...process.env, ...env }, encoding: 'utf8', windowsHide: true, timeout: 60000 });
  if (r.status !== 0) throw new Error(`Zwischenablage: ${r.stderr || r.error?.message || r.status}`);
  return r.stdout.trim();
}

export const saveClipboard = (file) => Number(ps('[NikkiClip]::Save($env:CLIP_FILE)', { CLIP_FILE: file }));
export const restoreClipboard = (file) => ps('[NikkiClip]::Restore($env:CLIP_FILE)', { CLIP_FILE: file });
export const setClipboardText = (text, { exclude = false } = {}) => ps('[NikkiClip]::SetText($env:CLIP_TEXT, $env:CLIP_EXCLUDE -eq "1")', { CLIP_TEXT: text, CLIP_EXCLUDE: exclude ? '1' : '0' });
export const clipboardText = () => ps('[NikkiClip]::Text()');
