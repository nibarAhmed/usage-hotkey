import type { EngineInterface, Register } from 'claude-code'

import { describeUsage } from './format'

// An engine action with no default chord and no handler at the prompt; the
// person binds alt+u to it in keybindings.json (Global), which presses the
// Button below from anywhere.
const ACTION = 'app:toggleDiffNoiseFilter'

// Speaking goes through scripts/speak.ps1 and the NVDA controller client bundled
// under bin/ ($.audio.speak has no synthesizer on Windows, and would not be
// NVDA's voice if it had). The text goes in on stdin; the exit code is NVDA's.
const speakUsage = async ($: EngineInterface) => {
  const fail = (why: string) => $.ui.toast(`Could not speak through NVDA: ${why}`)

  try {
    const [usage, now] = await Promise.all([$.session.usage(), $.clock.now()])

    const { exitCode, stderr } = await $.process.run(
      [
        'powershell',
        ...['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass'],
        ...['-File', `${$.plugin.root}/scripts/speak.ps1`, '-Root', $.plugin.root]
      ],
      { stdin: describeUsage(usage, now) }
    )

    if (exitCode !== 0) {
      fail(stderr.trim() || `is it running? (code ${exitCode})`)
    }
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err))
  }
}

export const register: Register = on => {
  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const { Box, Button } = $.ui.resolve(e)

    // The label is a blank: the Button only has to be mounted for the chord to
    // reach it. onPress returns at once so a speech call still in flight cannot
    // hold the next press back.
    return (
      <Box>
        <Button key="usage" label=" " action={ACTION} plain onPress={() => void speakUsage($)} />
      </Box>
    )
  })
}
