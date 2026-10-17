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

const track = async ($: EngineInterface) => {
  const usage = await $.session.usage()
  tally = observe(tally, usage.startedAt, usage.rateLimits)

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
  // After each turn: counts every reply, including the first after a /clear.
  on('session.measure', async ($, e, next) => {
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
