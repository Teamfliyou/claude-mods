import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'mod-bar',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10 },
} as const

test('un bouton par raccourci lance sa commande', async ($, on) => {
  const ran: string[] = []
  on('command.run', (_, e) => {
    ran.push(e.command)
    return { text: 'ok' }
  })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Button', key: 'mod-progress' })).toBeTruthy()
    await ui.press({ plugin: 'mod-bar', key: 'mod-progress' })
    await ui.unmount()
  }
  expect(ran).toEqual(['progress', 'progress'])
})

test('rien pendant un sondage', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, hasSurvey: true }, surface: 'desktop' })
  expect(await ui.find({ type: 'Button' })).toBeFalsy()
  await ui.unmount()
})
