@echo off
rem Compiles helper\NikkiHelper.cs to helper\NikkiHelper.exe with the C# compiler that ships with Windows.
rem WinRT (SMTC) comes from the system .winmd files plus the .NET Framework WinRT facades.
set FW=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319
set WM=%WINDIR%\System32\WinMetadata
"%FW%\csc.exe" /nologo /codepage:65001 /target:exe /out:"%~dp0NikkiHelper.exe" ^
  /r:"%FW%\System.Runtime.dll" /r:"%FW%\System.Threading.Tasks.dll" ^
  /r:"%FW%\System.Runtime.WindowsRuntime.dll" /r:"%FW%\System.Runtime.InteropServices.WindowsRuntime.dll" ^
  /r:"%WM%\Windows.Foundation.winmd" /r:"%WM%\Windows.Media.winmd" /r:"%WM%\Windows.Storage.winmd" ^
  "%~dp0NikkiHelper.cs"
