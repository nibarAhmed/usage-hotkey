# usage-hotkey

A Claude Code plugin for screen reader users. Press one key and NVDA speaks your
Claude Code usage: context tokens, session and weekly limits with reset times,
and cost.

## Requirements

- Windows with NVDA running.
- Claude Code with plugin "mods" (hooks modules).

## Install

From a clone of this repository:

```
claude plugin marketplace add <path to this folder>
claude plugin install usage-hotkey@usage-hotkey
```

Or try it for one session without installing:

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
      "bindings": { "alt+u": "app:toggleDiffNoiseFilter" }
    }
  ]
}
```

Any chord works. Avoid `ctrl+c`, `ctrl+d`, `ctrl+z` and keys your terminal or
screen reader already uses. If you open Claude Code's diff panel, that panel
handles the action itself and the hotkey will not speak there.

## Troubleshooting

- **Nothing is spoken and a toast says it could not speak:** NVDA is probably not
  running. Start it and press the key again.
- **Nothing happens at all:** check that the plugin is loaded (`/reload-plugins`)
  and that the chord is bound to `app:toggleDiffNoiseFilter` in the `Global`
  context. A dialog or the diff panel being open also stops the key.
- **NVDA reads the window title when you press the key:** this plugin starts
  PowerShell hidden to avoid that. If you still hear it, the key itself may be
  triggering your terminal; try a different chord.

## How it works

- `hooks/register.tsx` draws one blank button above the prompt. The chord can
  only press a button that is mounted, so the button exists but shows and says
  nothing.
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
