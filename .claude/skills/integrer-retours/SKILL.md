---
name: integrer-retours
description: Produire le plan de la version suivante d'une vidéo à partir des commentaires horodatés de l'utilisateur sur l'aperçu. Complète proposer-plan, dont toutes les règles s'appliquent. À utiliser depuis le dossier d'un projet de creations/ dont travail/plan/contexte.md contient une section « Retours de l'utilisateur ».
---

# Intégrer les retours sur un aperçu

L'utilisateur a regardé l'aperçu d'une version et l'a commenté. Tu produis le plan de la version suivante. **Toutes les règles de `proposer-plan` s'appliquent** (sources, bornes, coupes décalées, plans de coupe, pas d'invention). Si tu travailles à la main dans une session Claude Code, lis d'abord `.claude/skills/proposer-plan/SKILL.md` à la racine du dépôt.

## Déroulé

1. Lis `travail/plan/contexte.md`, en particulier la section « Retours de l'utilisateur sur l'aperçu vN » : chaque commentaire a un numéro, l'instant dans l'aperçu (ou « toute la vidéo ») et, dans la colonne « Où », le segment concerné et l'instant correspondant dans le rush.
2. Lis le plan de cette version (`versions/vN/plan.json`) : c'est ta base. Ne change que ce que les commentaires demandent, plus ce qui en découle (un segment raccourci décale la position des plans de coupe qui suivent, par exemple). Garde tout le reste à l'identique : l'utilisateur a validé ce plan avant de le voir.
3. Pour chaque commentaire :
   - relis la transcription autour de l'instant indiqué dans le rush (et les planches si le commentaire parle de l'image) ;
   - comprends ce qui gêne : coupe trop tôt ou trop tard, passage trop long, mauvais ordre, image qui ne va pas, musique trop forte… ;
   - fais le changement le plus simple qui y répond.
4. Un commentaire flou ou impossible : fais le choix le plus prudent et explique-le dans la réponse à ce commentaire.
5. Revérifie la durée totale, les bornes, les décalages et les positions des plans de coupe, puis réponds.

## Format de la réponse

Le même plan structuré que pour `proposer-plan`, avec en plus :
- `reponsesRetours` : **une entrée par commentaire**, avec son numéro (`commentaire`) et, dans `changement`, ce que tu as changé, concrètement et en une ou deux phrases (« s4 commence 0,8 s plus tard, sur "le deuxième outil" », « musique baissée de -18 à -24 dB »). Si tu n'as rien changé, dis pourquoi ;
- `resume` : ce qui change par rapport à la version précédente, puis la stratégie d'ensemble ;
- `pointsAVerifier` : seulement ce qui reste douteux après tes changements.

## À éviter

- Repartir de zéro ou réorganiser toute la vidéo pour un commentaire local.
- Oublier un commentaire dans `reponsesRetours`.
- Annoncer un changement qui n'est pas dans le plan.
