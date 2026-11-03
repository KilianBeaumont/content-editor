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

Phase 1 (le socle) terminée.

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
| 8 | Règles d'autorisation avant export | ✅ |
| 9 | Tableau de bord et écran Projet | ✅ |
| 10 | Modifier, renommer, supprimer un projet | ✅ |
| 11 | Lanceur à double-cliquer (Windows et Mac) | ✅ |

Phase 2 (analyse), en cours. Pour obtenir une première vidéo au plus vite, on fait la transcription, puis directement la phase 3 pour un vlog ; l'analyse des vidéos d'inspiration vient ensuite.

| Étape | Contenu | État |
| --- | --- | --- |
| 2.1 | File de tâches avec progression en direct | ✅ |
| 2.2 | whisper.cpp : modèle, téléchargement, essai | ✅ |
| 2.3 | Transcription des rushes d'un projet | ✅ |
| 2.3 bis | Fiabilité de la transcription : détection de la parole, vocabulaire, correction à la main | ✅ |
| 2.4 à 2.6 | Écran Guides et analyse des vidéos d'inspiration | ✅ (avec la phase 5.1) |

Phase 3 (plan de montage et aperçu), pour un vlog d'abord.

| Étape | Contenu | État |
| --- | --- | --- |
| 3.1 | Préparation des rushes : proxy léger (HDR converti), planches d'images, silences et pics sonores, moments marqués à la main | ✅ |
| 3.2 | Contrat `plan.json` et validation | ✅ |
| 3.3 | Appel de Claude depuis le backend (`claude -p`, sessions, limites) et proposition d'un plan | ✅ |
| 3.4 | Skills `proposer-plan` et `integrer-retours` (à affiner sur de vraies vidéos) | ✅ |
| 3.5 | Écran Plan : écouter, ajuster et valider le plan ; coupes décalées et plans de coupe | ✅ |
| 3.6 | Rendu de l'aperçu basse résolution depuis les proxys (coupes décalées, plans de coupe, musique, volume normalisé) | ✅ |
| 3.7 | Lecteur et commentaires horodatés, repères sur la barre de lecture, comparaison des versions | ✅ |
| 3.8 | Boucle de versions (`integrer-retours`) et validation de la version | ✅ |
| 3.9 | Textes à l'écran et composants animés (Remotion) | après la première boucle |

Phase 4 (export final).

| Étape | Contenu | État |
| --- | --- | --- |
| 4.1 | Rendu pleine qualité de la version validée depuis les rushes d'origine (1080p par défaut, cadence des rushes, HDR converti en SDR, accélération par la carte graphique) | ✅ |
| 4.2 | Volume normalisé en deux passes (-14 LUFS, crêtes à -1 dBTP) | ✅ |
| 4.3 | Vérification du fichier exporté (résolution, codecs, durée, volume, crêtes) | ✅ |
| 4.4 | Rangement dans `exports/` et description prête à copier avec les crédits | ✅ |
| 4.5 | Onglet Export du projet et écran Exports (fichiers prêts par plateforme, « publié ») | ✅ |

Phase 5 (formats courts), en cours.

| Étape | Contenu | État |
| --- | --- | --- |
| 5.1 | Écran Guides : style, accroches, vidéos d'inspiration analysées (coupes, rythme, débit, techniques) et transmises aux propositions de plan | ✅ |
| 5.2 | Catégorie « Format court » tournée directement (cycle complet en 9:16) | ✅ |
| 5.3 | Cadrage par segment (recadré, fond flou), zoom progressif, panoramique et zoom brusque « loupe » | ✅ |
| 5.4 | Sous-titres mot à mot avec tes polices (style dans Paramètres, activés par plan) | ✅ |
| 5.5 | Extraits d'une vidéo longue : proposés et notés par Claude, bornes recalées, chacun devient un projet format court lié | ✅ |
| 5.6 | Export 1080x1920 et finitions | à venir |

Les phases suivantes (podcast, statistiques) viendront après.

## Installer l'outil sur une machine

À faire une seule fois par ordinateur (PC Windows et MacBook).

1. Installer les programmes nécessaires :
   - **Node.js 24** ou plus récent ;
   - **ffmpeg** et **ffprobe** (de préférence une version « full » avec libplacebo, pour une conversion HDR plus rapide et plus fidèle à l'export ; sans elle, l'outil utilise une méthode plus lente) ;
   - **Claude Code** (`claude`), puis s'y connecter avec l'abonnement Claude (`claude` dans un terminal, puis suivre la connexion). Ne jamais créer ni renseigner de clé API.
   - **whisper.cpp**, pour la transcription :
     - Windows (carte NVIDIA) : télécharger `whisper-bin-win-cuda-12.4.0-x64.zip` sur la page des versions de https://github.com/ggml-org/whisper.cpp (dernier build `bNNNN` qui contient des fichiers), le décompresser dans `outils/whisper/bin/` à côté du dépôt ;
     - Mac : `brew install whisper-cpp` (accéléré par Metal).
