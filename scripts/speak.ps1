# Speaks the text on stdin through the running NVDA, using NV Access's
# controller client DLL bundled under bin/<arch>/. Exits with NVDA's own status
# (0 on success); 2 when no DLL matches this machine.
#
# Cancelling first makes a repeat press restart the reading instead of queueing
# behind it. The text only ever arrives on stdin, so nothing in it is parsed as
# a command.
param([Parameter(Mandatory)][string]$Root)

$arch = switch ($env:PROCESSOR_ARCHITECTURE) {
  'ARM64' { 'arm64' }
  'x86' { 'x86' }
  default { 'x64' }
}
$dll = Join-Path $Root "bin/$arch/nvdaControllerClient.dll"

if (-not (Test-Path -LiteralPath $dll)) {
  [Console]::Error.WriteLine("No NVDA controller client for $arch at $dll")
  exit 2
}

$dll = [IO.Path]::GetFullPath($dll)
Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
public static class Nvda {
  [DllImport(@"$dll", CharSet = CharSet.Unicode)] public static extern int nvdaController_speakText(string text);
  [DllImport(@"$dll")] public static extern int nvdaController_cancelSpeech();
}
"@

[Console]::InputEncoding = [Text.Encoding]::UTF8
$text = [Console]::In.ReadToEnd()
[void][Nvda]::nvdaController_cancelSpeech()
exit [Nvda]::nvdaController_speakText($text)
