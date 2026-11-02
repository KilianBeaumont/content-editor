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
| 5 | Bibliothèque d'assets | ✅ |
| 6 | Inbox : rushes déposés ou glissés dans l'interface | ✅ |
| 7 | Création d'un projet depuis l'inbox : sorties voulues, consignes de montage, pistes FR et EN, auteur, artistes, assets | ✅ |
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

### Déposer des rushes dans l'inbox

L'inbox reçoit les fichiers bruts avant la création d'un projet : rushes vidéo, voix enregistrées, images, textes de récit.

1. **Inbox** dans le menu.
2. Glisser les fichiers dans la zone en pointillés, ou **Choisir des fichiers** (plusieurs à la fois). Pas de limite de taille.
3. Les fichiers partent l'un après l'autre : une barre montre l'avancement du fichier en cours, le nombre de fichiers restants, et un bouton **Annuler** arrête tout. Garde la page ouverte jusqu'à la fin.
4. Chaque fichier apparaît dans la liste avec sa durée, sa résolution, ses images par seconde et son audio (lus par ffprobe). Un clic sur une ligne affiche l'aperçu.

Tu peux aussi copier les fichiers directement dans `creations/inbox/` avec l'Explorateur ou le Finder, y compris dans des sous-dossiers (une carte SD entière par exemple) : clique sur **Actualiser**.

Bon à savoir :
- Les noms d'origine sont gardés. Si un fichier du même nom existe déjà, le nouveau devient `nom (2).mp4`.
- L'espace disque libre est affiché, et l'outil prévient si les fichiers en attente ne tiennent pas.
- « Illisible » signale un fichier que ffprobe ne sait pas lire (fichier abîmé ou envoi incomplet) ; le détail s'affiche au survol et dans l'aperçu.
- Certains formats (HEVC, ProRes…) ne se lisent pas dans le navigateur : l'aperçu l'indique, mais le fichier reste utilisable pour le montage.
- **Corbeille** déplace un fichier déposé par erreur dans `corbeille/inbox/`. Rien n'est jamais effacé.
- Les dossiers ne se glissent pas : ouvre-les et glisse les fichiers qu'ils contiennent, ou copie le dossier dans `creations/inbox/`.

### Créer un projet

