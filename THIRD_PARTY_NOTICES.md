# Third-party notices

## NVDA Controller Client API

- **What:** `bin/x64/`, `bin/x86/` and `bin/arm64/nvdaControllerClient.dll`, the
  library that lets this plugin ask a running NVDA to speak.
- **Version:** from NVDA 2026.2, `nvda_2026.2_controllerClient.zip`, downloaded
  from <https://download.nvaccess.org/releases/2026.2/>. The files are unmodified
  and carry NV Access Limited's Authenticode signature.
- **Copyright:** NV Access Limited and contributors.
- **License:** GNU Lesser General Public License, version 2.1. The full text is
  in `bin/LICENSE-nvda-controller-client.txt`.
- **Source:** <https://github.com/nvaccess/nvda> (tag `release-2026.2`, folder
  `extras/controllerClient`). To use a different build of the library, replace
  the DLL for your architecture; this plugin only loads it at run time, through
  `scripts/speak.ps1`, and does not link it into anything.

SHA-256 of the bundled files:

| File | SHA-256 |
| --- | --- |
| `bin/x64/nvdaControllerClient.dll` | `598b7ec3dc469814f571275929f676ce73834c469fbdb359a06fd4db4e0fc866` |
| `bin/x86/nvdaControllerClient.dll` | `96295979a25ab1c8ddc9b6aaffdd81ed72c9504880850d49e99f1db96055a7d0` |
| `bin/arm64/nvdaControllerClient.dll` | `6faaa1dd82bae2ae953bd14f5206fef63b8932d9a3cb4578fe027ec794f7918e` |
