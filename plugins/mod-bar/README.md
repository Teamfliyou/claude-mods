# mod-bar

Une bande de raccourcis au-dessus de la zone de saisie : un bouton par mod, qui lance sa commande slash en un clic.

## Installation

```
/plugin marketplace add Teamfliyou/claude-mods
/plugin install mod-bar@claude-mods
```

## Ajouter vos mods

Chaque mod expose une commande slash (task-progress : `/progress`). Dans le menu de configuration du mod, le champ **Raccourcis** liste les commandes à afficher, séparées par des virgules, sans le « / » :

```
progress,autre-mod,encore-un
```

Par défaut : `progress,relais`. Chaque bouton est encadré. Une modification recharge le mod. La bande se cache pendant un sondage.

## Désactivation

```
/plugin disable mod-bar@claude-mods
/plugin uninstall mod-bar@claude-mods
```
