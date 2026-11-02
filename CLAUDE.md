# Contexte projet : éditeur vidéo local

Ce document décrit le projet de création de contenu de l'utilisateur et sert de base pour développer un outil local qui organise, monte et découpe ses vidéos et podcasts, puis range chaque version dans le bon dossier. L'outil se compose d'un backend qui fait tout le travail (analyse, montage, rendu, rangement) et d'une interface web locale d'où l'utilisateur pilote tout, sans taper de commandes. La publication reste manuelle.

## 1. Le projet en bref

L'utilisateur est un créateur autodidacte. Il construit un univers fantasy (nom pas encore choisi) décliné en romans, jeux vidéo, dessins, peintures, musique, animation et modélisation 3D. Il documente tout publiquement et lance une deuxième activité de narration d'histoires fantasy.

### Les deux chaînes

| | Chaîne 1 : Création | Chaîne 2 : Récits |
| --- | --- | --- |
| Nom provisoire | À définir (pseudo actuel ou « La Forge des Mondes ») | À définir (piste : « La Veillée des Mondes ») |
| Contenu | Vlog / daily life créatif : construction de l'univers, peinture, musique, animation, 3D, game dev, écriture de roman, progression artistique, méthode de réflexion | Récits fantasy au format « thread horreur » : histoires d'auteurs et d'autrices (avec accord écrit), et parfois les histoires de l'utilisateur |
| Format principal | Vidéo longue 16:9 | Vidéo longue 16:9 (narration + visuels d'ambiance) et podcast audio |
| Langues | Français | Français + anglais |
| Rythme cible | 1 vlog / semaine | 1 récit / semaine |

Les deux chaînes se renvoient mutuellement l'audience : un récit original de l'utilisateur sur la chaîne 2 renvoie vers son making-of sur la chaîne 1, et inversement.

### Les comptes

| Plateforme | Chaîne 1 : Création | Chaîne 2 : Récits |
| --- | --- | --- |
| YouTube | 1 chaîne (vidéos longues + Shorts) | 1 chaîne (vidéos longues + Shorts) |
| TikTok | 1 compte | 1 compte |
| Instagram | 1 compte | 1 compte |
| Podcast | — | 2 émissions : FR et EN |

L'utilisateur publie lui-même sur chaque plateforme. L'outil prépare uniquement les fichiers prêts à publier, rangés par chaîne et par plateforme.

## 2. Principes de l'outil

- **L'utilisateur valide tout.** L'outil propose, l'utilisateur relit, corrige, et l'outil itère jusqu'à validation. Aucun envoi automatique vers les réseaux.
- **Plan avant rendu.** Avant tout rendu, l'outil produit un plan de montage lisible (liste des segments, coupes, textes, musique, hook choisi). Le rendu n'est lancé qu'après accord.
- **Aperçu rapide d'abord.** Chaque itération est rendue en basse résolution pour relecture. Le rendu final en pleine qualité n'est fait qu'une fois la version validée.
- **Versions conservées.** Chaque itération est gardée (`v1`, `v2`…) avec les retours de l'utilisateur, pour pouvoir revenir en arrière.
- **Rushes intouchables.** Les fichiers bruts ne sont jamais modifiés ni supprimés.
- **Le style vient des guides.** Pour chaque catégorie de contenu, l'outil lit le guide de style et les analyses d'inspiration avant de proposer un montage.
- **Jamais de clé API Claude.** L'outil utilise exclusivement l'abonnement Claude de l'utilisateur, via Claude Code. Aucune clé API Anthropic n'est créée, stockée ni utilisée, nulle part dans le projet. L'outil est strictement personnel et ne sera jamais publié.
- **Tout se pilote depuis l'interface web.** Créer un projet, valider un plan, suivre un rendu, relire, commenter, itérer, gérer la bibliothèque et les paramètres : tout se fait en cliquant. La ligne de commande n'est pas nécessaire au quotidien.

## 3. Types de contenus

| Catégorie | Chaîne | Source | Sorties |
| --- | --- | --- | --- |
| `vlog` | Création | Rushes filmés | Vidéo longue 16:9 + extraits courts |
| `recit` | Récits | Voix FR (+ EN), visuels d'ambiance, musique | Vidéo longue 16:9 (piste FR + piste audio EN séparée) + podcast FR (+ EN) + extrait court |
| `micro-histoire` | Les deux | Narration courte (moins d'1 min) + visuels | Format court 9:16 |
| `extrait-recit` | Récits | Vidéo longue d'un récit | Format court 9:16 |
| `timelapse` | Création | Capture d'écran ou caméra | Format court 9:16 |
| `podcast` | Récits | Voix du récit + musique | MP3 FR, MP3 EN |

Un format court est exporté une fois et sert pour TikTok, Reels et Shorts du compte concerné.

### Déroulé type

1. L'utilisateur dépose les rushes dans `inbox/` (ou les glisse dans l'interface web).
2. Dans l'interface, il indique la chaîne, la catégorie et le titre du projet.
3. L'outil crée le dossier du projet, y déplace les rushes et crée `metadata.json`.
4. L'outil transcrit les rushes, lit le guide de style de la catégorie et propose un plan de montage.
5. L'utilisateur valide ou corrige le plan dans l'interface.
6. L'outil rend un aperçu basse résolution dans `versions/vN/`, avec une progression visible en temps réel.
7. L'utilisateur regarde l'aperçu dans l'interface et laisse des commentaires horodatés (enregistrés dans `versions/vN/retours.json`), l'outil produit `vN+1`, et ainsi de suite.
8. Une fois validé, l'outil rend la version finale et la range dans `exports/`, par plateforme.
9. Depuis une vidéo longue validée, l'outil peut proposer des extraits courts, qui suivent le même cycle.

## 4. Arborescence

```
creations/
  inbox/                              rushes déposés en vrac

  guides/                             référence de style, définie par l'utilisateur
    vlog/
      style.md
      hooks.md
      inspiration/
        videos/                       vidéos de référence (usage privé)
        analyses/                     générées par l'outil à partir des vidéos
    recit/
      style.md
      hooks.md
      inspiration/
        videos/
        analyses/
    micro-histoire/
    extrait-recit/
    timelapse/
    podcast/

  bibliotheque/                       assets réutilisables dans plusieurs vidéos
    catalogue.json                    inventaire de tous les assets réutilisables
    commun/                           mêmes sous-dossiers pour creation/ et recits/
      polices/
      images/                         logos, illustrations, fonds, modèles de miniatures
      videos/                         génériques, transitions, animations
      musiques/
      ambiances/                      pluie, vent, taverne : en boucle sous la narration
      sons/                           sons ponctuels : whoosh, pop, impact
      voix/                           phrases réutilisables (intro, outro), en FR ou en EN
    creation/
    recits/

  artistes/                           une fiche par artiste collaborateur
    nom-artiste/
      fiche.json
      accord/                         preuve d'accord écrit

  auteurs/                            une fiche par auteur ou autrice de récits
    nom-auteur/
      fiche.json                      nom, liens, contact, liste de ses récits
                                      (l'autorisation de chaque récit reste dans le projet)

  chaine-creation/
    2026-11-08_premiere-carte/
      rushes/                         jamais modifiés
      assets/                         assets propres à cette vidéo
      travail/                        transcriptions, plan de montage, fichiers temporaires
      versions/
        v1/
          apercu.mp4
          plan.json
          retours.json                commentaires horodatés saisis dans l'interface
        v2/
      exports/
        youtube/
        formats-courts/               9:16, pour TikTok, Reels et Shorts
        instagram/                    posts et carrousels
      metadata.json
      stats.json                      statistiques saisies après publication

  chaine-recits/
    2026-11-06_le-dernier-dragon/
      texte/
      voix/
        fr.wav
        en.wav
      assets/                         visuels propres à cette vidéo, dont ceux des artistes
        nom-artiste/
      autorisation/                   preuve d'accord de l'auteur
      travail/
      versions/
      exports/
        youtube/                      vidéo avec piste FR
        youtube-piste-en/             piste audio EN seule (MP3), à ajouter dans YouTube Studio
        podcast-fr/
        podcast-en/
        formats-courts/
        instagram/
      metadata.json
      stats.json

  corbeille/                          projets supprimés depuis l'interface, restaurables
                                      (vidée uniquement à la main par l'utilisateur)

  parametres.json                     réglages communs aux machines, modifiables depuis l'interface
```

Nommage des dossiers de projet : `AAAA-MM-JJ_titre-en-kebab-case` (date de publication prévue).

Réglages propres à chaque machine (chemin de `creations/`, chemins de `ffmpeg`, `ffprobe`, `claude`, whisper.cpp) : dans `config.local.json` à la racine du dépôt, non versionné, modifiable depuis l'écran Paramètres. Tout le reste est dans `creations/parametres.json`.

## 5. Guides de style et inspiration

Chaque catégorie a son dossier dans `guides/`. C'est là que l'utilisateur définit comment il veut monter ce type de contenu. L'outil lit ce dossier avant chaque proposition.

### Les vidéos d'inspiration

L'utilisateur dépose des vidéos de référence dans `inspiration/videos/` (par exemple des threads horreur pour la catégorie `recit`). Un modèle de langage ne regarde pas une vidéo directement : l'outil doit d'abord la convertir en éléments lisibles, une seule fois par vidéo, dans `inspiration/analyses/<nom-video>/` :

- `transcription.json` : texte avec horodatage par mot
- `coupes.json` : horodatage de chaque changement de plan (détection de scènes ffmpeg), pour mesurer le rythme
- `images/` : une image toutes les quelques secondes et à chaque coupe
- `audio.json` : niveaux sonores, moments de musique et de silence
- `analyse.md` : synthèse rédigée (durée moyenne des plans, structure de l'accroche, place de la musique, textes à l'écran, rythme de narration)

Les vidéos d'inspiration restent privées et locales. Elles servent uniquement de référence : aucun extrait ne doit jamais se retrouver dans un export.

### Modèle de `style.md`

```markdown
# Style : récit

## Objectif
Ce que le spectateur doit ressentir.

## Structure
1. Accroche (0-15 s)
2. Mise en place de l'univers
3. Montée de tension
4. Climax
5. Fin et appel vers la chaîne / l'auteur

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
```

### Modèle de `hooks.md`

```markdown
# Hooks : récit

## Types d'accroche qui marchent
- Commencer au milieu de l'action
- Une question sans réponse
- Une phrase étrange sortie de l'histoire

## Exemples validés
Accroches déjà utilisées et leurs résultats (stat d'accroche : CTR, vus vs balayés).

## Règles
- Durée maximale avant la première information forte :
```

Les résultats réels (stats notées par l'utilisateur) alimentent `hooks.md` au fil du temps : c'est la mémoire de ce qui fonctionne.

## 6. Assets et artistes

### Deux niveaux d'assets

| | Bibliothèque (`bibliotheque/`) | Assets de vidéo (`<projet>/assets/`) |
| --- | --- | --- |
| Usage | Réutilisés dans plusieurs vidéos | Propres au style d'une seule vidéo |
| Exemples | Logos, bouton abonnement, cartouche avec le nom d'une personne, génériques, musiques, polices | Illustrations d'un récit, décor, personnages dessinés pour cette histoire |
| Qui les crée | L'utilisateur (identité graphique faite par lui) | L'utilisateur ou un artiste invité |

Types d'assets : police, image, vidéo, musique, ambiance sonore, son ponctuel, voix (avec sa langue, FR ou EN). Les assets se regroupent par étiquettes libres (« identité », « générique », « halloween »…).

Les éléments animés (cartouche nom, bouton abonnement, logo animé) seront des composants Remotion paramétrables, ajoutés en phase 3 : on leur passe un texte, une couleur ou une durée, et ils s'insèrent dans n'importe quelle vidéo. Ils utilisent les polices et les images étiquetées « identité » de la bibliothèque.

Un asset de vidéo peut être promu dans la bibliothèque s'il devient réutilisable et que ses droits le permettent.

### Le catalogue

`bibliotheque/catalogue.json` recense chaque asset réutilisable, pour que l'outil sache ce qui existe et le propose au montage :

```json
{
  "assets": [
    {
      "id": "outro-recits-en",
      "type": "voix",
      "chaine": "recits",
      "chemin": "recits/voix/outro-recits-en.wav",
      "description": "Phrase de fin : invitation à s'abonner, en anglais",
      "etiquettes": ["outro"],
      "langue": "en",
      "source": "utilisateur",
      "artiste": null,
      "licence": "",
      "utilisations": ["2026-11-06_le-dernier-dragon"]
    }
  ]
}
```

`chemin` est relatif à `bibliotheque/`. `langue` vaut `fr`, `en` ou `null` (obligatoire pour une voix, possible pour une image ou une vidéo qui contient du texte). `source` vaut `utilisateur`, `artiste` (avec l'identifiant de sa fiche dans `artiste`) ou `externe` (avec les conditions dans `licence`). Le champ `utilisations` garde l'historique des vidéos qui ont utilisé l'asset.

### Les artistes invités

Pour les récits, des artistes réalisent les visuels d'une vidéo en échange de visibilité. Chaque artiste a une fiche dans `artistes/<nom>/fiche.json` :

```json
{
  "nom": "Nom ou pseudo",
  "liens": {
    "instagram": "https://...",
    "site": "https://..."
  },
  "contact": "...",
  "accord": {
    "date": "2026-11-01",
    "monetisation": true,
    "reutilisationAutorisee": false,
    "preuve": "accord/message-2026-11-01.png"
  },
  "videos": ["2026-11-06_le-dernier-dragon"]
}
```

Règles :
- Les visuels d'un artiste vont dans `<projet>/assets/<nom-artiste>/`.
- Un projet qui contient des assets d'artiste ne peut pas être exporté si l'artiste n'a pas de fiche avec un accord et une preuve.
- Le crédit de l'artiste est ajouté automatiquement : cartouche à l'écran à sa première apparition, mention en fin de vidéo, et ligne prête à copier pour la description avec ses liens.
- Un visuel d'artiste n'est réutilisé dans une autre vidéo que si `reutilisationAutorisee` est vrai.
- Le champ `videos` de la fiche garde l'historique de toutes ses collaborations.

## 7. Métadonnées d'un projet

Exemple pour un récit :

```json
{
  "categorie": "recit",
  "chaine": "recits",
  "titre": { "fr": "Le dernier dragon", "en": "The Last Dragon" },
  "description": { "fr": "...", "en": "..." },
  "auteur": {
    "nom": "Pseudo de l'auteur",
    "source": "https://www.reddit.com/...",
    "estUtilisateur": false
  },
  "autorisation": {
    "obtenue": true,
    "date": "2026-11-01",
    "lecture": true,
    "traductionAnglaise": true,
    "monetisation": true,
    "plateformes": ["youtube", "spotify", "deezer", "apple-podcasts", "tiktok", "instagram"],
    "preuve": "autorisation/message-2026-11-01.png"
  },
  "artistes": ["nom-artiste"],
  "assetsBibliotheque": ["outro-recits-en", "generique-recits"],
  "langues": ["fr", "en"],
  "versionValidee": "v3",
  "datePublicationPrevue": "2026-11-06"
}
```

Règles métier :
- Un récit d'un autre auteur ne peut pas être exporté si `autorisation.obtenue` est faux ou si la preuve est absente. Une version anglaise exige `traductionAnglaise: true`.
- Une histoire de l'utilisateur est signée « Une histoire originale de [pseudo] » en début de vidéo, avec un renvoi vers la chaîne 1.
- Les histoires longues destinées à devenir un roman ne sont jamais exportées en entier : extraits seulement.

## 8. Spécifications d'export

Valeurs de référence à vérifier dans la documentation officielle au moment du développement.

| Sortie | Format | Résolution | Audio |
| --- | --- | --- | --- |
| YouTube long | MP4, H.264, 16:9 | 1920x1080 (ou 3840x2160) | AAC stéréo, environ -14 LUFS |
| Format court | MP4, H.264, 9:16 | 1080x1920 | AAC stéréo, environ -14 LUFS |
| Aperçu de relecture | MP4, H.264 | 640 px de large | AAC |
| Post / carrousel Instagram | JPG ou PNG, 4:5 | 1080x1350 | — |
| Piste audio EN YouTube | MP3 | — | Durée identique à la vidéo |
| Podcast | MP3 | — | 128 à 192 kbps, environ -16 LUFS |
| Pochette podcast | JPG ou PNG carré | 3000x3000 | — |

Formats courts : sous-titres incrustés, textes loin des bords haut et bas (interfaces des applis), information forte dès la première seconde.

Récits bilingues : une seule vidéo avec la piste française, plus une piste audio anglaise exportée à part. Aucun texte en français incrusté sur les visuels des récits.

## 9. Interface web et architecture

L'utilisateur ne veut pas taper de commandes au quotidien. Tout le travail lourd se fait dans un backend, et l'utilisateur pilote tout depuis une interface web locale : créer, suivre, prévisualiser, commenter, itérer, valider.

### Architecture

- **Un seul dépôt TypeScript** (npm workspaces) avec trois parties : `backend/` (Node 24 + Fastify), `frontend/` (React + Vite + React Router) et `shared/` (interfaces communes). Tout tourne en local et s'ouvre dans le navigateur sur `localhost`.
- **Windows et macOS** : l'outil doit fonctionner sur les deux (station Windows principale + MacBook). Aucune dépendance Python. Chemins des binaires externes (`ffmpeg`, `ffprobe`, `claude`, whisper.cpp) réglables dans `parametres.json`. Tous les chemins enregistrés dans les JSON sont relatifs à `creations/`.
- **Backend** : une API HTTP pour toutes les opérations (créer, lire, modifier, supprimer projets, assets, artistes, auteurs, guides, stats, paramètres) et une file de tâches pour les traitements longs (transcription, analyse, rendu d'aperçu, rendu final, export podcast).
- **Progression en temps réel** : chaque tâche remonte son avancement (étape en cours, pourcentage lu dans la sortie de ffmpeg ou de Remotion, temps restant estimé) vers l'interface via Server-Sent Events ou WebSocket.
- **Prévisualisation** : le backend sert les aperçus et les exports en streaming (requêtes HTTP Range) pour les lire directement dans le navigateur.
- **Intelligence de montage, via l'abonnement Claude de l'utilisateur** : le backend ne fait pas appel à l'API facturée à l'usage. Il lance la commande `claude -p` de Claude Code (mode non interactif), installée et connectée avec l'abonnement Pro ou Max de l'utilisateur, sur sa propre machine. Claude propose les plans de montage, choisit les extraits courts et intègre les commentaires. Chaque proposition est écrite dans `plan.json` et validée par l'utilisateur dans l'interface avant tout rendu.
- **Stockage** : l'arborescence de fichiers et les JSON restent la source de vérité, lisibles par l'utilisateur et par Claude Code. Pas de base de données en V1 ; SQLite seulement si les listes deviennent lentes.
- **Une tâche de rendu à la fois** par défaut (réglable), pour ne pas saturer la machine.

### Appeler Claude depuis le backend

Le backend lance `claude -p` comme un sous-processus, dans le dossier du projet concerné :

- `--output-format stream-json --verbose` : le backend lit les événements au fil de l'eau et les affiche dans l'interface (Claude analyse, Claude rédige le plan…).
- `--output-format json --json-schema <schéma>` : pour obtenir un `plan.json` conforme à un schéma, lu dans le champ `structured_output`.
- `--resume <session_id>` : chaque projet garde l'identifiant de sa session Claude dans `metadata.json`, pour que les itérations (v2, v3…) gardent le contexte des échanges précédents.
- `--allowedTools` : n'autoriser que les outils nécessaires (lecture des fichiers du projet, écriture dans `travail/` et `versions/`).
- `--append-system-prompt-file` : donner à Claude les règles de l'outil (lire le guide de style de la catégorie, respecter le schéma du plan, ne jamais toucher aux rushes).

### Consignes réutilisables : skills et commandes du projet

Les consignes de montage ne sont pas réécrites à chaque appel. Elles vivent dans le dossier `.claude/` du dépôt, sous forme de skills (un par type de travail) :

```
.claude/
  skills/
    analyser-inspiration/SKILL.md     transformer une vidéo de référence en analyse.md
    proposer-plan/SKILL.md            lire le guide de style, les rushes transcrits, et écrire plan.json
    integrer-retours/SKILL.md         lire retours.json, produire le plan de la version suivante
    proposer-extraits/SKILL.md        choisir les extraits courts d'une vidéo longue validée
```

Chaque skill décrit les étapes dans l'ordre, les fichiers à lire, le format de sortie attendu et ce qui est interdit. Le backend l'appelle par son nom, par exemple `claude -p "/proposer-plan 2026-11-06_le-dernier-dragon"`, et Claude Code charge les consignes automatiquement. Les mêmes skills restent utilisables à la main dans une session Claude Code classique, ce qui permet de les tester et de les améliorer avant de les brancher sur l'interface.

Points d'attention :
- **Ne pas utiliser `--bare`** : ce mode ignore la connexion par abonnement et exige une clé API.
- **Aucune variable `ANTHROPIC_API_KEY` dans l'environnement du backend** : elle remplacerait l'abonnement et déclencherait une facturation à l'usage.
- **Usage personnel uniquement** : l'outil tourne sur la machine de l'utilisateur avec son propre compte. Il n'est pas conçu pour être distribué ni utilisé par d'autres personnes avec cette connexion.
- **Limites d'usage partagées** : les appels de l'outil comptent dans les mêmes limites que Claude et Claude Code. L'interface affiche clairement une erreur de limite atteinte et permet de relancer plus tard.
- Claude ne fait que réfléchir et écrire des fichiers JSON ou Markdown. Les rendus (ffmpeg, Remotion) et la transcription tournent en dehors de Claude et ne consomment pas l'abonnement.

### Les écrans

| Écran | Ce que l'utilisateur y fait |
| --- | --- |
| Tableau de bord | Voir les projets en cours et leur étape, les tâches en cours avec leur barre de progression, les prochaines publications prévues |
| Nouveau projet | Choisir chaîne, catégorie, titre, date prévue, auteur et artistes ; glisser les rushes ou les choisir dans `inbox/` |
| Projet | Suivre les étapes (rushes, analyse, plan, aperçu, validé, exporté) ; lire et modifier le plan de montage ; lancer un aperçu ; voir une barre de progression par sortie (YouTube, format court, podcast FR, podcast EN…) ; regarder l'aperçu ; commenter ; comparer les versions ; valider et exporter ; copier la description avec les crédits |
| Exports | Voir les fichiers prêts par plateforme, les ouvrir ou les télécharger, cocher « publié » une fois mis en ligne à la main |
| Bibliothèque | Ajouter, modifier, supprimer des assets ; les prévisualiser ; voir dans quelles vidéos ils ont servi |
| Auteurs et artistes | Gérer les fiches, les accords et leurs preuves ; voir l'historique des collaborations |
| Guides | Éditer `style.md` et `hooks.md` ; déposer des vidéos d'inspiration ; lancer leur analyse et lire `analyse.md` |
| Statistiques | Saisir les stats de chaque vidéo par plateforme ; voir leur évolution en graphiques ; relier chaque résultat au hook utilisé |
| Paramètres | Chemins des dossiers, préréglages d'export (résolutions, niveaux sonores), modèle de transcription, modèle Claude à utiliser, nombre de rendus simultanés |

### Commentaires horodatés

Dans le lecteur de l'écran Projet, l'utilisateur met la vidéo en pause et écrit un commentaire : il est rattaché à cet instant précis (« 0:42 : coupe trop tôt »). Les commentaires apparaissent comme des repères sur la barre de lecture et sont enregistrés dans `versions/vN/retours.json` :

```json
{
  "version": "v2",
  "commentaires": [
    { "temps": 42.5, "texte": "Coupe trop tôt, garder la fin de la phrase", "traite": false },
    { "temps": null, "texte": "Musique un peu trop forte sur toute la vidéo", "traite": false }
  ]
}
```

Un commentaire sans `temps` s'applique à toute la vidéo. Quand l'outil produit la version suivante, il indique pour chaque commentaire ce qu'il a changé.

### Statistiques

En V1, les statistiques sont saisies à la main dans l'interface, après publication, avec la même grille que le guide des statistiques : stat d'accroche (CTR, vus vs balayés), rétention ou complétion, partages ou enregistrements, abonnés gagnés. Elles sont enregistrées dans `stats.json` de chaque projet. Les meilleurs hooks peuvent être ajoutés à `hooks.md` en un clic. Plus tard, hors V1 : import automatique en lecture seule via les API des plateformes.

## 10. Phases de développement

1. **Socle** : backend et interface web, arborescence, création de projets depuis `inbox/` ou par glisser-déposer, `metadata.json`, règles d'autorisation (auteurs et artistes), écrans Bibliothèque, Auteurs et artistes, Paramètres.
2. **Analyse** : transcription des rushes et analyse des vidéos d'inspiration, avec progression visible dans l'interface.
3. **Plan et aperçu** : plan de montage basé sur le guide de style, rendu basse résolution, lecteur, commentaires horodatés, boucle de versions.
4. **Export final** : rendu pleine qualité, normalisation audio, rangement par plateforme, écran Exports.
5. **Formats courts** : proposition d'extraits depuis une vidéo longue validée, recadrage 9:16, sous-titres incrustés.
6. **Podcast** : export audio FR et EN depuis un projet récit.
7. **Statistiques** : saisie et graphiques.

Chaque phase doit être utilisable seule depuis l'interface avant de passer à la suivante. Hors périmètre V1 : publication automatique et import automatique des statistiques.

## 11. Démarche : s'inspirer de l'existant, puis construire son outil

L'utilisateur travaillera tous les jours avec cet outil. La démarche est donc :

1. Étudier les dépôts ci-dessous, les tester sur de vrais rushes, repérer ce qui fonctionne bien (méthode, architecture, qualité de rendu).
2. Construire un outil propre à l'utilisateur, adapté à son arborescence, ses guides de style, sa bibliothèque et ses règles, en reprenant les bonnes idées de ces dépôts plutôt qu'en les adoptant tels quels.

Dépôts étudiés (clonés dans `../inspiration`). L'étude complète, avec ce qu'on reprend, ce qu'on écarte et les licences, est dans `docs/inspirations.md`. On s'inspire, on ne copie aucun fichier.

- `browser-use/video-use` (MIT) : montage depuis un dossier de rushes, propose une stratégie et attend validation avant de rendre. Méthode, règles de rendu ffmpeg, format du plan.
- `diffusionstudio/editor` (MPL-2.0, aucune copie) : éditeur piloté par agent. Monorepo, modèle de tâches, bibliothèque, lancement de `claude`.
- `jipraks/yt-short-clipper` (MIT) : vidéo YouTube vers formats courts. Flux « proposer puis sélectionner », recadrage 9:16, sous-titres mot à mot.
- `yihui-dev/awesome-opus5-5-videos` (prompts aux auteurs) : animations écrites en code par Claude. Inspiration pour les composants animés.
- `remotion-dev/skills` : bonnes pratiques officielles Remotion. Player React, rendu depuis Node, sous-titres, compositions paramétrées.
- `jperrello/shorts` (sans licence, idées seulement) : étapes atomiques en skills, `claude -p` par abonnement, profil de style des vidéos de référence.
- `AgriciDaniel/claude-shorts` (MIT) : vidéo longue vers formats courts. Notation des extraits, recalage des bornes, rendu Remotion.

## 12. Conventions de code

- TypeScript strict, backend et frontend. Jamais de type `any` : utiliser des `interface`, partagées entre backend et frontend pour les données échangées.
- Code le plus simple possible, propre et solide. Pas d'abstraction inutile.
- Pas de commentaires inutiles.
- Utiliser le MCP context7 pour consulter la documentation des bibliothèques.
- Aucune clé API Anthropic, aucun SDK client Anthropic appelant l'API : Claude est toujours appelé via la commande `claude` de Claude Code, connectée à l'abonnement.
- ffmpeg pour le traitement vidéo et audio.
- `README.md` est le guide d'utilisation : à chaque étape, mettre à jour le tableau d'avancement, ajouter le déroulé des nouvelles tâches dans « Guide par tâche » et les messages d'erreur utiles dans « En cas de problème ».

## 13. Questions ouvertes

- Nom de l'univers et des deux chaînes.
- Identité graphique des deux chaînes (créée par l'utilisateur, à intégrer dans `bibliotheque/*/identite/`).
- Hébergeur de podcast.
- Abonnement Claude suffisant pour le volume (Pro ou Max), à juger après quelques semaines d'usage réel.
- Emplacement de `creations/` et partage entre le PC Windows et le MacBook (PC seul, disque externe ou synchronisation). En attendant, tous les chemins enregistrés sont relatifs à `creations/`, et on évite de placer `travail/` et `versions/` dans un dossier synchronisé.

### Décisions prises (2026-11-02)

- **Frameworks** : backend Node 24 + TypeScript + Fastify ; frontend React + Vite + React Router ; `shared/` pour les interfaces communes. React est retenu parce que Remotion est en React : les composants animés servent à la fois à l'aperçu dans l'interface et au rendu.
- **Transcription** : whisper.cpp en local (modèle visé : `large-v3-turbo`), lancé comme un binaire externe, accéléré par CUDA ou Vulkan sous Windows et par Metal sur Mac. À valider sur de vrais rushes en phase 2, en comparaison avec `@remotion/whisper-webgpu`.
- **Rendu** : ffmpeg pour les coupes, la concaténation et la normalisation audio ; Remotion pour les composants animés, les sous-titres animés et les récits.
