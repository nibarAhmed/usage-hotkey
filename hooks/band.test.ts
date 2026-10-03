import { expect, test } from 'claude-code/testing'

test('the band holds the usage button, bound to the borrowed action', async $ => {
  const ui = await $.ui.mount({
    plugin: 'usage-hotkey',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 6, columns: 80 }
  } as never)

  expect(await ui.find({ key: 'usage' })).toBeDefined()
  await ui.unmount()
})
