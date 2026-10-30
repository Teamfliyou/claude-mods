# claude-mods

Une marketplace de mods pour Claude Code.

| Mod | Ce qu'il fait |
| --- | --- |
| `task-progress` | Panneau repliable : une barre de progression par tâche de Claude, plus une barre globale. Jamais de pourcentage inventé : une durée inconnue donne une barre indéterminée animée. |
| `mod-bar` | Bande de raccourcis au-dessus de la zone de saisie : un bouton encadré par mod (`/progress`, `/relais`…). |
| `relais` | `/relais` résume la session dans un fichier central ; dans une nouvelle session, `/relais` l'importe pour reprendre le travail. |

## Installation

Dans un terminal Claude Code :

```
/plugin marketplace add Teamfliyou/claude-mods
/plugin install task-progress@claude-mods
/plugin install mod-bar@claude-mods
/plugin install relais@claude-mods
```

Depuis un shell ordinaire : `claude plugin marketplace add Teamfliyou/claude-mods`, puis `claude plugin install <mod>@claude-mods`.

Dans l'app de bureau, où `/plugin` ne s'exécute pas : cliquez sur **+** à côté de la zone de saisie, puis **Plugins**, **Add marketplace** avec `Teamfliyou/claude-mods`, puis **Add plugin**.

## Désactivation

```
/plugin disable <mod>@claude-mods
/plugin uninstall <mod>@claude-mods
/plugin marketplace remove claude-mods
```

Chaque mod a son propre README dans `plugins/<mod>/`. Licence MIT.
