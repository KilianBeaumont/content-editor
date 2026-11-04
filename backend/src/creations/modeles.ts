import { LIBELLES_CATEGORIES, type Categorie } from "@editeur/shared";

const STRUCTURE_RECIT = `1. Accroche (0-15 s)
2. Mise en place de l'univers
3. Montée de tension
4. Climax
5. Fin et appel vers la chaîne / l'auteur`;

export function modeleStyle(categorie: Categorie): string {
  const structure = categorie === "recit" ? STRUCTURE_RECIT : "1. Accroche (0-15 s)\n2.\n3.";
  return `# Style : ${LIBELLES_CATEGORIES[categorie]}

## Objectif
Ce que le spectateur doit ressentir.

## Structure
${structure}

## Rythme
- Durée moyenne d'un plan :
- Moments de silence :
- Débit de narration :

## Visuels
- Type d'images :
- Mouvements (zoom lent, panoramique) :
- Textes à l'écran :

## Son
- Musique :
- Ambiances sonores :
- Niveau de la voix par rapport à la musique :

## À éviter

## Références
Liste des vidéos d'inspiration et ce qu'on en retient pour chacune.
`;
}

export const MODELE_STYLE_ANIMATIONS = `# Style : animations

## Énergie
Vif et rebondi, ou doux et posé ? Différent selon la chaîne ?

## Entrées
- Mouvement préféré (pop, mot à mot, glisse, machine à écrire, fondu) :
- Vitesse :

## Sorties et maintiens
- Durée d'affichage d'un titre :
- Sortie :

## Typographie
- Police (dans la bibliothèque) :
- Majuscules, graisse, contour, étiquette :

## Couleurs
- Couleur d'accent et mots mis en valeur :

## À éviter

## Références
Liste des vidéos d'inspiration et ce qu'on en retient pour chacune.
`;

export function modeleHooks(categorie: Categorie): string {
  return `# Hooks : ${LIBELLES_CATEGORIES[categorie]}

## Types d'accroche qui marchent
- Commencer au milieu de l'action
- Une question sans réponse
- Une phrase étrange sortie de l'histoire

## Exemples validés
Accroches déjà utilisées et leurs résultats (stat d'accroche : CTR, vus vs balayés).

## Règles
- Durée maximale avant la première information forte :
`;
}
