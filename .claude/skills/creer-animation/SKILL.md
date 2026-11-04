---
name: creer-animation
description: Créer ou améliorer une animation Remotion de l'outil (texte à l'écran, et plus tard cartouche nom, bouton abonnement, logo animé) dans le workspace animations/, d'après le guide « Animations » de l'utilisateur, puis la vérifier sur images avant de la livrer. À utiliser dans une session Claude Code ouverte sur le dépôt, quand l'utilisateur demande une nouvelle animation, un nouveau style de texte ou trouve une animation ratée.
---

# Créer ou améliorer une animation

Les animations de l'outil sont des composants React rendus par Remotion. Elles servent deux fois : en aperçu en direct dans l'éditeur du plan (`@remotion/player`) et au rendu, où chacune devient un clip transparent incrusté par ffmpeg sur la vidéo. Le code n'est jamais la difficulté : c'est le **savoir-faire du mouvement** qui fait la différence entre une animation de monteur et un fondu générique.

## Où sont les choses

- `animations/src/theme.ts` : courbes d'accélération, ressorts et durées. **Seule source** des valeurs de mouvement.
- `animations/src/TexteAnime.tsx` : le composant des textes à l'écran (apparitions, fonds, mots mis en valeur, taille ajustée à la largeur).
- `animations/src/compositions.ts` : identifiants et propriétés des compositions (types partagés avec le backend).
- `animations/src/Racine.tsx` : enregistrement des compositions (dimensions, cadence et durée calculées depuis les propriétés).
- `shared/src/plans.ts` : `APPARITIONS_TEXTE`, `FONDS_TEXTE`, leurs libellés et le schéma que Claude remplit dans les plans.
- `backend/src/rendu/textes.ts` : rendu de chaque texte en ProRes 4444 transparent ; `backend/src/rendu/graphe.ts` : incrustation (SDR et HLG).
- `frontend/src/pages/projets/Habillage.tsx` et `ApercuTexte.tsx` : réglages et aperçu animé.
- `scripts/controle-animations.ts` : planche de contrôle.
- `creations/guides/animations/` : le guide de l'utilisateur (`style.md`) et ses références analysées (`inspiration/analyses/*/analyse.md`, images dans `mouvement/`).

## Déroulé

1. Lis `creations/guides/animations/style.md` et les `analyse.md` des références (le chemin de `creations/` est dans `config.local.json`). Ce que l'utilisateur aime passe avant tes préférences.
2. Lis `theme.ts`, `TexteAnime.tsx` et `compositions.ts` en entier avant de modifier quoi que ce soit.
3. Décris en quelques lignes le mouvement voulu, en images à 30 i/s : propriétés animées, durée d'entrée, décalage entre éléments, maintien, sortie.
4. Écris ou modifie le composant en respectant les règles ci-dessous.
5. Pour une nouvelle apparition ou un nouveau fond : ajoute la valeur et son libellé dans `shared/src/plans.ts` (avec la description du schéma, que Claude lit pour choisir), puis la ligne d'exemple apparaît d'elle-même dans la planche de contrôle. Mets à jour la skill `proposer-plan` (quand l'utiliser) et le README.
6. **Vérifie** (obligatoire, voir plus bas), corrige, revérifie.
7. Lance `npm run check` et `npm test`.

## Règles

1. **Jamais d'interpolation linéaire.** Chaque `interpolate` reçoit une courbe de `theme.ts` (`COURBES`) et est borné (`LIMITE`) ; les entrées vivantes passent par `spring` avec un ressort de `RESSORTS`.
2. **Une entrée anime deux ou trois propriétés ensemble** (opacité + montée + échelle, ou flou). Un fondu seul est interdit.
3. **Décale** les éléments qui arrivent ensemble : 3 images entre deux mots à 30 i/s, 4 à 5 entre des blocs. Toujours calculé depuis `fps`.
4. **Les sorties existent et sont plus rapides que les entrées** (environ deux fois).
5. **Les maintiens sont voulus** : un mouvement vif, puis une vraie immobilité, puis le suivant. Une respiration très lente est permise sur un texte qui reste plus de 2 s.
6. **Toutes les durées dérivent de `fps`** (`useVideoConfig`) : le même composant est rendu à 30 i/s en aperçu et jusqu'à 60 i/s à l'export.
7. **Aucune valeur de mouvement ni couleur en dur** : courbes, ressorts et durées dans `theme.ts` ; couleurs dans `StyleTextes` (réglages de l'utilisateur).
8. **Polices de l'utilisateur uniquement**, chargées par l'URL fournie dans les propriétés (jamais `@remotion/google-fonts` ni une police système en dur).
9. **Fond transparent** : le composant ne dessine jamais de fond plein, de grain ni de vignette ; il est posé sur la vidéo.
10. **Déterministe** : pas de `Math.random()` ni d'horloge ; utilise `random(graine)` de Remotion si besoin.
11. **Lisible sur n'importe quelle image** : contour et ombre, ou étiquette ; une seule couleur héroïne (accent) par instant ; texte dans la zone sûre (pour le 9:16, au milieu des 75 % verticaux) et jamais au bord.
12. Pas d'émoji comme icône : dessine en CSS ou SVG aux couleurs du thème.

## Vérification (obligatoire)

```bash
node scripts/controle-animations.ts <sortie.png> [police.ttf]
```

Le script rend chaque apparition et chaque fond à cinq instants (0,1 s, 0,25 s, 0,5 s, 1 s, 1,9 s) et les assemble en une planche sur fond gris. Ouvre l'image et regarde **chaque vignette** :
- rien de visible avant son entrée, rien après sa sortie ;
- pas de cadre ou d'étiquette vide en avance sur son texte ;
- pas de texte coupé ou collé au bord, pas de chevauchement ;
- la mise en valeur tombe sur le bon mot, au bon moment ;
- les tailles et les écarts sont cohérents d'un style à l'autre.

Corrige, relance, regarde de nouveau. Ne livre qu'après une planche propre. Pour un contrôle sur vraie vidéo, rends un aperçu d'un projet de test et extrais des images avec `ffmpeg -ss <t> -i apercu.mp4 -frames:v 1 image.png`.

## À éviter

- Un composant géant : découpe en petits composants réutilisables quand une animation grandit.
- Une durée de composition qui ne correspond pas au contenu (temps mort à la fin).
- `em` pour l'écart entre deux grands blocs flex (il dépend de la taille du parent) : préfère des pixels calculés depuis la hauteur.
- Décrire le résultat à l'utilisateur sans l'avoir rendu et regardé.
