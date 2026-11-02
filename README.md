# Éditeur vidéo local

Outil personnel qui organise, monte et découpe les vidéos et podcasts des deux chaînes. Le contexte complet est dans `CLAUDE.md`, l'étude des dépôts d'inspiration dans `docs/inspirations.md`.

## Prérequis

- Node.js 24 ou plus récent
- ffmpeg et ffprobe
- Claude Code (`claude`), connecté à l'abonnement

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm install` | Installer les dépendances |
| `npm run dev` | Mode développement : interface sur http://localhost:5173, rechargée à chaque modification |
| `npm run build` puis `npm start` | Mode normal : tout sur http://127.0.0.1:4317 |
| `npm run check` | Vérifier les types et le style (aucun `any`) |
| `npm test` | Lancer les tests |

Un lanceur à double-cliquer (`Lancer.cmd` sous Windows, `Lancer.command` sur Mac) arrivera à la fin de la phase 1.
