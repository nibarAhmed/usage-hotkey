# usage-hotkey

A Claude Code plugin for screen reader users. One keystroke speaks your usage
through NVDA, from the prompt, while Claude is working or not:

> Context 45,000 of 200,000 tokens, 23 percent. Session 24 percent used, resets in
> 2 hours 10 minutes, at 3:10 PM. Weekly 41 percent used, resets in 2 days 3
> hours, at Friday 9 AM. Cost 1.23 dollars.

Context tokens come first, then the session and weekly limits with a countdown
and the local clock time of each reset, then the session cost last. A repeat
press cuts off the reading and starts it again.

## Requirements

- Windows with NVDA running. It speaks through NVDA's own voice and does nothing
  useful with other screen readers.
- Claude Code with plugin "mods" (hooks modules).
- Session and weekly limits only appear on a Claude subscription, and only after
  Claude has answered once. Before that you hear "No usage limit reading yet".

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

## How it works

- `hooks/register.tsx` draws one blank button above the prompt. The chord can
  only press a button that is mounted, so the button exists but shows and says
  nothing.
- Pressing it reads `$.session.usage()`, builds the sentence in `hooks/format.ts`
  and pipes it to `scripts/speak.ps1`.
- `scripts/speak.ps1` loads the NVDA controller client DLL for your CPU from
  `bin/` and calls `nvdaController_cancelSpeech` then `nvdaController_speakText`.
  The text only travels on stdin, so nothing in it is run as a command.

If NVDA is not running or the call fails, a short toast says so.

## Privacy

The readout is spoken aloud and nothing is sent anywhere. NVDA also runs on the
Windows lock screen, so avoid pressing the hotkey while the screen is locked.

## Development

```
claude plugin validate .
claude plugin test .
```

## Licenses

This plugin's code is MIT licensed; see `LICENSE`. The bundled NVDA controller
client is LGPL 2.1; see `THIRD_PARTY_NOTICES.md`.
