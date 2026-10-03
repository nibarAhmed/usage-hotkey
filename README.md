# usage-hotkey

A Claude Code plugin for screen reader users. Press one key and NVDA speaks your
Claude Code usage: context tokens, session and weekly limits with reset times,
and cost.

## Requirements

- Windows with NVDA running.
- Claude Code with plugin "mods" (hooks modules).

## Install

```
claude plugin marketplace add nibarAhmed/usage-hotkey
claude plugin install usage-hotkey@usage-hotkey
```

Or from inside Claude Code: `/plugin marketplace add nibarAhmed/usage-hotkey`,
then `/plugin install usage-hotkey@usage-hotkey`.

To try it from a local clone, pass the folder path to `marketplace add`, or load
it for one session without installing:

```
claude --plugin-dir <path to this folder>
```

Then bind a key, as described next.

## Bind the key

A plugin cannot define its own keybinding, so it listens on an existing engine
action that nothing uses at the prompt, `app:toggleDiffNoiseFilter`. Bind your
chord to it in `~/.claude/keybindings.json` (merge into any bindings you have):

```json
{
  "$schema": "https://www.schemastore.org/claude-code-keybindings.json",
  "$docs": "https://code.claude.com/docs/en/keybindings",
  "bindings": [
    {
      "context": "Global",
      "bindings": { "ctrl+u": "app:toggleDiffNoiseFilter" }
    }
  ]
}
```

Avoid chords that use Alt (`alt+…`, `meta+…`): in the Windows console, pressing
Alt makes NVDA read the window title ("cmd.exe terminal …") again, whatever the
key is bound to. Also avoid `ctrl+c`, `ctrl+d`, `ctrl+z` and keys your terminal
or screen reader already uses. The action belongs to Claude Code's older diff
panel, which only opens if you disable the built-in `cc-plugin-diff` mod in
`/plugin`. In a default install nothing else handles it. If you do disable that
mod and open the older panel, the panel takes the action and the hotkey will not
speak there.

The plugin draws a small dim "Speak usage" button above the prompt, which is
what the chord presses; it can also be pressed by focusing the band. The action
is borrowed, so if a Claude Code update gives `app:toggleDiffNoiseFilter` its own
chord or prompt handler, re-check that your key still speaks.

## Troubleshooting

- **Nothing is spoken and a toast says it could not speak:** NVDA is probably not
  running. Start it and press the key again.
- **Nothing happens at all:** check that the plugin is loaded (`/reload-plugins`)
  and that the chord is bound to `app:toggleDiffNoiseFilter` in the `Global`
  context. An open dialog also stops the key, as does the older diff panel if you
  have disabled `cc-plugin-diff`.
- **NVDA reads the window title when you press the key:** your chord uses Alt,
  and the Windows console makes NVDA re-announce the window whenever Alt is
  pressed (try an unbound Alt chord: it does the same). Bind a Ctrl chord such
  as `ctrl+u` instead.

## How it works

- `hooks/register.tsx` draws one dim "Speak usage" button above the prompt, on
  the terminal only, beside whatever other mods draw there. The chord can only
  press a button that is mounted, which is why the button exists.
- Pressing it reads `$.session.usage()`, builds the sentence in `hooks/format.ts`
  and pipes it to `scripts/speak.ps1`, run with `-ExecutionPolicy Bypass` and a
  hidden window.
- `scripts/speak.ps1` loads the NVDA controller client DLL that matches
  PowerShell's architecture (x64, x86 or arm64) from `bin/` and calls
  `nvdaController_cancelSpeech` then `nvdaController_speakText`. The text only
  travels on stdin, so nothing in it is run as a command.

## Licenses

This plugin's code is MIT licensed; see `LICENSE`. The bundled NVDA controller
client is LGPL 2.1; see `THIRD_PARTY_NOTICES.md`.
