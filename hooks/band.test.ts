import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'usage-hotkey',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 80 }
} as const

test('the band holds the usage button, bound to the borrowed action', async ($, on) => {
  // Stands for what another mod or Claude Code draws in the band
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['drawn by another mod'] }))

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' } as never)
  const button = await ui.find({ key: 'usage' })

  expect(button).toBeDefined()
  expect(button?.props).toMatchObject({ label: 'Speak usage', action: 'app:toggleDiffNoiseFilter' })
  // What was drawn below the button's site stays in the band
  expect(await ui.find({ type: 'Text', text: 'drawn by another mod' })).toBeDefined()
  await ui.unmount()
})

test('the band is left alone off the terminal and under a survey', async ($, on) => {
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['drawn by another mod'] }))

  const desktop = await $.ui.mount({ ...BAND, surface: 'desktop' } as never)
  expect(await desktop.find({ key: 'usage' })).toBeUndefined()
  await desktop.unmount()

  const survey = await $.ui.mount({
    ...BAND,
    props: { ...BAND.props, hasSurvey: true },
    surface: 'terminal'
  } as never)
  expect(await survey.find({ key: 'usage' })).toBeUndefined()
  await survey.unmount()
})
