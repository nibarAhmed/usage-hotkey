import type { EngineInterface, Register } from 'claude-code'

import { describeUsage } from './format'
import { observe, type Tally } from './tally'

// An engine action with no default chord and no handler at the prompt; the
// person binds a chord such as ctrl+u to it in keybindings.json (Global),
// which presses the Button below from anywhere. Not an Alt chord: in the Windows
// console Alt makes NVDA re-announce the window title (see README).
const ACTION = 'app:toggleDiffNoiseFilter'

// What this conversation has used of each window. The module stays loaded across
// a /clear (only /reload-plugins starts it over), so the last reading of the old
// conversation is the baseline of the new one.
let tally: Tally | undefined

// Every session writes what it has spent so far (subagents included) under its
// own key in the plugin's store, one JSON file that all running sessions read
// live; the tally splits the account's gains by it. An entry not written for a
// week is a session long gone.
const SPEND = 'spend:'
const STALE = 7 * 24 * 60 * 60 * 1000

type Entry = { usd: number; at: number }

// The first session id this module saw, kept across a /clear: a new id whose
// entry started at the old cost would read as all of that spent at once.
let self: Promise<string> | undefined

const me = ($: EngineInterface) => (self ??= $.session.id())

const write = async ($: EngineInterface) => {
  const [id, { cost }, at] = await Promise.all([me($), $.session.usage(), $.clock.now()])

  if (cost) {
    await $.store.set(`${SPEND}${id}`, { usd: cost.usd, at } satisfies Entry)
  }
}

// One write at a time, in order: parallel subagents finish steps together, and
// an older figure landing last would read to the other sessions as a total
// that went down, counting this session's whole spend as new.
let publishing = Promise.resolve()

const publish = ($: EngineInterface) => {
  publishing = publishing.then(() => write($)).catch(() => {})

  return publishing
}

const readLedger = async ($: EngineInterface, now: number) => {
  const ledger: Record<string, number> = {}

  const keys = (await $.store.keys()).filter(key => key.startsWith(SPEND))
  const entries = await Promise.all(keys.map(key => $.store.get(key) as Promise<Entry | undefined>))
  const stale: Promise<void>[] = []

  keys.forEach((key, i) => {
    const entry = entries[i]

    if (!entry || now - entry.at > STALE) {
      stale.push($.store.delete(key))
    } else {
      ledger[key.slice(SPEND.length)] = entry.usd
    }
  })
  await Promise.all(stale)

  return ledger
}

const track = async ($: EngineInterface) => {
  const [usage, id, now] = await Promise.all([$.session.usage(), me($), $.clock.now()])
  const ledger = await readLedger($, now)

  // Our own figure is the freshest there is, whatever the store holds yet
  if (usage.cost) {
    ledger[id] = usage.cost.usd
  }

  tally = observe(tally, usage.startedAt, usage.rateLimits, { me: id, ledger })

  return usage
}

// Speaking goes through scripts/speak.ps1 and the NVDA controller client bundled
// under bin/ ($.audio.speak has no synthesizer on Windows, and would not be
// NVDA's voice if it had). The text goes in on stdin; the exit code is NVDA's.
const speakUsage = async ($: EngineInterface) => {
  const fail = (why: string) => $.ui.toast(`Could not speak through NVDA: ${why}`)

  try {
    const [usage, now] = await Promise.all([track($), $.clock.now()])

    const { exitCode, stderr } = await $.process.run(
      [
        'powershell',
        ...['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass'],
        ...['-File', `${$.plugin.root}/scripts/speak.ps1`, '-Root', $.plugin.root]
      ],
      { stdin: describeUsage(usage, now, tally) }
    )

    if (exitCode !== 0) {
      fail(stderr.trim() || `is it running? (code ${exitCode})`)
    }
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err))
  }
}

export const register: Register = on => {
  // After every response, a subagent's too: keeps this session's spend current
  // for the other sessions, so a long turn here is not counted as theirs. Not
  // awaited, so the next step never waits on the store.
  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    void publish($)

    return result
  })

  // After each turn: counts every reply, including the first after a /clear.
  // Publishes too, as the cost a step adds may land only after its turn.step.
  on('session.measure', async ($, e, next) => {
    void publish($)
    await track($)

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // The chord only reaches a Button on the terminal, and a survey holds the band.
    if (e.surface !== 'terminal' || e.props.hasSurvey) {
      return next(e)
    }

    const { Box, Button } = $.ui.resolve(e)
    const rest = await next(e)

    // The Button only has to be mounted for the chord to reach it, so it is drawn
    // inside a display="none" Box: present, never shown. It keeps a label as its
    // name. onPress returns at once so a speech call still in flight cannot hold
    // the next press back. What other hooks drew stays above it.
    return (
      <Box flexDirection="column">
        {rest}
        <Box display="none">
          <Button key="usage" label="Speak usage" action={ACTION} plain onPress={() => void speakUsage($)} />
        </Box>
      </Box>
    )
  })
}
