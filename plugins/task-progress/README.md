# task-progress

Un panneau minimaliste et repliable qui montre l'avancement du travail de Claude Code : une barre globale en haut, puis une barre fine par tâche.

## Ce qu'il affiche

- **Barre globale** : tâches terminées / total et pourcentage, plus le temps écoulé depuis le début de la session.
- **Une barre par tâche** de la liste de tâches de Claude (`TodoWrite`, `TaskCreate`, `TaskUpdate`) : titre, statut (En attente, En cours, Terminée, Erreur) et temps écoulé.
- **Outils en cours** : chaque appel d'outil en cours (Bash, Edit, etc.) avec sa durée.
- Les tâches terminées se réduisent à une ligne discrète ; une tâche en erreur passe en rouge doux.

## Pas de progression inventée

Claude ne donne pas de pourcentage à l'intérieur d'une tâche. Le mod n'en devine donc jamais :

- une tâche en attente est à 0 %, une tâche terminée à 100 % ;
- une tâche en cours, ou un outil en cours, a une durée inconnue : barre indéterminée animée, sans pourcentage ;
- sans liste de tâches, la barre globale est indéterminée pendant l'activité, et « Aucune tâche » sinon.

Une tâche passe en **Erreur** quand un appel d'outil échoue pendant qu'elle est en cours, et revient en **En cours** au prochain appel réussi.

## Installation

Depuis un terminal Claude Code :

```
/plugin marketplace add Teamfliyou/claude-mods
/plugin install task-progress@claude-mods
```

Le panneau s'ouvre au démarrage de chaque session. Hors du terminal :

```
claude plugin marketplace add Teamfliyou/claude-mods
claude plugin install task-progress@claude-mods
```

## Utilisation

- Bouton ▾ / ▸ en haut à droite du panneau, ou la commande `/progress`, pour ne montrer que la barre globale.
- Les couleurs suivent le thème clair ou sombre de Claude Code : un seul accent, les erreurs en rouge doux.

## Désactivation et désinstallation

```
/plugin disable task-progress@claude-mods
/plugin enable task-progress@claude-mods
/plugin uninstall task-progress@claude-mods
/plugin marketplace remove claude-mods
```

(en terminal : `claude plugin disable task-progress@claude-mods`, etc.). Un `/reload-plugins` applique le changement dans une session ouverte.

## Développement

```
claude plugin validate plugins/task-progress
claude plugin test plugins/task-progress
```
