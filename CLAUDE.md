# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Claude Code plugin (a "mods" hooks module, not a Node package; `package.json` exists only to pin TypeScript for type-checking, so run `npm install` once) that speaks the user's Claude Code usage through NVDA on a hotkey. Windows + NVDA only. See `README.md` for install and key-binding instructions.

## Commands

- Run the tests: `claude plugin test .` (runs every `hooks/*.test.ts` under the `claude-code/testing` kit; there is no fs, network or process in that environment).
- Type-check: `npm run typecheck`, i.e. `tsc -p tsconfig.json` with the local TypeScript (config extends `.claude-plugin/types/tsconfig.json`, which has `noEmit`, `strict`, and a `jsx: react` / `h` factory).
- Try it live without installing: `claude --plugin-dir <this folder>`, then `/reload-plugins` after edits.
- Reach the installed copy: Claude Code runs a cached snapshot under `~/.claude/plugins/cache/usage-hotkey/usage-hotkey/<version>/`, keyed by `version` in `.claude-plugin/plugin.json`. Bump the version, then `claude plugin marketplace update usage-hotkey` and `claude plugin update usage-hotkey@usage-hotkey`; otherwise repo fixes never run.

`.claude-plugin/types/` holds the engine's type declarations (`claude-code`, `claude-code-tools`, `claude-code-mcp`); it is gitignored, so treat it as generated reference material. `claude-code/index.d.ts` is the authoritative description of `$` (the engine interface), the render hooks and the testing kit.

## Architecture

The plugin is loaded via `.claude-plugin/plugin.json` and `hooks/hooks.json`, which lists a single module, `./register.tsx`. Plugin code runs in a sandbox with no DOM, Node, fs or `require`: files are ES modules, imported only by `import` declarations (no dynamic `import()`), and all side effects go through `$` (`$.session.usage()`, `$.clock.now()`, `$.process.run`, `$.ui.toast`, `$.plugin.root`).

Data flow on a key press:

1. `hooks/register.tsx` hooks `ui.render` for the `AbovePrompt` component and appends a `Button` (key `usage`, label "Speak usage") inside a `display="none"` Box beneath whatever other mods drew (`await next(e)` first). It does nothing off the terminal surface or while a survey is shown.
2. The button's `action` is `app:toggleDiffNoiseFilter`, an engine action borrowed because plugins cannot define keybindings. The user binds a chord (e.g. `ctrl+u`, never an Alt chord: see step 3) to it in `~/.claude/keybindings.json`; the chord only fires if the Button is mounted, which is the only reason the button exists. If Claude Code ever gives that action its own handler, the hotkey breaks.
3. `onPress` calls `speakUsage`, which reads `$.session.usage()` and the clock, builds the sentence with `describeUsage` in `hooks/format.ts` (pure formatting: labels, reset countdowns, token counts, what this conversation used of each window, then cost), and runs `scripts/speak.ps1` through `powershell` with `-WindowStyle Hidden` and the text on **stdin** (never as an argument, so nothing is executed as a command). The window-title announcement ("cmd.exe terminal Claude Code") is NOT caused by what we spawn: it is the **Alt key** in the Windows console, which makes NVDA re-announce the window on any Alt chord, even an unbound one (alt+j did it too). With a slow-starting powershell it was merely read before the usage. So the hotkey must not use Alt/meta. A compiled helper (a `/target:winexe` exe) was tried and dropped as unnecessary: keep this a readable script, with no committed build output. A nonzero exit code or thrown error becomes a toast. `onPress` must return immediately (`void speakUsage($)`) so a slow speech call doesn't block the next press.
4. `scripts/speak.ps1` loads the `nvdaControllerClient.dll` matching PowerShell's architecture from `bin/{x64,x86,arm64}` and calls `nvdaController_cancelSpeech` then `nvdaController_speakText`. The exit code reflects NVDA's result. `$.audio.speak` is deliberately not used (no synthesizer on Windows, and it wouldn't be NVDA's voice).

Per-conversation usage: `register.tsx` keeps a module-level `Tally` (`hooks/tally.ts`) and folds every reading into it with `observe`, on each `session.measure` (after every turn) and on each press. A new `startedAt` (launch or `/clear`; the module stays loaded across `/clear`) zeroes the counts but keeps the last reading as the baseline, so the new conversation's first reply is counted. Only a `resetsAt` an hour or more later is a window roll-over (a new window resets a whole window length after the old one; a shift of minutes is the same window); a dip within a window (a reply that landed late) adds nothing and keeps the higher figure as the baseline, so the climb back is not counted twice. A window with no reset time still treats a drop as a roll-over. A false roll-over (a dip, or a reset time nudged by over a minute; which one was not recorded) once added a whole window's percentage and spoke 102 percent of Session for a conversation inside one window. Readings only change on API responses, and the very first reply after launch has no earlier baseline, so it is not counted.

The windows' percentages are account-wide, so every gain is scaled by this session's `share` (in `tally.ts`) of what all sessions spent since the last reading. Each session publishes `usage.cost.usd` (which includes subagents) under `spend:<id>` in `$.store` (the first session id the module saw, kept across `/clear` so a cost that does not reset is never counted twice) after every `turn.step` (subagent steps included) and every `session.measure`, one write at a time so an older figure never lands last, skipping a figure unchanged since the last write unless that is over an hour old; the ledger baseline only moves on with a reading whose windows moved, so a press between replies does not swallow what others spent; the store is one JSON file that concurrent sessions read live and write without losing each other's keys (both checked with two `claude -p` runs). Entries unwritten for 7 days are pruned. Gains while no session spent anything (claude.ai use) count as 0 here; with no ledger at all the share is 1. A `--plugin-dir` copy has its own store, separate from the installed plugin's.

## Conventions

- Tests: `hooks/format.test.ts` covers the pure formatter; `hooks/tally.test.ts` covers `observe`; `hooks/band.test.ts` mounts `AbovePrompt` via `$.ui.mount` (with an `on('ui.render')` stand-in for other mods) and checks the button's key/props and the terminal-only / no-survey guards.
- The spoken text intentionally omits context percentage so it isn't confused with the session percent (see recent git history).
- `bin/` contains the LGPL NVDA controller client; keep `THIRD_PARTY_NOTICES.md` and `bin/LICENSE-nvda-controller-client.txt` with it.
