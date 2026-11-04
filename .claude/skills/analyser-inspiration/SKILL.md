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

## Cas particulier : guide « Animations (Remotion) »

Quand le prompt indique le guide `animations`, la vidéo est une référence de **motion design** : ce qui compte, c'est la manière dont les textes et les éléments graphiques bougent, pas le montage ni le récit. Ton analyse servira à créer ou améliorer les composants animés de l'outil (écrits avec Remotion) et à choisir les animations des textes dans les plans.

Un dossier de plus : `mouvement/mouvement-XX.jpg`, les 24 premières secondes décomposées à six images par seconde (horaire en secondes et dixièmes sur chaque vignette). Regarde-les **toutes**, dans l'ordre : c'est là que tu vois les animations image par image.

Repère, avec les horaires et en nombre d'images à 30 images par seconde quand c'est possible :
- **les entrées** : quelles propriétés bougent ensemble (opacité, montée, échelle, rotation, flou, masque), leur durée, s'il y a un dépassement puis un retour (rebond, ressort) ou une décélération douce ;
- **les décalages** : les mots, lettres ou éléments arrivent-ils les uns après les autres, avec quel écart ;
- **les sorties** : leur durée par rapport aux entrées, leur direction ;
- **les maintiens** : les moments d'immobilité entre deux mouvements, et le micro-mouvement éventuel (respiration, flottement) ;
- **la typographie** : graisse, casse, taille par rapport à l'image, interlettrage, contour, ombre, lueur, étiquette ou surlignage derrière un mot ;
- **les couleurs** : base, couleur héroïne (combien d'éléments la portent à la fois), contraste avec la vidéo dessous ;
- **la place** : zones de l'image utilisées, marges, zone sûre des formats verticaux ;
- **le lien avec le son** : animations calées sur la voix, un temps de la musique ou un bruitage.

Dans `techniques`, écris des recettes reproductibles en code, par exemple : « Entrée mot par mot : chaque mot monte de 30 % de sa hauteur avec un ressort sans dépassement, 3 images d'écart », « Mot-clé : étiquette jaune qui grandit derrière le mot 5 images après son arrivée », « Sortie en 8 images, deux fois plus rapide que l'entrée, vers le haut ».

Dans `analyse`, utilise les sections **Entrées**, **Décalages et rythme**, **Sorties et maintiens**, **Typographie**, **Couleurs et place**, **Son**, **Ce qu'on retient pour nos animations**.
