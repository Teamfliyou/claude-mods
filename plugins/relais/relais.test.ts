import { expect, test } from 'claude-code/testing'

const FAKE_SK = 's' + 'k-abcdefghijklmnopqrstuvwxyz123456'
const FAKE_GH = 'gh' + 'p_abcdefghijklmnopqrstuvwxyz0123456789'
const REPLY = `Voici le contexte de la session précédente, reprends à partir de là.

## 1. Objectif
Créer un mod.
## 5. Prochaines étapes
1. Tester
## 6. Contexte technique
API_KEY=${FAKE_SK} et password: hunter22secret, ${FAKE_GH}
postgres://admin:superpass@db.local/x`

const norm = (p: string) => p.replace(/\\/g, '/')

test('/relais crée le fichier central, masque les secrets ; une nouvelle session l’importe', async ($, on) => {
  const files: Record<string, string> = {}
  let copied = ''
  let turns = 3
  let forks = 0
  on('command.register', () => ({ value: { command: 'x' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.root', () => ({ value: '/proj' }))
  on('session.cwd', () => ({ value: '/proj' }))
  on('session.model', () => ({ value: 'sonnet' }))
  on('session.turns', () => ({ value: turns }))
  on('env.get', () => ({ value: '/home/zay' }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: 'main\n', stderr: '' } }))
  on('clock.now', () => ({ value: Date.UTC(2026, 9, 30, 12, 0) }))
  on('model.fork', () => {
    forks += 1
    return { value: { isAnswered: true, text: REPLY, usage: {} } }
  })
  on('fs.write', (_, e) => {
    files[norm(e.path)] = e.text
    return { value: undefined }
  })
  on('fs.read', (_, e) => ({ value: files[norm(e.path)] ?? '' }))
  on('fs.exists', (_, e) => ({ value: norm(e.path) in files }))
  on('ui.copy', (_, e) => {
    copied = e.text
    return { value: { isCopied: true } }
  })

  await $.session.start({ cwd: '/proj', surface: 'terminal', isInteractive: true })

  // Session en cours : /relais crée.
  const r = await $.command.run({ command: 'relais' })
  const paths = Object.keys(files)
  const main = paths.find(p => p.endsWith('/RELAIS/RELAIS.md'))
  expect(main).toBeTruthy()
  expect(paths.filter(p => /\/RELAIS\/RELAIS-2026-10-30_\d\dh\d\d\.md$/.test(p))).toHaveLength(1)
  const doc = files[main as string]
  expect(doc).toContain('# RELAIS — ')
  expect(doc).toContain('Voici le contexte de la session précédente')
  for (const bad of ['sk-abcdef', 'hunter22', 'ghp_abcdef', 'superpass']) {
    expect(doc).not.toContain(bad)
    expect(r.text).not.toContain(bad)
  }
  expect(doc).toContain('[SECRET-MASQUÉ]')

  await $.command.run({ command: 'relais', args: 'copier' })
  expect(copied).toBe(doc)

  // Nouvelle session (aucun prompt) : /relais importe, sans résumer.
  turns = 0
  const imp = await $.command.run({ command: 'relais' })
  expect(imp.text).toContain('Relais importé')
  expect(imp.context?.[0]).toContain('Prochaines étapes')
  expect(forks).toBe(1)
})

test('/reprendre relit le fichier comme contexte ; sans fichier, le dit', async ($, on) => {
  let content = '# RELAIS — x\n\n## 5. Prochaines étapes\n1. Tester'
  on('env.get', () => ({ value: '/home/zay' }))
  on('fs.read', () => ({ value: content }))
  const r = await $.command.run({ command: 'reprendre' })
  expect(r.context?.[0]).toContain('Prochaines étapes')

  content = ''
  const none = await $.command.run({ command: 'reprendre' })
  expect(none.text).toContain('Aucun relais trouvé')
})
