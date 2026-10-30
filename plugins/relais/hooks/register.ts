import type { EngineInterface, Register } from 'claude-code'

const FILE = 'RELAIS.md'

// Defence in depth: the model is told never to write secrets, and whatever it
// writes is scrubbed again before it reaches the chat, the file or the clipboard.
const MASK = '[SECRET-MASQUÉ]'
const SECRETS: Array<[RegExp, string]> = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, MASK],
  [/\bsk-[A-Za-z0-9_-]{16,}/g, MASK],
  [/\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}/g, MASK],
  [/\bAKIA[0-9A-Z]{16}\b/g, MASK],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}/g, MASK],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, MASK],
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{12,}/gi, `$1 ${MASK}`],
  [
    /\b([A-Za-z0-9_.-]*(?:password|passwd|pwd|secret|token|api[_-]?key|apikey|auth)[A-Za-z0-9_.-]*)(\s*[:=]\s*)(["']?)[^\s"',;]{4,}\3/gi,
    `$1$2${MASK}`,
  ],
  [/(:\/\/[^\s:@/]+:)[^\s@/]{3,}(@)/g, `$1${MASK}$2`],
]

function redact(text: string): string {
  return SECRETS.reduce((out, [re, to]) => out.replace(re, to), text)
}

const pad = (n: number) => String(n).padStart(2, '0')
function stamp(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function ask(facts: string): string {
  return `Rédige maintenant un résumé de passage de relais de CETTE session, en français, destiné à être collé dans une nouvelle session qui n'a rien vu.

Règles strictes :
- Ne mentionne que ce qui s'est réellement passé dans la session ci-dessus. N'invente rien : si une information n'existe pas, écris « non précisé ».
- Pas de remplissage. Autonome : la prochaine session doit pouvoir reprendre sans poser de questions.
- N'inclus JAMAIS de secret, clé d'API, token, mot de passe ou identifiant de connexion. Si une variable est nécessaire, donne son NOM seulement.
- Chemins de fichiers exacts, tels qu'ils ont été utilisés.

Format exact, en Markdown, sans rien avant ni après :

Voici le contexte de la session précédente, reprends à partir de là. (un court paragraphe d'instruction adressé à la prochaine session : quoi lire, par quoi commencer)

## 1. Objectif
## 2. Ce qui est fait
(actions réalisées, fichiers créés ou modifiés avec chemins exacts, commandes importantes lancées)
## 3. Décisions et raisons
(y compris pistes abandonnées et pourquoi)
## 4. État actuel
(ce qui fonctionne, ce qui est cassé, erreurs non résolues)
## 5. Prochaines étapes
(liste numérotée ; la toute prochaine action en premier)
## 6. Contexte technique
(dossier de travail, branche git, versions, dépendances, variables ou configurations à connaître, sans secrets)
## 7. Consignes
(préférences et contraintes exprimées par l'utilisateur pendant la session)

Faits relevés par le plugin, à utiliser pour la section 6 :
${facts}`
}

async function facts($: EngineInterface): Promise<string> {
  const lines: string[] = []
  try {
    lines.push(`- Dossier de travail : ${await $.session.cwd()}`)
  } catch {}
  try {
    lines.push(`- Racine du projet : ${await $.session.root()}`)
  } catch {}
  try {
    const r = await $.process.run(['git', 'branch', '--show-current'])
    if (r.exitCode === 0 && r.stdout.trim()) lines.push(`- Branche git : ${r.stdout.trim()}`)
  } catch {}
  try {
    lines.push(`- Modèle : ${await $.session.model()}`)
  } catch {}
  return lines.length ? lines.join('\n') : '- non disponibles'
}

// One fixed place, whatever the project: <home>/RELAIS/RELAIS.md. A new
// session, in any folder, finds the same file.
async function folderOf($: EngineInterface): Promise<string> {
  const home = ((await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? '').replace(/[\\/]+$/, '')
  return `${home}/RELAIS`
}

async function pathOf($: EngineInterface): Promise<string> {
  return `${await folderOf($)}/${FILE}`
}

async function importer($: EngineInterface) {
  const path = await pathOf($)
  const doc = await $.fs.read(path).catch(() => '')
  if (!doc) {
    return { text: `Aucun relais trouvé (${path}). Lancez /relais dans l'ancienne session.` }
  }

  return {
    text: `Relais importé depuis ${path}. Je reprends à partir de là.`,
    context: [
      `Contexte de la session précédente (lu depuis ${path}). Reprends le travail à partir de là, sans reposer de questions déjà tranchées, et commence par la section « Prochaines étapes ».\n\n${redact(doc)}`,
    ],
  }
}

export const register: Register = on => {
  let last = ''

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'relais',
      description: 'Génère un résumé de passage de relais (RELAIS.md). « /relais copier » le copie.',
    })
    await $.command.register({
      name: 'reprendre',
      description: 'Reprend le travail à partir du dernier RELAIS.md',
    })

    return next(e)
  })

  on('command.run', { command: 'relais' }, async ($, e) => {
    const path = await pathOf($)
    const arg = (e.args ?? '').trim().toLowerCase()

    // In a session with no prompt yet, /relais imports the saved file; once
    // work has begun it creates it. "importer" and "nouveau" force either.
    const isFresh = (await $.session.turns()) === 0
    if (arg.startsWith('importer') || (arg === '' && isFresh && (await $.fs.exists(path)))) {
      return importer($)
    }

    if (arg.startsWith('copier')) {
      let text = last
      if (!text) text = await $.fs.read(path).catch(() => '')
      if (!text) return { text: 'Rien à copier : lancez d’abord /relais.' }
      const r = await $.ui.copy({ text })
      return {
        text: r.isCopied
          ? 'Relais copié dans le presse-papiers.'
          : `Copie impossible (${r.reason}). Le contenu est dans ${path}.`,
      }
    }

    const reply = await $.model.fork({ prompt: ask(await facts($)) })
    if (!reply.isAnswered && reply.reason === 'nothing-to-fork') {
      return { text: 'Session vide : rien à résumer pour l’instant.' }
    }
    if (!reply.isAnswered) {
      return { text: `Résumé impossible (${reply.reason}). Réessayez /relais.` }
    }

    const now = await $.clock.now()
    const doc = `# RELAIS — ${stamp(now)}\n\n${redact(reply.text.trim())}\n`
    last = doc

    let where = path
    try {
      await $.fs.write(path, doc)
      // A dated copy stays beside it, so earlier handoffs are not lost.
      await $.fs.write(`${await folderOf($)}/RELAIS-${stamp(now).replace(' ', '_').replace(':', 'h')}.md`, doc)
    } catch {
      where = 'non enregistré (écriture refusée)'
    }

    return {
      text: `${doc}\n---\nEnregistré dans ${where}. Dans une nouvelle session, tapez /relais pour l'importer. « /relais copier » le copie dans le presse-papiers.`,
    }
  })

  on('command.run', { command: 'reprendre' }, async $ => importer($))
}
