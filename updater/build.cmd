@echo off
rem Compiles updater\Updater.cs to ..\Updater.exe with the C# compiler that ships with Windows.
"%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /codepage:65001 /target:exe /out:"%~dp0..\Updater.exe" "%~dp0Updater.cs"