1. Déposer les fichiers dans l'**Inbox** (ou directement dans le formulaire, étape 5 ci-dessous).
2. **Nouveau projet** (ou **Créer un projet avec ces fichiers** depuis l'Inbox).
3. **Projet** : chaîne, catégorie, date de publication prévue, titre. Pour un récit, cocher **Version anglaise** si tu veux la voix, la piste audio et le podcast en anglais, puis donner le titre anglais. Le nom du dossier s'affiche en dessous (`AAAA-MM-JJ_titre`).
4. **Sorties voulues** : cochées par défaut selon la catégorie (par exemple YouTube + formats courts pour un vlog). Pour les formats courts, indiquer combien d'extraits tu veux. Les sorties en anglais demandent la version anglaise.
5. **Consignes de montage** (facultatives) : intention, durée visée, ce qu'il faut garder absolument, ce qu'il faut éviter.
6. **Fichiers** : cocher les fichiers de l'inbox à ranger dans le projet. Pour chacun :
   - sa **place** est proposée d'après son type : rushes pour une vidéo, voix FR pour un audio de récit, assets pour une image, texte pour un document. Pour un récit, choisis **Voix FR** ou **Voix EN** pour les deux pistes de narration ;
   - une **note** pour le montage (« bonne prise vers 3:20 », « début raté »).
   Tu peux aussi glisser de nouveaux fichiers dans le formulaire : ils passent par l'inbox et sont cochés automatiquement.
7. **Auteur et autorisation** (chaîne Récits) : choisir la fiche de l'auteur (ou en créer une dans un nouvel onglet puis **Actualiser**), le lien vers l'histoire d'origine, et ce qu'il a autorisé : lecture, traduction anglaise, monétisation, plateformes, avec la preuve. Pour ton histoire : **Mon histoire** et ta signature.
8. **Artistes invités** : cocher les artistes dont tu utilises les visuels. Chacun a son dossier `assets/<artiste>/`, proposé comme place dans la liste des fichiers.
9. **Assets de la bibliothèque** : cocher ceux que tu veux voir dans la vidéo.
10. **Créer le projet**.

Ce que fait l'outil :
- il crée le dossier dans `chaine-creation/` ou `chaine-recits/`, avec ses sous-dossiers (`rushes/` ou `voix/fr`, `voix/en`, `texte/`, `autorisation/`, `assets/`, `travail/`, `versions/`, et un dossier par sortie dans `exports/`) ;
- il **déplace** les fichiers cochés de l'inbox vers le projet, sans les modifier. Si l'inbox et le projet sont sur deux disques différents, il copie, vérifie la taille, puis seulement supprime l'original de l'inbox ;
- si un déplacement échoue en cours de route, il remet tout dans l'inbox et n'enregistre rien ;
- il écrit `metadata.json` (titre, sorties, consignes, notes, auteur, autorisation…) ;
- il ajoute le projet à l'historique de l'auteur, des artistes et des assets choisis.

Deux projets ne peuvent pas avoir le même nom (même date et même titre), même sur deux chaînes différentes. L'écran Projet (suivi, modification, plan de montage) arrive à l'étape 9.

### Ajouter un asset à la bibliothèque

La bibliothèque contient ce qui sert dans plusieurs vidéos. Sept types :

| Type | Exemples | Dossier |
| --- | --- | --- |
| Police | polices de l'identité graphique | `polices/` |
| Image | logos, illustrations, fonds, modèles de miniatures | `images/` |
| Vidéo | génériques, transitions, animations | `videos/` |
| Musique | musiques de fond ou de générique | `musiques/` |
| Ambiance sonore | pluie, vent, taverne, forêt, en boucle sous la narration | `ambiances/` |
| Son ponctuel | whoosh, pop, impact | `sons/` |
| Voix | phrases qui reviennent d'une vidéo à l'autre (intro, outro, « abonne-toi »), en FR ou en EN | `voix/` |

Chaque type existe pour les trois emplacements : **Commun aux deux chaînes**, **Création** et **Récits**. Les composants animés paramétrables (cartouche avec un nom, bouton d'abonnement) arriveront en phase 3.

1. **Bibliothèque** → **+ Ajouter un asset**.
2. Choisir le **fichier** (jusqu'à 4 Go). Le type est deviné d'après le format ; le changer si besoin (par exemple « Son ponctuel » au lieu de « Musique »).
3. Choisir la **chaîne**. Le fichier sera rangé dans `bibliotheque/<chaîne>/<type>/` avec un nom sans accents ni espaces.
4. Écrire une **description** : ce que c'est et quand l'utiliser. C'est elle que Claude lira pour proposer l'asset au montage.
5. Ajouter des **étiquettes** pour regrouper les assets : « identité », « générique », « halloween », le nom d'une série… Les étiquettes déjà utilisées sont proposées en un clic.
6. Pour une **voix**, indiquer sa **langue** (obligatoire). Pour une image ou une vidéo qui contient du texte, l'indiquer aussi : aucun texte en français ne doit apparaître sur les visuels des récits.
7. Indiquer **qui l'a créé** :
   - toi ;
   - un artiste : le choisir dans la liste. Son accord doit être valide et autoriser la réutilisation, sinon l'asset est marqué « À vérifier » ;
   - une source externe (banque de sons, musique libre…) : noter la licence et la mention à mettre dans la description des vidéos.
8. **Ajouter à la bibliothèque**. Une barre montre l'avancement de l'envoi, avec un bouton **Annuler**. Garde la page ouverte jusqu'au bout : le navigateur te prévient si tu essaies de la quitter.

Tu peux aussi déposer des fichiers directement dans les dossiers de `bibliotheque/` avec l'Explorateur ou le Finder. Ils apparaissent dans **Fichiers hors catalogue**, en bas de l'écran Bibliothèque : **Ajouter au catalogue** pour les décrire.

Bon à savoir :
- Chaque carte affiche un aperçu : image, vidéo, police (« Aa »), ou l'extension pour les sons. La page de l'asset permet d'écouter, de regarder ou de tester la police.
- Filtres par chaîne, par type et par étiquette (clic sur une étiquette sous les filtres), et recherche dans les noms et descriptions.
- « ✗ À vérifier » signale un fichier introuvable ou un problème d'accord d'artiste. Le détail est sur la page de l'asset.
- L'emplacement d'un asset (chaîne, type) ne se change pas depuis l'interface. Pour le changer : le mettre à la corbeille et l'ajouter de nouveau.
- Les assets propres à une seule vidéo (illustrations d'un récit, visuels d'un artiste invité) ne vont pas dans la bibliothèque mais dans le dossier `assets/` du projet : ce sera possible à la création du projet (étape 7) et depuis l'écran Projet.
- La liste **Utilisations** d'un asset de la bibliothèque se remplira quand tu le choisiras pour une vidéo (étape 7) puis au montage (phase 3).
- `bibliotheque/catalogue.json` reste modifiable à la main. Une entrée mal écrite est signalée, ignorée par l'outil, et conservée telle quelle dans le fichier.

### Supprimer une fiche et la récupérer

- Sur la fiche : **Mettre la fiche à la corbeille**, puis confirmer.
- La fiche est déplacée dans `creations/corbeille/artistes/` ou `creations/corbeille/auteurs/`, avec la date dans le nom. Rien n'est effacé.
- Pour la récupérer : déplacer le dossier à la main dans `artistes/` ou `auteurs/`, et lui redonner son nom d'origine (sans la date).
- Une fiche liée à au moins une vidéo ou un récit ne peut pas être supprimée : elle sert d'historique des collaborations.
- Même principe pour un asset de la bibliothèque : **Mettre à la corbeille** sur sa page déplace le fichier dans `corbeille/bibliotheque/` et le retire du catalogue. Pour le récupérer, remettre le fichier dans son dossier (sans la date dans le nom), puis **Ajouter au catalogue**. Un asset qui a servi dans une vidéo est conservé.
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
| « catalogue.json n'est pas un JSON valide » dans Bibliothèque | Le fichier a été abîmé à la main : corriger la virgule ou l'accolade indiquée dans le message |
| « Entrées ignorées » dans Bibliothèque | Une entrée de `catalogue.json` est incomplète ou mal écrite : la corriger d'après le message |
| « ffprobe est introuvable » dans Inbox | Installer ffmpeg (qui contient ffprobe) ou renseigner le chemin de ffprobe dans **Paramètres** |
| « Espace disque insuffisant » | Libérer de la place sur le disque qui contient `creations/`, ou déplacer `creations/` sur un autre disque (Paramètres) |
| « Un projet existe déjà sous le nom … » | Changer la date ou le titre |
| « Impossible de déplacer … Rien n'a été créé » | Un fichier était ouvert dans un autre programme ou le disque est plein : fermer le programme ou libérer de la place, puis recommencer. Les fichiers sont restés dans l'inbox |
| « Fichier trop volumineux » à l'envoi | La limite est de 4 Go pour la bibliothèque et de 50 Mo pour une preuve d'accord |
| « Envoi interrompu » dans le terminal, ou « La connexion avec le serveur a été coupée » à l'écran | La page a été fermée ou rechargée pendant l'envoi, ou le serveur a redémarré : recommencer l'envoi en gardant la page ouverte. Aucun fichier partiel n'est conservé |
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