2. Double-cliquer sur le lanceur (voir « Lancer l'outil ») : la première fois, il installe tout ce qu'il faut.
3. Ouvrir l'écran **Paramètres**.
4. Section **Cette machine** :
   - **Dossier creations** : l'emplacement de tes créations. Par défaut `../creations`, à côté du dépôt. S'il n'existe pas, il est créé avec toute l'arborescence quand tu enregistres.
   - **Dossier des modèles whisper** : où ranger les modèles de transcription. Par défaut `../outils/whisper/modeles`.
   - Chemins de **ffmpeg**, **ffprobe**, **claude** et **whisper** : laisse le nom seul si le programme est trouvé, sinon mets le chemin complet. Chaque champ affiche si le programme est trouvé, avec sa version.
   - **Enregistrer**, puis **Revérifier les programmes** si tu as installé quelque chose entre-temps.
5. Section **Transcription** :
   - si le modèle ou la **détection de la parole** sont **absents** : **Télécharger les modèles** (environ 1,6 Go pour le modèle, 1 Mo pour la détection de la parole, vérifiés automatiquement) ;
   - puis **Tester whisper.cpp** : le résultat indique si la carte graphique est utilisée (CUDA sur le PC, Metal sur le Mac) ou le processeur (plus lent), et si la détection de la parole fonctionne.
   - Dans **Réglages communs**, le **Vocabulaire commun à toutes les transcriptions** : ton pseudo, le nom de l'univers, des chaînes, des personnages… séparés par des virgules. whisper les écrira correctement.
6. Section **Claude** : **Tester la connexion**. Le résultat doit indiquer l'abonnement (pas de clé API) et affiche ton utilisation sur 5 heures et sur 7 jours.

Ces réglages sont propres à chaque machine (fichier `config.local.json`, jamais partagé). Les **Réglages communs** (préréglages d'export, modèle de transcription, modèle Claude, rendus simultanés) sont enregistrés dans `creations/parametres.json` et suivent le dossier `creations/`.

## Lancer l'outil

**Au quotidien : double-cliquer sur le lanceur**, à la racine du dépôt :
- Windows : `Lancer.cmd` ;
- Mac : `Lancer.command`.

Une fenêtre s'ouvre, l'outil démarre, puis le navigateur s'ouvre tout seul sur http://127.0.0.1:4317. **Garde cette fenêtre ouverte** pendant que tu travailles ; la fermer arrête l'outil.

Le lanceur s'occupe de tout :
- il vérifie que Node.js 24 est installé ;
- si l'outil tourne déjà, il ouvre seulement le navigateur ;
- après une mise à jour du dépôt, il installe les nouvelles dépendances et reconstruit l'interface (quelques secondes, seulement quand c'est nécessaire).

Pour l'avoir sous la main :
- Windows : clic droit sur `Lancer.cmd` → **Afficher d'autres options** → **Envoyer vers** → **Bureau (créer un raccourci)** ;
- Mac : glisser `Lancer.command` dans le Dock (à droite du séparateur) en maintenant **Cmd + Option**. Si macOS refuse de l'ouvrir la première fois : clic droit → **Ouvrir** → **Ouvrir**.

En ligne de commande, si besoin :

| Usage | Commande | Adresse |
| --- | --- | --- |
| Normal | `npm run build` (après chaque mise à jour), puis `npm start` | http://127.0.0.1:4317 |
| Développement | `npm run dev` | http://localhost:5173 |

Pour arrêter : fermer la fenêtre, ou `Ctrl+C`. Si l'outil affiche « Le port 4317 est déjà utilisé », il tourne déjà dans une autre fenêtre. Pour utiliser un autre port, définir la variable d'environnement `EDITEUR_PORT`.

Au démarrage, l'outil affiche le dossier `creations/` utilisé et crée ce qui manque dans l'arborescence, sans jamais écraser un fichier existant.

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

Après la création, la page indique ce qui bloquerait l'export (voir ci-dessous) et propose **Ouvrir le projet**.

Deux projets ne peuvent pas avoir le même nom (même date et même titre), même sur deux chaînes différentes.

### Suivre les tâches longues

Les traitements longs (téléchargement du modèle, essai de whisper, transcriptions, préparations des rushes, propositions de plan par Claude, et bientôt les rendus) passent dans une **file de tâches**, une à la fois. Sur le **Tableau de bord**, la section **Tâches en cours** montre en direct pour chacune : l'étape, une barre de progression, le pourcentage et le temps restant estimé.
- **Annuler** arrête une tâche en cours ou retire une tâche en attente.
- Une tâche **échouée** affiche la raison ; **Relancer** la recommence avec les mêmes réglages.
- Si l'outil est fermé pendant une tâche, elle apparaît **Interrompue** au redémarrage : **Relancer**.
- **Effacer l'historique** vide la liste des tâches terminées (enregistrée dans `creations/taches.json`).

### Suivre ses projets

Le **Tableau de bord** montre :
- les **prochaines publications**, avec le nombre de jours restants, et une alerte pour un projet dont la date est passée sans export ;
- les **projets en cours** des deux chaînes, avec leur étape ;
- les **tâches en cours** (transcriptions, rendus), à partir de la phase 2.

Un clic sur un projet ouvre l'**écran Projet**. Il est organisé comme un assistant, en six onglets dans l'ordre de production :

| Onglet | Ce que tu y fais |
| --- | --- |
| 1. Fichiers | Revoir les sorties voulues, les consignes, l'auteur et son autorisation, les artistes et les assets ; voir les fichiers rangés (un clic les affiche), **Ajouter des fichiers**, mettre le projet à la corbeille |
| 2. Analyse | Transcrire et préparer les rushes, les lire, marquer les moments importants |
| 3. Plan | Faire proposer le plan par Claude, l'ajuster, le valider |
| 4. Aperçu | Rendre l'aperçu, le regarder, le commenter, produire la version suivante, valider la version |
| 5. Validation | Voir la version validée et ce qui bloquerait l'export |
| 6. Export | Rendre la version validée en pleine qualité, la télécharger, copier la description avec les crédits, cocher « publié » |

- Chaque onglet affiche son état : **✓** quand l'étape est faite (déduite de ce que contient le dossier), « à faire » pour la prochaine action.
- À l'ouverture, l'écran se place sur la prochaine étape à faire. Tous les onglets restent cliquables, et l'onglet ouvert est gardé dans l'adresse (`?etape=plan`) : un rechargement de la page y revient.
- Les boutons **← étape précédente** et **étape suivante →** en bas de page, et les encadrés « Aller à l'aperçu → », guident d'une étape à l'autre.
- Si un problème de droits bloquerait l'export, un badge **Export bloqué : voir pourquoi** apparaît sous le titre.
- **Modifier** (en haut à droite) reste accessible depuis tous les onglets.

### Analyser les rushes et les voix

Sur l'écran Projet, onglet **2. Analyse** :
1. La liste montre les vidéos et sons de `rushes/` et de `voix/`, avec leur langue (`voix/en/` en anglais, tout le reste en français) et deux états : la **transcription** et la **préparation** (« Images et son »).
2. **Analyser les N fichiers restants** lance, pour chaque fichier, deux tâches suivies en direct :
   - la **transcription** par whisper.cpp (quelques secondes par minute de son sur le PC avec la carte graphique) ;
   - la **préparation** par ffmpeg : un **proxy** léger (640 px, H.264) pour lire le rush dans le navigateur, des **planches d'images** (une vignette toutes les 1 à 30 s selon la durée, avec l'horaire écrit dessus) et la **mesure du son** (silences et pics). Une vidéo d'iPhone en HDR est convertie en couleurs normales pour le proxy. Compte environ une minute pour 3 minutes de 4K.
   Les boutons **Transcrire / Retranscrire** et **Préparer / Refaire la préparation** relancent l'une ou l'autre pour un seul fichier.
