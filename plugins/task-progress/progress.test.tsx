import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'task-progress',
  component: 'Pane',
  requestId: 'task-progress',
  props: {
    title: 'Progression',
    isFocused: false,
    bodyColumns: 50,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const surfaces = ['terminal', 'desktop', 'vscode', 'mobile'] as const

test('liste de tâches : succès, en cours, en attente, erreur, durée inconnue', async ($, on) => {
  on('command.register', () => ({ value: { command: 'progress' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('clock.now', () => ({ value: Date.now() }))
  on('clock.every', () => ({ value: { cancel: () => {} } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  let fail = false
  on('tool.call', () => (fail ? { result: {}, isError: true } : { result: {} }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({
    tool: 'TodoWrite',
    todos: [
      { content: 'Lire le code', status: 'completed', activeForm: 'Lecture' },
      { content: 'Écrire le mod', status: 'in_progress', activeForm: 'Écriture' },
      { content: 'Publier', status: 'pending', activeForm: 'Publication' },
    ],
  })

  for (const surface of surfaces) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /1\/3 · 33%/ }))?.text).toMatch(/33%/)
    expect(await ui.find({ type: 'Text', text: /Lire le code/ })).toBeTruthy()
    expect((await ui.find({ type: 'Text', text: /En cours · / }))?.text).toBeTruthy()
    expect((await ui.find({ type: 'Text', text: /En attente/ }))?.text).toBeTruthy()
    await ui.unmount()
  }

  // A failing tool call while a task runs turns it into an error.
  fail = true
  await $.tool.call({ tool: 'Bash', command: 'boom' })
  for (const surface of surfaces) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /Erreur/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /1 en erreur/ })).toBeTruthy()
    await ui.unmount()
  }

  // The next success clears it.
  fail = false
  await $.tool.call({ tool: 'Bash', command: 'ok' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Erreur · / })).toBeFalsy()
  await ui.unmount()
})

test('sans tâche : aucune progression inventée', async ($, on) => {
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('clock.now', () => ({ value: Date.now() }))
  on('clock.every', () => ({ value: { cancel: () => {} } }))
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /Aucune tâche/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /%/ })).toBeFalsy()
  await ui.unmount()
})

test('le panneau se replie', async ($, on) => {
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('clock.now', () => ({ value: Date.now() }))
  on('clock.every', () => ({ value: { cancel: () => {} } }))
  on('tool.call', () => ({ result: {} }))
  await $.tool.call({
    tool: 'TodoWrite',
    todos: [{ content: 'Une tâche', status: 'in_progress', activeForm: 'x' }],
  })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /Une tâche/ })).toBeTruthy()
  await ui.press({ plugin: 'task-progress', key: 'toggle' })
  expect(await ui.find({ type: 'Text', text: /Une tâche/ })).toBeFalsy()
  expect(await ui.find({ type: 'Text', text: /0\/1/ })).toBeTruthy()
  await ui.unmount()
})
