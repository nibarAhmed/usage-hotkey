// Speaks the text on stdin through the running NVDA, using NV Access's
// controller client DLL bundled under bin/<arch>/. Exits with NVDA's own status
// (0 on success); 2 when no DLL matches this machine.
//
// Built as a GUI-subsystem exe (/target:winexe) on purpose: a console program,
// even a hidden one, makes Windows create or attach a console first, and NVDA
// then announces the terminal window title on every press. A winexe never gets
// a console, while its inherited stdin/stderr pipes and exit code still work.
//
// Cancelling first makes a repeat press restart the reading instead of queueing
// behind it. The text only ever arrives on stdin, so nothing in it is parsed as
// a command.
using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

static class Speak
{
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern IntPtr LoadLibraryW(string path);

    [DllImport("nvdaControllerClient.dll", CharSet = CharSet.Unicode)]
    static extern int nvdaController_speakText(string text);

    [DllImport("nvdaControllerClient.dll")]
    static extern int nvdaController_cancelSpeech();

    static void Fail(string message)
    {
        using (var err = new StreamWriter(Console.OpenStandardError(), new UTF8Encoding(false)))
        {
            err.WriteLine(message);
        }
    }

    static int Main(string[] args)
    {
        if (args.Length < 1)
        {
            Fail("Usage: speak.exe <plugin root>");
            return 2;
        }

        var arch = "x64";
        switch (Environment.GetEnvironmentVariable("PROCESSOR_ARCHITECTURE"))
        {
            case "ARM64": arch = "arm64"; break;
            case "x86": arch = "x86"; break;
        }

        var dll = Path.GetFullPath(Path.Combine(args[0], "bin", arch, "nvdaControllerClient.dll"));
        if (!File.Exists(dll))
        {
            Fail("No NVDA controller client for " + arch + " at " + dll);
            return 2;
        }

        // DllImport takes a constant name, so load the right copy by full path
        // first; the imports below then bind to the module already in memory.
        if (LoadLibraryW(dll) == IntPtr.Zero)
        {
            Fail("Could not load " + dll + " (error " + Marshal.GetLastWin32Error() + ")");
            return 2;
        }

        string text;
        using (var reader = new StreamReader(Console.OpenStandardInput(), new UTF8Encoding(false)))
        {
            text = reader.ReadToEnd();
        }

        nvdaController_cancelSpeech();
        return nvdaController_speakText(text);
    }
}