3. **Lire** ouvre le lecteur (sur le proxy quand il existe, le rush d'origine n'est jamais modifié) avec le texte à côté :
   - un clic sur une phrase y amène la vidéo ;
   - la phrase en cours de lecture est surlignée ;
   - les mots **soulignés en pointillé** sont ceux dont whisper n'est pas sûr (noms propres, mots inventés).
4. Si un rush est remplacé, sa transcription et sa préparation sont marquées comme à refaire : **Analyser** de nouveau.

### Marquer les moments importants

Dans le lecteur d'un rush (section **Analyse des rushes** → **Lire**) :
1. Mets en pause sur un moment à garder absolument (une bonne prise, une blague, un kill…).
2. Écris une note si tu veux (« la meilleure prise », « à mettre en accroche »), puis **Marquer ce moment** (ou Entrée).
3. Les moments marqués s'affichent sous le lecteur : un clic sur l'horaire y amène la vidéo, **✕** supprime le repère.

Claude garde chaque moment marqué dans le plan, sauf si ta note dit le contraire. Si tu n'as pas le temps de tout regarder, ne marque rien : Claude s'appuie alors sur la transcription, les pauses, les pics sonores et les planches d'images. Le bloc **Planches d'images** du lecteur montre ce que Claude peut voir du rush. Les repères sont enregistrés dans `travail/reperes.json`.

Pour une transcription plus juste :
- **Vocabulaire** : avant de transcrire, renseigne les noms propres de la vidéo (jeu, personnages, lieux, techniques) dans **Modifier** → **Vocabulaire des rushes**, séparés par des virgules. Ils s'ajoutent au vocabulaire commun des Paramètres. Le vocabulaire utilisé est rappelé au-dessus du texte.
- **Détection de la parole** : si elle est installée (Paramètres → Transcription), les phrases que whisper invente pendant la musique, les bruits ou les silences sont retirées automatiquement. Le message de fin de tâche indique combien.
- **Répétitions** : une phrase répétée trois fois ou plus d'affilée est surlignée, avec un bouton **Supprimer les répétitions** qui garde la première.
- **Corriger à la main** : survole une phrase → **Corriger** (Entrée pour enregistrer, Échap pour annuler, texte vide pour la supprimer) ou **Supprimer**. La phrase garde son horaire et porte le badge **corrigé** ; le fichier est marqué « corrigé » dans la liste.
- **Retranscrire** un fichier corrigé efface les corrections : l'outil demande confirmation.

Ce que l'outil range dans `travail/` : les transcriptions (`transcriptions/`, avec l'horaire de chaque mot), les proxys (`proxy/`), les planches (`planches/`), la mesure du son (`audio/`) et l'état de chaque préparation (`preparation/`). Tout se recrée à partir des rushes. Le projet passe à l'étape **Analysé**. Claude s'en sert pour proposer le plan de montage.

### Faire proposer un plan de montage par Claude

Avant : analyser les rushes, marquer les moments importants si tu as le temps, remplir les **consignes de montage** et les **notes** des fichiers (écran Projet → **Modifier**), et écrire ton guide `creations/guides/<catégorie>/style.md` (et `hooks.md`). Claude lit tout cela ; sans guide, il fait des choix par défaut et te le signale.

Sur l'écran Projet, onglet **3. Plan** :
1. Facultatif : une **consigne pour Claude** (« commence par la chute du pinceau »).
2. **Proposer un plan** : une tâche démarre et affiche ce que Claude fait (« Claude lit contexte.md », « Claude réfléchit », « Claude écrit sa réponse »). Compte une à deux minutes. Les appels passent par ton abonnement et comptent dans tes limites d'usage.
3. Le plan s'affiche :
   - la **stratégie** et l'**accroche** choisie ;
   - ce que **Claude signale** : ses doutes, ce qu'il n'a pas pu savoir, ce qu'il ne sait pas encore faire (transitions où le son continue sur l'image suivante, textes à l'écran) ;
   - chaque **segment** dans l'ordre : le rush, le passage (début → fin, durée), son rôle, ce qui est dit et pourquoi il est gardé ;
   - la musique, son volume et si elle baisse sous la voix ;
   - les **problèmes** repérés par l'outil : en rouge ce qui empêchera l'aperçu (rush introuvable, passage au-delà de la fin du rush…), en orange les avertissements (durée loin de la durée visée, passage repris deux fois…).
4. Pas convaincu : écris ce que tu veux de différent, puis **Demander une autre proposition à Claude**. Claude garde le fil de vos échanges ; la proposition précédente est archivée dans `travail/propositions/`.

Ce que l'outil range dans le projet :
- `travail/plan/contexte.md` : tout ce que Claude a lu (consignes, fichiers, assets utilisables, guide de style) ;
- `travail/transcriptions/<rush>.md` : les transcriptions en version compacte, avec des horaires à l'intérieur des phrases et les pauses mesurées dans le son, pour couper au bon endroit ;
- `versions/v1/plan.json` : le plan. Le projet passe à l'étape **Plan proposé**.

Claude ne peut que lire les fichiers du projet : il n'écrit rien lui-même, ne lance aucune commande et ne touche jamais aux rushes. Le réglage du modèle Claude utilisé est dans **Paramètres** → Réglages communs.

Pour ajuster le plan toi-même et le valider, voir la tâche suivante.

### Ajuster le plan et le valider

