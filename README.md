# Éditeur vidéo local

Outil personnel qui organise, monte et découpe les vidéos et podcasts des deux chaînes, puis range chaque version dans le bon dossier. Tout se pilote depuis une interface web locale. La publication reste manuelle.

Ce fichier est le **guide d'utilisation** : quoi faire, dans quel ordre, pour chaque tâche. Il est complété à chaque étape du développement. Le contexte complet du projet est dans `CLAUDE.md`, l'étude des dépôts d'inspiration dans `docs/inspirations.md`.

## Sommaire

1. [Ce qui est disponible aujourd'hui](#ce-qui-est-disponible-aujourdhui)
2. [Installer l'outil sur une machine](#installer-loutil-sur-une-machine)
3. [Lancer l'outil](#lancer-loutil)
4. [Où sont les fichiers](#où-sont-les-fichiers)
5. [Guide par tâche](#guide-par-tâche)
6. [Règles à connaître](#règles-à-connaître)
7. [En cas de problème](#en-cas-de-problème)
8. [Développement](#développement)

## Ce qui est disponible aujourd'hui

Phase 1 (le socle), en cours.

| Étape | Contenu | État |
| --- | --- | --- |
| 0 | Squelette du dépôt | ✅ |
| 1 | Configuration et arborescence de `creations/` | ✅ |
| 2 | Écran Paramètres, vérification des programmes et de Claude | ✅ |
| 3 | Fiches artistes, accords et preuves | ✅ |
| 4 | Fiches auteurs et autrices | ✅ |
| 5 | Bibliothèque d'assets | à venir |
| 6 | Inbox : rushes déposés ou glissés dans l'interface | à venir |
| 7 | Création d'un projet | à venir |
| 8 | Règles d'autorisation avant export | à venir |
| 9 | Tableau de bord et écran Projet | à venir |
| 10 | Modifier, renommer, supprimer un projet | à venir |
| 11 | Lanceur à double-cliquer (Windows et Mac) | à venir |

Les phases suivantes (transcription, plan de montage, aperçus, exports, formats courts, podcast, statistiques) viendront après.

## Installer l'outil sur une machine

À faire une seule fois par ordinateur (PC Windows et MacBook).

1. Installer les programmes nécessaires :
   - **Node.js 24** ou plus récent ;
   - **ffmpeg** et **ffprobe** ;
   - **Claude Code** (`claude`), puis s'y connecter avec l'abonnement Claude (`claude` dans un terminal, puis suivre la connexion). Ne jamais créer ni renseigner de clé API.
   - whisper.cpp viendra en phase 2 : il n'est pas encore utilisé.
2. Dans le dossier du dépôt : `npm install`.
3. Lancer l'outil (voir ci-dessous) et ouvrir l'écran **Paramètres**.
4. Section **Cette machine** :
   - **Dossier creations** : l'emplacement de tes créations. Par défaut `../creations`, à côté du dépôt. S'il n'existe pas, il est créé avec toute l'arborescence quand tu enregistres.
   - Chemins de **ffmpeg**, **ffprobe**, **claude** et **whisper** : laisse le nom seul si le programme est trouvé, sinon mets le chemin complet. Chaque champ affiche si le programme est trouvé, avec sa version.
   - **Enregistrer**, puis **Revérifier les programmes** si tu as installé quelque chose entre-temps.
5. Section **Claude** : **Tester la connexion**. Le résultat doit indiquer l'abonnement (pas de clé API) et affiche ton utilisation sur 5 heures et sur 7 jours.

Ces réglages sont propres à chaque machine (fichier `config.local.json`, jamais partagé). Les **Réglages communs** (préréglages d'export, modèle de transcription, modèle Claude, rendus simultanés) sont enregistrés dans `creations/parametres.json` et suivent le dossier `creations/`.

## Lancer l'outil

| Usage | Commande | Adresse |
| --- | --- | --- |
| Normal | `npm run build` (une fois après chaque mise à jour), puis `npm start` | http://127.0.0.1:4317 |
| Développement | `npm run dev` | http://localhost:5173 |

Pour arrêter : `Ctrl+C` dans le terminal. Si l'outil affiche « Le port 4317 est déjà utilisé », il tourne déjà dans une autre fenêtre.

Au démarrage, l'outil affiche le dossier `creations/` utilisé et crée ce qui manque dans l'arborescence, sans jamais écraser un fichier existant.

Un lanceur à double-cliquer (`Lancer.cmd` sous Windows, `Lancer.command` sur Mac) arrivera à l'étape 11.

## Où sont les fichiers

Tout ton contenu vit dans `creations/`, en dehors du dépôt. Les fichiers JSON et Markdown restent lisibles et modifiables à la main.

| Dossier ou fichier | Contenu |
| --- | --- |
| `inbox/` | Rushes déposés en vrac, avant de créer un projet |
| `guides/<catégorie>/style.md`, `hooks.md` | Ton guide de style et tes accroches, par catégorie |
| `guides/<catégorie>/inspiration/videos/` | Vidéos de référence (privées, jamais exportées) |
| `bibliotheque/` | Assets réutilisables et leur inventaire `catalogue.json` |
| `artistes/<nom>/` | Fiche d'un artiste (`fiche.json`) et preuves de son accord (`accord/`) |
| `auteurs/<nom>/` | Fiche d'un auteur ou d'une autrice (`fiche.json`) |
| `chaine-creation/`, `chaine-recits/` | Les projets de chaque chaîne |
| `corbeille/` | Ce qui a été supprimé depuis l'interface |
| `parametres.json` | Réglages communs aux machines |

Les noms de dossier sont en minuscules, sans accents ni espaces, avec des tirets : « Élise Moreau » devient `elise-moreau`. L'outil s'en charge.

## Guide par tâche

### Ajouter un artiste et enregistrer son accord

À faire avant d'utiliser ses visuels dans une vidéo.

1. **Auteurs et artistes** → **+ Nouvel artiste**.
2. Remplir le nom ou pseudo, le contact (reste privé) et ses liens (Instagram, site…). Seules les adresses `http` ou `https` sont acceptées.
3. Dans **Accord** : la date, et s'il accepte la monétisation et la réutilisation de ses visuels dans d'autres vidéos.
4. **Créer la fiche**.
5. Dans **Preuve de l'accord** : **Ajouter une preuve** (capture du message, PDF, e-mail ou texte, jusqu'à 50 Mo). Elle s'affiche dans la page.
6. Le badge passe à **✓ Accord valide** quand la date est remplie et que le fichier de preuve existe.

Bon à savoir :
- Envoyer une nouvelle preuve ne supprime pas l'ancienne : toutes restent dans `artistes/<nom>/accord/`.
- Renommer l'artiste ne renomme pas son dossier, pour ne pas casser les liens avec les projets.
- Si le fichier de preuve est supprimé ou déplacé à la main, la fiche le signale et l'accord redevient incomplet.

### Ajouter un auteur ou une autrice de récits

1. **Auteurs et artistes** → **+ Nouvel auteur**.
2. Remplir le nom ou pseudo, le contact (reste privé) et ses liens (Reddit, site…).
3. **Créer la fiche**.

L'autorisation de lire un récit (date, traduction anglaise, monétisation, plateformes, preuve) ne se met pas sur la fiche de l'auteur : elle se renseigne dans le projet de chaque récit, car elle peut varier d'une histoire à l'autre. Ce sera possible à l'étape 7. La liste des récits de l'auteur se remplira alors automatiquement.

### Supprimer une fiche et la récupérer

- Sur la fiche : **Mettre la fiche à la corbeille**, puis confirmer.
- La fiche est déplacée dans `creations/corbeille/artistes/` ou `creations/corbeille/auteurs/`, avec la date dans le nom. Rien n'est effacé.
- Pour la récupérer : déplacer le dossier à la main dans `artistes/` ou `auteurs/`, et lui redonner son nom d'origine (sans la date).
- Une fiche liée à au moins une vidéo ou un récit ne peut pas être supprimée : elle sert d'historique des collaborations.
- La corbeille ne se vide jamais toute seule : c'est à toi de le faire à la main.

### Modifier un guide de style

Pas encore d'écran dédié. En attendant, ouvrir `creations/guides/<catégorie>/style.md` et `hooks.md` dans un éditeur de texte. Ils sont créés au premier lancement à partir du modèle de `CLAUDE.md`.

### Changer de dossier creations ou passer d'une machine à l'autre

1. **Paramètres** → **Cette machine** → **Dossier creations** → **Enregistrer**.
2. Le nouveau dossier est créé avec l'arborescence s'il n'existe pas. L'ancien n'est ni déplacé ni supprimé.
3. Tous les chemins enregistrés dans les JSON sont relatifs à `creations/` : un dossier copié ou partagé entre le PC et le Mac reste valide.

## Règles à connaître

- **Rushes intouchables** : l'outil ne modifie ni ne supprime jamais un fichier brut.
- **Rien n'est effacé** depuis l'interface : tout passe par la corbeille.
- **Artistes** : un projet qui contient des visuels d'un artiste ne pourra pas être exporté sans fiche avec accord daté et preuve.
- **Auteurs** : un récit d'un autre auteur ne pourra pas être exporté sans autorisation et preuve. Une version anglaise exige l'accord pour la traduction.
- **Claude** passe toujours par ton abonnement, via Claude Code. Aucune clé API n'est utilisée. Les appels comptent dans tes limites d'usage habituelles.
- **Publication manuelle** : l'outil prépare les fichiers, c'est toi qui publies.

## En cas de problème

| Message ou symptôme | Que faire |
| --- | --- |
| « Backend injoignable » sur le tableau de bord | Le serveur ne tourne pas : relancer `npm run dev` ou `npm start` |
| « Le port 4317 est déjà utilisé » | L'outil tourne déjà dans une autre fenêtre : l'utiliser ou fermer l'autre |
| Un programme est « Introuvable » dans Paramètres | Installer le programme ou renseigner son chemin complet, puis **Revérifier les programmes** |
| Le test Claude signale une clé API | Retirer la variable `ANTHROPIC_API_KEY` de l'environnement et se reconnecter à Claude Code avec l'abonnement |
| Le test Claude signale une limite atteinte | Attendre l'heure de réinitialisation affichée |
| « Fiches illisibles » dans Auteurs et artistes | Un `fiche.json` modifié à la main est abîmé, ou un dossier est mal nommé : corriger d'après le message |
| Après une mise à jour, l'interface ne répond plus | Relancer l'outil (et `npm install` si de nouvelles dépendances ont été ajoutées) |

## Développement

| Commande | Rôle |
| --- | --- |
| `npm install` | Installer les dépendances |
| `npm run dev` | Mode développement, rechargé à chaque modification |
| `npm run build` puis `npm start` | Mode normal |
| `npm run check` | Vérifier les types et le style (aucun `any`) |
| `npm test` | Lancer les tests |

Organisation du travail : une branche par étape (`phase-1/etape-N-nom`). À la fin de chaque étape, la vérifier dans l'interface, puis ouvrir et fusionner la pull request sur GitHub.
