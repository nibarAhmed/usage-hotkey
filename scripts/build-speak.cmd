@echo off
rem Rebuilds bin\speak.exe from scripts\speak.cs with the C# compiler that ships
rem with Windows (no SDK needed). Run from anywhere, then commit bin\speak.exe.
setlocal
set "ROOT=%~dp0.."
"%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:winexe /platform:anycpu /optimize /out:"%ROOT%\bin\speak.exe" "%ROOT%\scripts\speak.cs"