La section **Plan de montage** est un éditeur. Tant que le plan est **Proposé** et qu'aucun aperçu n'existe, tout se modifie :
- **Écouter** : ▶ sur une ligne joue ce segment dans le lecteur (sur le proxy) et s'arrête à sa fin ; **Enchaîner tout le plan** joue les segments à la suite, sans les décalages ni les plans de coupe (l'aperçu rendu les montrera).
- **Bornes** : tape le début et la fin en secondes (Entrée pour valider), ou mets le lecteur au bon endroit puis **⇤** (début ici) ou **⇥** (fin ici). La ligne indique aussi où le segment tombe dans la vidéo finale.
- **Ordre** : ▲ et ▼ ; **✕** retire le segment. **accroche** choisit le segment d'ouverture.
- **Image** (coupe décalée) : 0 pour une coupe franche ; **négatif** (par exemple -1,5) : l'image du segment arrive en avance pendant que la fin de la phrase précédente se termine, la transition « on entend encore mon visage mais on voit déjà la suite » ; **positif** : l'image précédente reste un instant.
- **Plans de coupe** : une image sans son, prise dans un rush, posée par-dessus la voix à un instant de la vidéo finale. Règle le passage emprunté et l'instant (« à … s dans la vidéo »). Pour en ajouter un : lis un passage, mets le lecteur sur l'image voulue, puis **+ Plan de coupe depuis la position du lecteur**.
- **Cadre** : voir « Cadrer et zoomer » ci-dessous.
- **Musique** : volume en dB, baisse sous la voix, **✕** pour la retirer.

Puis **Enregistrer les modifications** (ou **Annuler les modifications**). L'outil revérifie le plan à chaque enregistrement et affiche ce qui ne va pas. Le plan passe en « Modifié à la main » : si tu redemandes une proposition, Claude part de ta version.

### Cadrer et zoomer

