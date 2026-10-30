# relais

Génère un résumé de passage de relais de la session en cours, à coller dans une nouvelle session pour reprendre le travail avec tout le contexte utile.

## Installation

```
/plugin marketplace add Teamfliyou/claude-mods
/plugin install relais@claude-mods
```

## Utilisation

Un seul fichier, toujours au même endroit, quel que soit le projet : `RELAIS\RELAIS.md` dans votre dossier personnel (par exemple `C:SERS<VOUS>RELAISRELAIS.MD`). Chaque résumé est aussi gardé en copie datée à côté (`RELAIS-2026-10-30_22h05.md`).

- **`/relais` dans la session en cours** : crée ou remplace le fichier, et affiche le résumé dans le chat.
- **`/relais` dans une nouvelle session** (avant votre premier message) : importe le fichier et reprend à partir de là.
- `/relais importer` : force l'import, même au milieu d'une session.
- `/relais copier` : copie le dernier résumé dans le presse-papiers.
- `/reprendre` : équivalent de l'import.
- Le bouton `/relais` de la bande `mod-bar` fait la même chose.

## Contenu

Objectif, ce qui est fait (chemins exacts), décisions et raisons, état actuel, prochaines étapes, contexte technique (dossier, branche git, versions), consignes. Il commence par un paragraphe d'instruction adressé à la prochaine session. Le résumé ne reprend que ce qui s'est passé dans la session.

## Secrets

Le modèle reçoit l'ordre de ne jamais écrire de secret, et le texte est ensuite filtré (clés `sk-`, tokens GitHub/Slack/AWS, JWT, `Bearer`, `password=`, URL avec mot de passe, clés privées). Relisez tout de même `RELAIS.md` avant de le partager.

## Désactivation

```
/plugin disable relais@claude-mods
/plugin uninstall relais@claude-mods
```
