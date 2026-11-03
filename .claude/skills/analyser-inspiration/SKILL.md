---
name: analyser-inspiration
description: Analyser une vidéo de référence (format court ou long) déposée dans guides/<catégorie>/inspiration/videos, à partir de son profil chiffré, de sa transcription et de ses planches d'images, pour en tirer ce qui la rend efficace. À utiliser depuis son dossier guides/<catégorie>/inspiration/analyses/<vidéo>/.
---

# Analyser une vidéo d'inspiration

Un créateur de contenu te montre une vidéo qu'il trouve réussie. Tu ne la regardes pas : tu la lis et tu la vois à travers des fichiers préparés. Ton travail est d'expliquer **concrètement** pourquoi elle fonctionne et ce qu'il peut en reprendre dans ses propres montages. Ton analyse servira ensuite à proposer ses plans de montage.

## Les fichiers (dossier courant)

- `profil.json` : mesures objectives. Durée, résolution, nombre de coupes et coupes par minute, durées des plans (moyenne, médiane, plus long), instant de la première coupe, mots par minute, instant du premier mot, part du temps où l'on parle, plus long silence.
- `transcription.md` (si la vidéo est parlée) : le texte horodaté. `[début-fin]` pour chaque passage, `{t}` pour l'horaire d'un mot, `(pause …)` pour un silence mesuré.
- `coupes/coupes-XX.jpg` : la première image, puis une vignette juste après chaque changement de plan, avec son horaire (en secondes et dixièmes). Ce sont elles qui montrent le **montage** : cadrages, zooms, inserts, textes.
- `planches/planche-XX.jpg` : une vignette à intervalle régulier (horaire en haut à gauche), pour suivre le déroulé.

## Déroulé

1. Lis `profil.json`, puis la transcription si elle existe.
2. Regarde **toutes** les images de `coupes/`, puis les planches.
3. Repère, avec les horaires :
   - **l'accroche** : ce qui se passe dans les 1 à 3 premières secondes (image, phrase, texte à l'écran), et pourquoi on ne balaie pas ;
   - **la structure** : les grandes parties et la chute ;
   - **le rythme** : fréquence des coupes, plans longs ou courts, accélérations, débit de parole, silences ;
   - **le montage visuel** : cadrages (face caméra, plans serrés, inserts), zooms progressifs ou brusques, « loupe » sur un détail, recadrages, transitions, effets ;
   - **les textes à l'écran** : sous-titres (style, nombre de mots, position, mot surligné), titres, flèches, émojis ;
   - **le son** : musique (présence, changements), bruitages, silences ;
   - **la rétention** : boucle (la fin raccorde au début pour donner envie de revoir), question posée et réponse retardée, promesse tenue à la fin, appel à l'action.
4. Distingue ce que tu **vois ou mesures** de ce que tu **supposes** (le son, par exemple, tu ne l'entends pas : déduis-le des niveaux et du texte, et dis-le).

## Format de la réponse

- `resume` : trois à cinq phrases. Ce qui fait l'efficacité de la vidéo et ce que le créateur peut en reprendre.
- `techniques` : une technique par ligne, concrète, horodatée quand c'est possible, réutilisable dans un autre montage. Par exemple : « Zoom brusque ×1,5 sur le visage à 0:04 pour souligner la chute », « Sous-titres de deux mots, mot prononcé en jaune, au tiers inférieur », « Boucle : la dernière phrase reprend la première ».
- `analyse` : l'analyse complète en Markdown, avec les sections **Accroche**, **Structure**, **Rythme**, **Visuels et montage**, **Textes à l'écran**, **Son**, **Ce qu'on retient**. Cite les horaires et les chiffres du profil.

## À éviter

- Les généralités (« vidéo dynamique », « bonne énergie ») : dis ce qui la rend dynamique, avec des chiffres et des horaires.
- Décrire une image que tu n'as pas vue sur une vignette.
- Recopier de longs passages de la transcription : cite seulement les phrases clés.