La colonne **Cadre** de l'éditeur indique le cadrage de chaque segment (et de chaque plan de coupe) : « image entière », « recadré ×1,0 », « ×1,0 → ×1,4 » (mouvement) ou « fond flou ». Un clic dessus ouvre les réglages et place le lecteur au début du segment, avec le cadre dessiné par-dessus l'image (en jaune ; en pointillés, la position de fin d'un mouvement) :
- **Image entière** : l'image telle quelle. Si son orientation n'est pas celle de la vidéo (rush horizontal dans un format court), elle aura des bandes noires : l'outil le signale en orange.
- **Recadré** : une fenêtre aux proportions de la vidéo finale. Règle **Gauche ↔ droite**, **Haut ↕ bas** et **Zoom** (1 = la plus grande fenêtre possible). Coche **Mouvement progressif** pour régler une position de fin : zoom avant lent, panoramique pour suivre le sujet (le mouvement démarre et s'arrête en douceur).
- **Fond flou** : l'image entière, posée sur un fond flou d'elle-même. Pratique pour un écran ou un plan large qu'on ne veut pas couper.

**Zoom brusque (« loupe »)** : coupe un passage en deux segments qui se suivent exactement dans le rush (la fin du premier = le début du second), puis donne au second un zoom plus fort (×1,5 à ×2) centré sur le détail. Le son reste continu : l'outil ne met pas de fondu entre deux segments qui se suivent. Claude propose lui-même ces cadrages et ces effets (il repère sur les planches où se trouve le sujet), surtout pour les formats courts tirés de rushes horizontaux ; tu les ajustes ensuite.

### Sous-titres incrustés

Des sous-titres mot à mot, groupés par deux ou trois mots, avec le mot prononcé surligné.
1. **Une fois** : ajoute ta police à la **Bibliothèque** (type **Police**, fichier TTF, OTF ou TTC), puis **Paramètres** → Réglages communs → **Sous-titres incrustés** : choisis la police, la taille (en % de la hauteur), le nombre de mots à la fois, la position (en % depuis le haut ; 60 à 75 % pour un format court, loin des boutons des applis), le contour, les couleurs du texte et du mot prononcé, majuscules ou non. **Enregistrer**.
2. **Dans chaque plan** : case **Sous-titres incrustés** de l'éditeur. Claude la coche d'office pour les formats courts.
3. L'aperçu et l'export incrustent les sous-titres.

Le texte vient des transcriptions des rushes, **avec tes corrections** (onglet Analyse) : corrige une transcription avant de rendre si un mot est faux. Les hésitations (« euh », « hum ») sont retirées automatiquement, et les mots suivent exactement la ligne de temps du montage.

L'aperçu et l'export appliquent le cadrage (à partir des proxys pour l'aperçu, des rushes d'origine en pleine qualité pour l'export).

Quand tout est bon : **Valider le plan** (impossible tant qu'il reste une erreur en rouge). Le plan validé ne se modifie plus ; **Repasser en brouillon** le rend modifiable tant que l'aperçu n'a pas été rendu. L'aperçu se lance depuis le plan validé (voir ci-dessous).

### Rendre et regarder l'aperçu

1. Une fois le plan validé, onglet **4. Aperçu** : **Lancer l'aperçu**.
2. La tâche découpe chaque segment, puis assemble la vidéo, avec la progression en direct. Compte quelques secondes pour une minute de vidéo : l'aperçu est fait à partir des proxys (tous les rushes vidéo du plan doivent donc être préparés).
3. L'aperçu s'affiche dans un lecteur, avec sa durée et le temps de rendu.

Ce que l'aperçu contient : les segments dans l'ordre, coupés à l'image près et sans « clic » sonore (fondu de 30 ms à chaque coupe), les coupes décalées, les plans de coupe, la musique (avec fondus d'entrée et de sortie, baissée sous la voix si demandé) et un volume normalisé autour de -14 LUFS. Format : 640x360 pour une vidéo 16:9, 360x640 pour un format court.

L'outil vérifie le fichier rendu (durée conforme au plan, présence de l'image et du son) et signale tout écart sous le lecteur. Le fichier est rangé dans `versions/vN/apercu.mp4`, avec `rendu.json` (format, durée, contrôles). Une version rendue ne change plus : pour corriger, commente-la (ci-dessous), puis produis la version suivante.

### Commenter l'aperçu

Sous l'aperçu, la visionneuse :
- la **barre de repères** sous la vidéo montre le début de chaque segment (traits), tes commentaires (points orange, verts une fois traités) et la position de lecture ; un clic sur un point y amène la vidéo ;
- mets en pause là où quelque chose ne va pas, écris ce qu'il faut changer (la vidéo se met en pause dès que tu écris), puis **Ajouter** (ou Entrée). Le commentaire est rattaché à l'instant affiché (et au segment) ; décoche la case pour un commentaire sur **toute la vidéo** (« musique trop forte ») ;
- chaque commentaire peut être **modifié**, **marqué traité** ou **supprimé** ;
- si plusieurs versions ont été rendues, les boutons **v1, v2…** passent de l'une à l'autre **au même instant**, pour comparer.

Les commentaires sont enregistrés dans `versions/vN/retours.json`.

### Produire la version suivante, puis valider

1. Une fois tes commentaires écrits sur le dernier aperçu : **Produire la version suivante** (avec une précision pour Claude si tu veux).
2. Claude reprend le plan de cette version et ne change que ce que tes commentaires demandent. Il voit chaque commentaire situé dans le plan et dans le rush (« 0:04 → s1, à 7,95 s du rush »).
3. Le nouveau plan (v2, v3…) apparaît dans l'éditeur, avec **Ce que Claude a changé d'après tes commentaires**. Sous chaque commentaire de la version précédente, sa réponse s'affiche, et le commentaire passe en **✓ traité en v2**.
4. Ajuste si besoin, **Valider le plan**, **Lancer l'aperçu**, regarde, commente… jusqu'à ce que ce soit bon.
5. Quand un aperçu te convient : **C'est la bonne : valider la version vN**. Le projet passe à l'étape **Validé** ; c'est cette version qui sera rendue en pleine qualité à l'export (phase 4). **Annuler la validation** est toujours possible.

Toutes les versions restent dans `versions/` avec leur plan, leur aperçu et tes commentaires, pour pouvoir revenir en arrière.

### Exporter la vidéo finale

Onglet **6. Export** (ou **Export →** depuis l'onglet Validation), une fois une version validée :
1. Choisis la **qualité** :
   - **Standard** : la résolution du préréglage YouTube des Paramètres (1920x1080 par défaut) ;
   - **4K** : le double (3840x2160), proposée seulement si les rushes de la version validée sont au moins en 4K, et choisie d'office dans ce cas. Recommandée : YouTube compresse beaucoup mieux une vidéo envoyée en 4K, même quand elle est regardée en 1080p. Le rendu prend environ deux fois plus de temps et le fichier pèse environ 530 Mo par minute en 60 i/s (contre 100 Mo en 1080p).
   Et les **couleurs** (YouTube, rushes filmés en HDR comme ceux de l'iPhone) :
   - **HDR** (choisi d'office) : garde la luminosité et les couleurs de tes rushes, en HLG / HEVC 10 bits. YouTube l'affiche en HDR sur les écrans compatibles et fabrique lui-même une version SDR pour les autres ;
   - **SDR** : couleurs converties en H.264, identiques partout.
2. **Exporter la version vN** : la tâche rend la version validée en pleine qualité, avec la progression en direct (découpe de chaque segment, mélange du son, mesure du volume, assemblage, vérification). Compte environ une minute pour une minute de vidéo 4K sur le PC.
3. Le fichier s'affiche dans un lecteur, avec ses caractéristiques et le résultat des contrôles (**✓ Fichier vérifié**, sinon la liste des points à regarder).
4. Le fichier est **déjà rangé** dans le dossier du projet : `creations/chaine-creation/<projet>/exports/youtube/<projet>.mp4` (`exports/formats-courts/` pour une catégorie verticale ; `chaine-recits/` pour un récit). Son chemin complet s'affiche sous le lecteur, et **Afficher dans l'Explorateur** (le Finder sur Mac) ouvre ce dossier avec le fichier sélectionné, prêt à glisser dans YouTube.
5. **Description à copier** : ta description (écran **Modifier**) suivie des crédits de l'auteur, des artistes invités et des musiques externes, avec leurs liens. **Copier**, puis colle-la dans YouTube. Elle est aussi enregistrée dans `description.txt` à côté du fichier.
6. Une fois mis en ligne à la main : coche **Publié sur YouTube**.

Ce que fait l'export :
- il part des **rushes d'origine** (pas des proxys) et suit exactement le plan de la version validée : coupes, coupes décalées, plans de coupe, musique ;
- **image** : résolution choisie (standard ou 4K), couleurs choisies (HDR ou SDR), cadence des rushes (60 i/s si filmé en 60, jamais plus), à un débit proche des recommandations de YouTube : en SDR, H.264 BT.709 (environ 12 Mb/s en 1080p60, 60 Mb/s en 4K60) ; en HDR, HEVC 10 bits HLG / BT.2020 (25 % de débit en plus). En SDR, les vidéos HDR de l'iPhone sont converties et paraissent moins lumineuses que sur l'écran du téléphone, c'est normal. L'aperçu reste toujours en SDR ; avec libplacebo et une carte graphique, la conversion est plus rapide et plus fidèle ;
- **son** : AAC 320 kb/s, volume ramené à -14 LUFS en deux passes (mesure puis correction), crêtes à -1 dBTP ;
- **accélération** : l'encodage passe par la carte graphique quand elle est disponible (NVENC sur le PC, VideoToolbox sur le Mac), sinon par le processeur. En cas d'échec du décodage accéléré, l'export recommence automatiquement sans ;
- **vérification** : résolution, codecs, durée par rapport au plan, volume et crêtes mesurés sur le fichier final ;
- **droits** : l'export est refusé si l'onglet Validation signale un blocage (autorisation d'auteur, accord d'artiste, asset introuvable).

Refaire l'export (après avoir validé une autre version, par exemple) remplace le fichier ; l'outil le signale si le fichier ne correspond plus à la version validée. La fiche de chaque export est rangée dans `travail/exports/`.

### Retrouver tous les exports

L'écran **Exports** (menu) liste les fichiers prêts de tous les projets, par plateforme. Filtres par chaîne et par état (**À publier**, **Déjà publiés**, **Tous**). Pour chaque fichier : **Ouvrir** (dans le navigateur), **Afficher dans l'Explorateur**, la version et les caractéristiques, un avertissement si une autre version a été validée depuis, et la case **Publié**. Le titre du projet ouvre son onglet Export.

### Modifier un projet, ajouter des fichiers, le mettre à la corbeille

Depuis l'écran Projet :
- **Modifier** : titre, date, catégorie, version anglaise, sorties, consignes, description (FR et EN), notes des fichiers, auteur et autorisation (avec une nouvelle preuve), artistes, assets de la bibliothèque. Pour ton histoire, la case **futur roman** rappelle avant l'export de n'en publier que des extraits.
  - Si la **date** ou le **titre** change, le dossier est **renommé** (`AAAA-MM-JJ_titre`) et les fiches des artistes, de l'auteur et de la bibliothèque sont mises à jour. Ferme d'abord les fichiers du projet ouverts dans un autre programme.
  - La **chaîne** ne se change pas : crée un nouveau projet et déplace les fichiers.
  - Ajouter un artiste crée son dossier `assets/<artiste>/` ; passer en version anglaise crée `voix/en/` et les dossiers d'export anglais. Rien n'est supprimé quand tu retires quelque chose.
- **Ajouter des fichiers** : choisir des fichiers de l'inbox (ou en glisser de nouveaux), leur place et une note, puis **Ranger … dans le projet**. Comme à la création, ils sont déplacés sans être modifiés, et tout est remis dans l'inbox en cas d'échec.
- **Mettre le projet à la corbeille** : le dossier entier, rushes compris, va dans `corbeille/projets/`, et le projet disparaît de l'historique des fiches. Pour le récupérer : remettre le dossier à la main dans `chaine-creation/` ou `chaine-recits/` sans la date ajoutée à la fin du nom.

### Savoir si un projet peut être exporté

L'outil vérifie les droits avant tout export. Le résultat s'affiche après la création du projet et sur l'écran Projet :

| Situation | Effet |
| --- | --- |
| Récit d'un autre auteur sans autorisation obtenue, sans preuve, ou sans accord pour la lecture | Bloque tout l'export |
| Version anglaise sans accord pour la traduction | Bloque la piste audio EN et le podcast EN, pas la version française |
| Aucune plateforme autorisée pour une sortie (par exemple ni Spotify, ni Deezer, ni Apple Podcasts pour un podcast) | Bloque cette sortie |
| Une partie seulement des plateformes autorisée (par exemple TikTok mais pas Instagram pour les formats courts) | Avertissement |
| Artiste coché ou dossier `assets/<artiste>/` avec des fichiers, sans fiche ou sans accord complet (date et preuve) | Bloque tout l'export |
| Asset de la bibliothèque introuvable, ou visuel d'artiste dont la réutilisation n'est pas autorisée | Bloque tout l'export |
| Monétisation non acceptée par l'auteur ou l'artiste | Avertissement : ne pas monétiser la vidéo |
| Histoire personnelle sans signature | Avertissement |
| Histoire marquée « futur roman » avec une sortie longue (YouTube, podcast) | Avertissement : n'en publier que des extraits |

Pour débloquer : compléter la fiche de l'artiste (Auteurs et artistes), ou l'autorisation du projet (écran Projet → **Modifier**).

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

### Écrire ses guides et analyser des vidéos d'inspiration

Menu **Guides** : une carte par catégorie (vlog, format court, récit…), avec le nombre de vidéos d'inspiration et d'analyses. Dans une catégorie :
1. **Style et accroches** : modifie `style.md` et `hooks.md` directement, puis **Enregistrer**. Claude les lit avant chaque proposition de plan de cette catégorie. Ils restent aussi modifiables à la main dans `creations/guides/<catégorie>/`.
2. **Vidéos d'inspiration** : glisse des vidéos que tu trouves réussies (formats courts téléchargés, extraits de vlogs ; MP4, MOV, WebM). Elles sont rangées dans `guides/<catégorie>/inspiration/videos/`, restent privées et ne finissent jamais dans un export.
3. **Analyser les vidéos restantes** (ou **Analyser** sur une ligne). Pour chaque vidéo, sur cette machine :
   - les **coupes** sont détectées (changements de plan, avec leur horaire) ;
   - des **images** sont extraites : une juste après chaque coupe, et une à intervalle régulier ;
   - le **son** est mesuré (silences, pics) et la parole **transcrite** (langue détectée automatiquement) ;
   - un **profil chiffré** est calculé : durée, coupes par minute, durée des plans, instant de la première coupe, mots par minute, instant du premier mot, part de parole, plus long silence.
   Puis Claude regarde les images et lit le profil et la transcription. Il rédige l'analyse : accroche, structure, rythme, visuels et montage (zooms, « loupe », recadrages…), textes à l'écran, son, rétention (boucle, question, appel à l'action), avec une liste de **techniques** concrètes et horodatées. Compte une à deux minutes par vidéo.
4. **Voir** sur une ligne : la vidéo, son profil, ce qu'on en retient, les techniques, l'analyse complète et les images analysées.

Ce que l'outil range dans `guides/<catégorie>/inspiration/analyses/<vidéo>/` : `profil.json`, `coupes.json`, `audio.json`, `transcription.json` et `.md`, les images (`coupes/`, `planches/`), `analyse.json` et `analyse.md`.

Ensuite, à chaque proposition de plan d'un projet de cette catégorie, Claude reçoit tes **références d'inspiration** (profil, résumé, techniques) et s'en inspire sans les copier ; ton guide de style et tes consignes passent avant. **Corbeille** met la vidéo et son analyse dans `corbeille/guides/`.

### Tirer des formats courts d'une vidéo longue

Pour une vidéo longue (vlog, récit) dont une version est validée, et dont la sortie **Formats courts** est cochée : onglet **6. Export**, section **Formats courts tirés de cette vidéo**.
1. **Proposer N extraits** (N = le nombre de formats courts demandé à la création du projet), avec une consigne si tu veux (« un extrait drôle, un extrait conseil »). Claude lit la version validée, les transcriptions, les planches, ton guide **format court** et tes références d'inspiration.
2. Chaque extrait proposé affiche sa **note** sur 10 et le détail des cinq critères (accroche, compréhensible seul, émotion, densité, chute), sa durée, son accroche, pourquoi il marche, et ses passages avec leur cadrage. L'outil a **recalé les bornes** au mot près (l'écart est affiché : « début -0,12 s »). ▶ joue un passage dans le lecteur.
3. Ajuste le titre, puis **Créer le format court** : un nouveau projet **format court** est créé, lié à la vidéo longue (badge **Extrait de …**), avec :
   - les rushes utilisés, **partagés sans copie** (lien vers le même fichier sur le disque), ainsi que leur proxy, leurs planches et leur transcription : rien à réanalyser ;
   - l'auteur, l'autorisation (avec sa preuve), les artistes et les assets de la vidéo longue ;
   - un premier plan reprenant l'extrait (passages, cadrage, sous-titres cochés).
4. Le format court suit ensuite tout le cycle habituel : ajuste le plan, valide, aperçu, commentaires, export dans `exports/formats-courts/`.

**Proposer d'autres extraits** remplace les propositions (les formats courts déjà créés restent). La liste **Formats courts créés** en bas de la section mène à chacun. Si le disque ne permet pas de partager un fichier (certains disques externes), l'outil le copie.

### Créer un format court tourné directement

Pour une vidéo verticale pensée pour TikTok, Reels et Shorts dès le tournage : **Nouveau projet**, catégorie **format court** (sur les deux chaînes). Tout le cycle fonctionne comme pour un vlog, en 9:16 : analyse des rushes, plan, aperçu en 360x640, commentaires, export en 1080x1920 dans `exports/formats-courts/`. Pense à remplir le guide **format court** et à y déposer des vidéos d'inspiration. Tu peux filmer en vertical ou en horizontal : un rush horizontal se recadre en 9:16 segment par segment (voir « Cadrer et zoomer »). Pour les sous-titres, voir « Sous-titres incrustés ».

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
| « Backend injoignable » sur le tableau de bord | Le serveur ne tourne pas : relancer le lanceur (ou `npm run dev`) |
| « Node.js est introuvable » ou « trop ancien » au lancement | Installer Node.js 24 ou plus récent depuis https://nodejs.org, puis relancer |
| Le lanceur s'arrête sur « La commande npm … a échoué » | Lire le message au-dessus (souvent une connexion internet coupée pendant l'installation), puis relancer |
| « Le port 4317 est déjà utilisé » | L'outil tourne déjà dans une autre fenêtre : l'utiliser ou fermer l'autre |
| Un programme est « Introuvable » dans Paramètres | Installer le programme ou renseigner son chemin complet, puis **Revérifier les programmes** |
| Le test Claude signale une clé API | Retirer la variable `ANTHROPIC_API_KEY` de l'environnement et se reconnecter à Claude Code avec l'abonnement |
| Le test Claude signale une limite atteinte | Attendre l'heure de réinitialisation affichée |
| « Fiches illisibles » dans Auteurs et artistes | Un `fiche.json` modifié à la main est abîmé, ou un dossier est mal nommé : corriger d'après le message |
| « catalogue.json n'est pas un JSON valide » dans Bibliothèque | Le fichier a été abîmé à la main : corriger la virgule ou l'accolade indiquée dans le message |
| « Entrées ignorées » dans Bibliothèque | Une entrée de `catalogue.json` est incomplète ou mal écrite : la corriger d'après le message |
| « whisper.cpp introuvable » ou « Modèle … absent » | Paramètres : vérifier le chemin de whisper-cli et le dossier des modèles, puis **Télécharger le modèle** |
| Une transcription échoue avec « Ce fichier n'a pas de piste audio » | Le rush est muet (timelapse, capture d'écran) : il n'y a rien à transcrire |
| La transcription contient des phrases inventées ou répétées pendant la musique ou les silences | Paramètres → Transcription : télécharger la **détection de la parole**, puis **Retranscrire** ; sinon **Supprimer les répétitions** ou corriger à la main |
| L'essai de whisper indique « outil de détection de la parole introuvable » | Le programme `whisper-vad-speech-segments` doit être à côté de `whisper-cli` (il est dans le zip Windows et dans Homebrew) ; la transcription marche quand même, sans ce filtre |
| « La transcription a changé entre-temps : recharge la page » | Le fichier a été retranscrit pendant que tu corrigeais : recharger la page puis refaire la correction |
| L'essai de whisper indique « sur le processeur » | Sur le PC, vérifier que la version CUDA est installée et le pilote NVIDIA à jour ; la transcription marche quand même, plus lentement |
| « Limite d'usage Claude atteinte : réessaie à … » | Ton quota d'abonnement est épuisé pour le moment : attendre l'heure indiquée, puis **Relancer** la tâche |
| « Claude utilise une clé API … au lieu de l'abonnement » | Retirer la variable `ANTHROPIC_API_KEY` de l'environnement, se reconnecter à Claude Code avec l'abonnement, puis **Relancer** |
| « Aucune transcription : transcris d'abord les rushes » | Section **Analyse des rushes** de l'écran Projet, puis relancer la proposition |
| « Valide d'abord une version (onglet Aperçu) : c'est elle qui est exportée » | Onglet **4. Aperçu** : **C'est la bonne : valider la version vN** |
| « Export bloqué : … » | Onglet **5. Validation** : corriger ce qui bloque (autorisation, accord d'artiste, asset), puis relancer l'export |
| « La sortie … ne s'exporte pas encore pour ce projet » | Seule la vidéo principale s'exporte pour l'instant (YouTube, ou format court pour une catégorie verticale) ; vérifier aussi que la sortie est cochée dans **Modifier** |
| Analyse d'une vidéo d'inspiration : « Transcription impossible : … » à la fin du message | L'analyse continue sans la transcription (vidéo sans parole, ou modèle whisper absent : Paramètres → Transcription) |
| « Consignes introuvables : .claude/skills/analyser-inspiration/SKILL.md » | Le dépôt est incomplet : le mettre à jour (`git pull`) |
| « Valide d'abord une version de la vidéo longue » (extraits) | Les extraits sont tirés de la version validée : onglet **4. Aperçu**, valider une version |
| « Cet extrait a déjà son projet » | Ouvre-le avec **Ouvrir le format court**, ou propose d'autres extraits |
| « Choisis la police des sous-titres : Paramètres → Sous-titres » | Ajoute ta police à la Bibliothèque (type Police), puis choisis-la dans Paramètres → Sous-titres incrustés ; ou décoche **Sous-titres incrustés** dans le plan |
| « La police des sous-titres doit être un fichier .ttf, .otf, .ttc » ou « Impossible de lire le nom de la police » | Utilise une police TTF ou OTF classique (les WOFF des sites web ne conviennent pas) |
| « Ce ffmpeg ne sait pas encoder en HEVC 10 bits » | Installer une version complète de ffmpeg (avec libx265), ou exporter en SDR |
| « Le HDR n'est possible que pour YouTube, avec des rushes filmés en HDR » | Exporter en SDR : les rushes de la version validée ne sont pas en HDR |
| « Les rushes de la version validée ne sont pas en 4K » | Exporter en qualité **Standard**, ou filmer en 4K |
| « La mesure du volume a échoué : relance l'export » | **Relancer** la tâche ; si cela se répète, vérifier que la musique et les rushes se lisent |
| L'export affiche « Nouvel essai sans accélération matérielle du décodage » | Le décodage par la carte graphique a échoué pour un rush : l'export continue sur le processeur, plus lentement, sans rien perdre |
| L'export signale « Volume … au lieu de -14 LUFS » ou « Crêtes à … dBTP » | Rare (vidéo très courte, musique très forte) : baisser la musique dans le plan, valider une nouvelle version, puis refaire l'export |
| « Aucun commentaire à intégrer sur l'aperçu vN » | Tous les commentaires sont déjà traités : en ajouter un, ou repasser un commentaire **À retraiter** |
| « La version vN n'a pas encore d'aperçu à commenter » ou « … rends-la avant de la valider » | Lancer d'abord l'aperçu de cette version |
| « Consignes de montage introuvables : .claude/skills/integrer-retours/SKILL.md » | Le dépôt est incomplet : le mettre à jour (`git pull`) |
| « Prépare d'abord rushes/… : l'aperçu est rendu à partir des proxys » | Section **Analyse des rushes** : **Préparer** le fichier (ou **Refaire la préparation** s'il a été modifié), puis **Relancer** la tâche de rendu |
| « Valide d'abord le plan » ou « L'aperçu de vN existe déjà » | Valider le plan avant de lancer l'aperçu ; une version déjà rendue ne se rend pas deux fois : proposer la version suivante |
| « ffmpeg a échoué (assemblage de l'aperçu) : … » | Noter le message, vérifier que les fichiers de musique se lisent, puis **Relancer** ; si cela se répète, refaire la préparation des rushes |
| L'aperçu signale « Durée rendue … au lieu de … prévues » | Un rush s'arrête avant la fin d'un segment ou d'un plan de coupe : vérifier les bornes dans le plan de la version suivante |
| « Corrige d'abord le plan : … » en validant | Une erreur en rouge reste dans le plan : la corriger, **Enregistrer les modifications**, puis **Valider le plan** |
| « Ce plan est validé : repasse-le en brouillon pour le modifier » | **Repasser en brouillon**, modifier, puis valider de nouveau |
| « Un aperçu existe déjà pour cette version » ou « Seule la dernière version du plan peut changer » | Une version rendue est conservée telle quelle : demander la version suivante |
| « ffmpeg a échoué (création du proxy) : … » | Le rush est peut-être abîmé ou dans un format inconnu : vérifier qu'il se lit dans un lecteur vidéo, puis **Refaire la préparation** |
| Les planches n'ont pas d'horaire écrit sur les vignettes | Aucune police trouvée sur la machine (Arial sous Windows et Mac) : Claude calcule alors les horaires, la préparation reste utilisable |
| Une vidéo de téléphone apparaît délavée ou grise dans le lecteur | Elle est en HDR et n'a pas encore de proxy : **Préparer** le fichier |
| « Consignes de montage introuvables : .claude/skills/proposer-plan/SKILL.md » | Le dépôt est incomplet : le mettre à jour (`git pull`) |
| « Claude n'a pas répondu en 20 minutes » ou « Claude a échoué : … » | Relancer ; si cela se répète, faire **Tester la connexion** dans Paramètres → Claude |
| « Nouvelle session Claude (l'ancienne n'existe pas sur cette machine) » dans la tâche | Normal après un renommage du projet ou sur l'autre ordinateur : Claude repart de `contexte.md` et du plan existant |
| « ffprobe est introuvable » dans Inbox | Installer ffmpeg (qui contient ffprobe) ou renseigner le chemin de ffprobe dans **Paramètres** |
| « Espace disque insuffisant » | Libérer de la place sur le disque qui contient `creations/`, ou déplacer `creations/` sur un autre disque (Paramètres) |
| « Un projet existe déjà sous le nom … » | Changer la date ou le titre |
| « Impossible de renommer le dossier » ou « Impossible de déplacer le projet » | Un fichier du projet est ouvert (lecteur vidéo, logiciel de montage, Explorateur dans le dossier) : le fermer puis recommencer |
| « Impossible de déplacer … Rien n'a été créé » | Un fichier était ouvert dans un autre programme ou le disque est plein : fermer le programme ou libérer de la place, puis recommencer. Les fichiers sont restés dans l'inbox |
| « Fichier trop volumineux » à l'envoi | La limite est de 4 Go pour la bibliothèque et de 50 Mo pour une preuve d'accord |
| « Envoi interrompu » dans le terminal, ou « La connexion avec le serveur a été coupée » à l'écran | La page a été fermée ou rechargée pendant l'envoi, ou le serveur a redémarré : recommencer l'envoi en gardant la page ouverte. Aucun fichier partiel n'est conservé |
| Page blanche en mode normal après une mise à jour | Relancer `npm start` après chaque `npm run build` : le serveur ne connaît que les fichiers de l'interface présents à son démarrage |
| Après une mise à jour, l'interface ne répond plus | Relancer l'outil (et `npm install` si de nouvelles dépendances ont été ajoutées) |

## Développement

| Commande | Rôle |
| --- | --- |
| `npm install` | Installer les dépendances |
| `npm run dev` | Mode développement, rechargé à chaque modification |
| `npm run build` puis `npm start` | Mode normal |
| `npm run check` | Vérifier les types et le style (aucun `any`) |
| `npm test` | Lancer les tests |

Organisation du travail : chaque étape est vérifiée dans l'interface, puis commitée et poussée directement sur `main`.
