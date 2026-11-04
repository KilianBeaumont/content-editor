# Inspirations : étude des dépôts de référence

Étude menée le 2026-11-02 sur les dépôts présents dans `../inspiration`, au regard de `CLAUDE.md`. Objectif : savoir quoi reprendre (idées, méthode, architecture) et quoi écarter, avant d'écrire la moindre ligne de code.

Huit dépôts étudiés : les quatre déposés au départ dans `../inspiration` (`video-use`, `editor`, `yt-short-clipper`, `awesome-opus5-5-videos`), puis les trois autres cités dans `CLAUDE.md` §11, clonés ensuite (`remotion-dev/skills` dans `remotion-skills/`, `jperrello/shorts`, `AgriciDaniel/claude-shorts`), et `haidrrrry/claude-remotion-skill` ajouté le 2026-11-04 pour le motion design Remotion.

## Vue d'ensemble

| Dépôt | Licence | Stack | Ce que c'est | Pertinence |
| --- | --- | --- | --- | --- |
| `browser-use/video-use` | MIT | Skill Claude Code + scripts Python + ffmpeg | Montage conversationnel depuis un dossier de rushes | Très forte : méthode, règles de rendu ffmpeg, format du plan |
| `diffusionstudio/editor` | MPL-2.0 (marque exclue) | Monorepo TypeScript, Electron, SolidJS, MCP | Éditeur vidéo complet piloté par agent, composition en JSX | Forte sur l'architecture, la bibliothèque, l'appel à Claude Code ; trop lourd à reprendre tel quel |
| `jipraks/yt-short-clipper` | MIT (polices de licence inconnue) | Tauri + React + sidecar Python (yt-dlp, MediaPipe) | Vidéo YouTube longue vers formats courts 9:16 | Moyenne : flux « proposer puis sélectionner » des extraits, recadrage, sous-titres mot à mot |
| `yihui-dev/awesome-opus5-5-videos` | MIT pour la liste ; prompts et vidéos aux auteurs | Liste de 703 prompts (Markdown + JSON) | Vidéos en code générées par Claude Opus 5.5 | Faible pour l'architecture, utile pour les composants animés et les visuels des récits |
| `remotion-dev/skills` | Aucun fichier de licence ; contenu issu du monorepo Remotion (licence Remotion) | Skills Markdown + exemples TSX | Bonnes pratiques officielles Remotion pour agents | Forte pour le rendu Remotion : player, rendu programmatique, sous-titres, polices, paramètres |
| `jperrello/shorts` | **Aucune licence**, et l'auteur demande explicitement de ne pas l'utiliser | 52 skills Claude Code + Bash/Python, macOS | Usine automatique de Shorts depuis des podcasts | Forte sur la méthode : skills atomiques, `claude -p` par abonnement, analyse de style des vidéos de référence, boucle des statistiques |
| `haidrrrry/claude-remotion-skill` | MIT | Skill Claude Code (Markdown) + projet d'exemples Remotion | Règles de motion design et boucle « rendre, regarder les images, corriger » | Forte pour la qualité des animations Remotion et la manière de les vérifier |
| `AgriciDaniel/claude-shorts` | MIT | Skill Claude Code + Python (faster-whisper) + Remotion | Vidéo longue vers formats courts, sous-titres animés Remotion | Moyenne : grille de notation des extraits, recalage des bornes, rendu Remotion depuis Node, specs d'export |

### Règle de licence appliquée

On s'inspire, on ne copie pas : aucun fichier, aucun extrait de code ni aucun prompt de ces dépôts ne sera recopié dans le projet. Concrètement :

- **MIT** (`video-use`, `yt-short-clipper`) : la copie serait permise avec la mention du copyright, mais on choisit de réécrire en TypeScript à partir des idées.
- **MPL-2.0** (`editor`) : copyleft par fichier. Un fichier copié resterait sous MPL. Raison de plus pour ne reprendre que les concepts. Les assets de marque de Diffusion Studio ne sont couverts par aucune licence libre.
- **Polices** de `yt-short-clipper/src-tauri/fonts` : licence inconnue d'après leur propre `FONT_LICENSES.md`. On ne les réutilise pas.
- **Prompts** de `awesome-opus5-5-videos` : ils appartiennent à leurs auteurs. Ils servent d'inspiration uniquement et ne sont jamais reproduits.
- **`jperrello/shorts`** : pas de licence, donc tous droits réservés, et le README demande de ne pas l'utiliser. Lecture seule pour les idées ; aucun fichier, prompt ni seuil chiffré n'est repris.
- **`remotion-dev/skills`** : pas de fichier de licence dans le dépôt. On ne copie rien. On peut en revanche **installer** ces skills comme prévu par Remotion (`npx skills add remotion-dev/skills`) pour aider Claude quand il écrit nos compositions pendant le développement.
- **Remotion lui-même** : licence spécifique, gratuite pour un particulier, payante pour certaines entreprises. À relire au moment de l'installation (la skill `remotion-license` renvoie vers les conditions officielles).
- **`claude-shorts`** : MIT ; on réécrit quand même au lieu de copier.
- **`claude-remotion-skill`** : MIT ; aucune copie, on reformule les principes dans nos propres skills et on réécrit les composants.

---

## 1. `browser-use/video-use`

### Ce qu'il fait

Un skill Claude Code, et pas une application. L'utilisateur lance Claude dans un dossier de rushes et lui demande un montage. L'agent :

1. inventorie les sources (`ffprobe`), les transcrit (ElevenLabs Scribe : mot à mot, hésitations conservées, événements audio, locuteurs) ;
2. compacte les transcriptions en une vue lisible (`takes_packed.md`) ;
3. pose des questions adaptées au contenu, puis propose une stratégie en quelques phrases et **attend l'accord** ;
4. écrit une EDL (`edl.json`) et rend la vidéo avec ffmpeg ;
5. **s'auto-évalue sur le rendu** (images à chaque coupe, forme d'onde, niveaux sonores) avant de montrer quoi que ce soit, en trois passes au maximum ;
6. consigne les décisions dans `project.md` pour la session suivante.

### Organisation

```
SKILL.md                 principes, 12 règles dures, déroulé en 8 étapes, formats, anti-patterns
install.md               installation pilotée par l'agent
helpers/
  transcribe.py          extraction audio 16 kHz mono + appel Scribe, cache par source
  transcribe_batch.py    4 transcriptions en parallèle
  pack_transcripts.py    JSON mot à mot → phrases [début-fin], coupées sur silences ≥ 0,5 s
  timeline_view.py       planche : images + forme d'onde + mots + silences, pour une plage donnée
  render.py              extraction par segment → concat sans réencodage → overlays → sous-titres → loudnorm
  grade.py               étalonnage par chaîne de filtres ffmpeg
skills/manim-video/      skill secondaire pour animations Manim
tests/                   tests du rendu (fps, orientation, sous-titres)
```

Toutes les sorties vont dans `<dossier>/edit/` : les sources ne sont jamais modifiées.

### Ce qu'on reprend

**Méthode**

- **Claude lit la vidéo au lieu de la regarder.** La transcription est regroupée en phrases horodatées `[002.52-005.36] texte`, coupées sur les silences et les changements de locuteur. Environ 10 fois moins de tokens que le JSON brut, tout en gardant la précision au mot. Les images ne sont produites qu'à la demande, aux moments de décision.
- **Déroulé « demander → confirmer → exécuter → s'auto-évaluer → mémoriser »**, identique à nos principes (plan avant rendu, l'utilisateur valide tout).
- **Structure du SKILL.md** : principes, puis règles dures (correction technique, non négociable), puis exemples présentés comme tels (le goût reste libre), puis formats de sortie, puis anti-patterns. Bon gabarit pour nos quatre skills.
- **EDL comme contrat** : `sources` + `ranges[{source, start, end, beat, quote, reason}]` + `overlays` + `subtitles` + `total_duration_s`. Les champs `quote` et `reason` rendent chaque coupe lisible par un humain : exactement ce qu'il faut afficher dans l'écran Projet.
- **Brief de l'agent monteur** : contexte, structure attendue, lapsus à éviter, durée cible, sortie JSON stricte, contrôle de la durée totale par l'agent lui-même.
- **Auto-évaluation avant présentation** : durée réelle comparée au plan (`ffprobe`), loudness intégrée et true peak (`ebur128`), images de part et d'autre de chaque coupe. Avec un plafond de passes pour ne pas boucler.

**Règles techniques de rendu (ffmpeg)**

- Couper sur une frontière de mot, avec une marge de 30 à 200 ms (les horodatages des transcripteurs dérivent de 50 à 100 ms).
- Fondu audio de 30 ms à chaque bord de segment, contre les « clics ».
- Extraire chaque segment au même codec et à la même cadence, puis concaténer sans réencodage (`concat` + `-c copy`), plutôt qu'un seul graphe de filtres géant.
- Overlays décalés dans le temps (`setpts=PTS-STARTPTS+T/TB`) ; sous-titres appliqués **en dernier**.
- Sous-titres recalculés sur la timeline de sortie : `t_sortie = t_mot - début_segment + décalage_segment`.
- Loudness en deux passes (`loudnorm`, -14 LUFS, -1 dBTP) pour le final, une passe pour l'aperçu.
- Détection HDR (tone mapping) et orientation réelle (rotation dans les métadonnées) avant de redimensionner.
- Trois niveaux de rendu : brouillon, aperçu, final. Correspond à notre aperçu 640 px puis rendu pleine qualité.
- Marge basse des sous-titres verticaux pensée comme une règle de zone sûre (interfaces TikTok, Reels, Shorts), et non comme un choix de goût.

**Transcription**

- Cache par fichier source, jamais de retranscription d'une source inchangée.
- Contrôle d'une piste audio silencieuse et choix de la piste quand le fichier en contient plusieurs, avant de lancer la transcription.

**Son et animation (pour les récits et la bibliothèque)**

- Musique baissée de 12 à 15 dB sous la voix ; peu d'effets sonores, chacun lié à un événement visible.
- Animations jamais linéaires (easing cubique), dernière image tenue au moins 1 s, révélation calée sur le mot clé de la narration.
- Vérifier qu'une police a bien chargé avant de rendre (sinon repli silencieux sur une police système).
- Brief d'animation autonome : spec technique (résolution, fps, durée), palette, chemin de police, timeline image par image, liste de ce qui est interdit, checklist de livraison.

### Ce qu'on écarte

| Élément | Raison |
| --- | --- |
| ElevenLabs Scribe | API payante avec clé, audio envoyé dans le cloud (y compris les voix et textes d'auteurs non publiés). Voir la décision sur la transcription. |
| Scripts Python | Notre dépôt est en TypeScript ; on appelle ffmpeg directement depuis Node. |
| Pilotage purement conversationnel dans le terminal | Chez nous, la proposition devient un `plan.json` structuré, relu et validé dans l'interface. |
| Animations générées par sous-agents à chaque vidéo | Coûteux en quota d'abonnement et non reproductible ; on préfère des composants de bibliothèque paramétrables. |
| Quatre moteurs d'animation (Manim, HyperFrames, Remotion, PIL) | Un seul moteur (Remotion) pour garder la cohérence et partager React avec l'interface. |
| Étalonnage automatique | Pas prioritaire en V1 ; un préréglage optionnel pourra venir plus tard. |
| Installation par lien symbolique dans `~/.claude/skills` | `ln -s` est peu fiable sous Windows ; nos skills vivent dans `.claude/skills` du dépôt. |
| Polices macOS codées en dur (Helvetica, Menlo) | Non portable sous Windows. |

### Où ça sert dans notre outil

- **Phase 2 (analyse)** : extraction audio, cache, `transcription.json`, vue compacte `transcription.md` lue par Claude.
- **Phase 3 (plan et aperçu)** : schéma de `plan.json` inspiré de l'EDL, skill `proposer-plan`, moteur de rendu ffmpeg par segments, vérifications automatiques après chaque aperçu.
- **Phase 4 (export)** : loudnorm en deux passes, cibles par plateforme.
- **Phase 5 (formats courts)** : règles de sous-titres et de zone sûre.

---

## 2. `diffusionstudio/editor` (Diffusion Studio)

### Ce qu'il fait

Une application de bureau (Electron, avec une version web) qui transforme un agent (Claude Code, Codex…) en monteur. Une composition est un dossier de fichiers JSX (SolidJS) : modifier le canevas réécrit le code, modifier le code redessine le canevas. L'application expose ses outils d'inspection en serveur MCP et en CLI `diffusion` : `probe`, `grab`, `filmstrip`, `waveform`, `transcribe`, `listen`, `capture`, `check`. La génération IA (images, vidéo, voix, musique) passe par leur API payante.

### Organisation

Monorepo npm workspaces :

```
apps/web          interface d'édition (Solid + Vite)
apps/desktop      coquille Electron
apps/cli          CLI `diffusion`, client du serveur MCP de l'app
packages/runtime  moteur headless (ECS koota, décodage média, capture)
packages/reconciler, jsx   évaluation et vocabulaire des compositions
packages/assets   bibliothèque d'un projet : manifeste assets.yml, hash, probe
packages/encoder  encodage dans le navigateur (mediabunny / WebCodecs)
packages/dapi     contrat des outils (zod) partagé app / CLI / MCP
packages/agent-chat  hôte qui pilote Claude Code ou Codex
docs/skills, docs/reference, docs/guides, docs/brand   consignes pour l'agent
```

### Ce qu'on reprend

**Architecture**

- **Monorepo npm workspaces en TypeScript avec un paquet de contrat partagé** (`dapi`, `api-contract`). Chez nous : `backend/`, `frontend/` et un petit `shared/` d'interfaces communes.
- **Outils conçus pour un agent** : chaque commande renvoie un seul objet JSON, les erreurs vont sur stderr avec un code de sortie 1. Si Claude doit appeler un outil du backend (par exemple une planche d'images), il suivra cette convention.
- **Format de transcription** : `segments[{text, speaker, words[{text, start, end}]}]`, JSON indenté pour pouvoir le parcourir ligne à ligne ; l'agent cherche une phrase au lieu de tout charger.
- **Vérification structurelle avant rendu** (`check`) : trous noirs, éléments jamais visibles, sources manquantes. Chez nous : validation de `plan.json` par le backend avant tout aperçu (sources existantes, plages dans la durée, pas de chevauchement, autorisations des auteurs et artistes).
- **`capture` plutôt qu'un rendu pour vérifier** : quelques images fixes de ce que le rendu produira. Avec Remotion, l'équivalent est le rendu d'images fixes, utile pour des vignettes dans le plan et pour une vérification rapide.
- **Modèle de tâche** : `queued → running → succeeded | failed | canceled`, avec `phase`, `progress` (0 à 1) et temps restant estimé. Reprend exactement ce que doit afficher notre tableau de bord.

**Bibliothèque et identité**

- **Manifeste tolérant** : un enregistrement invalide est ignoré sans casser toute la bibliothèque ; hash de contenu pour détecter qu'un fichier a changé ; chaque asset garde la trace de son origine. À appliquer à `catalogue.json`.
- **Style en couches** : consignes du projet > guide de la catégorie > style par défaut, chaque couche ne remplissant que les trous de la précédente.
- **Catalogue lisible des composants** (`library.md`) avec leurs entrées, et la règle « réutiliser l'existant avant de créer ». Composants types : jetons de design (couleurs, typo, zones sûres), cartouche nom (*lower third*), carte titre, carte de fin. Correspond à `bibliotheque/*/identite/` et `composants/`.
- **Règles de composition** à intégrer à nos skills : budget d'ornement à zéro par défaut ; ne pas assombrir ni flouter l'image pour rendre un texte lisible ; le texte ponctue, il n'explique pas ; vérifier après chaque étape, pas seulement à la fin.

**Formats courts (guide « podcast clipping »)**

- Découper un long audio en fenêtres, demander pour chacune des candidats avec début/fin, résumé d'une ligne et **note de force du hook**, avec **l'autonomie de l'extrait** (compréhensible sans contexte) comme exigence dure.
- Caler ensuite les bornes au mot près avec la transcription et la forme d'onde (entrée sur le premier mot du hook, sortie dans le silence qui suit la chute).
- Recadrage 9:16 sans apprentissage automatique : la vidéo garde son ratio et on déplace la fenêtre horizontalement à chaque changement de locuteur.

**Appel de Claude Code** (`packages/agent-chat/src/host/`)

- Utilise le binaire `claude` de l'utilisateur (donc son abonnement), avec un identifiant de session choisi à l'avance puis repris (`resume`).
- Désactive les sous-agents (`Agent`, `Task`) pour garder le contrôle du coût.
- Nettoie l'environnement passé au sous-processus et résout le chemin du binaire de façon robuste (PATH du shell de connexion sur macOS, PATH utilisateur sous Windows).
- Garde les 8 derniers Ko de stderr pour afficher une erreur lisible.

Tout cela se transpose à `claude -p` : chemin du binaire réglable dans les paramètres, environnement filtré (en particulier **sans `ANTHROPIC_API_KEY`**), `session_id` stocké dans `metadata.json`.

- **Avertissement sur les dossiers synchronisés** (OneDrive, iCloud Drive, Dropbox) : les clients de synchronisation remplacent des médias par des fichiers fantômes et envoient des rendus à moitié écrits. Point important vu l'usage Windows + Mac.

### Ce qu'on écarte

| Élément | Raison |
| --- | --- |
| Tout code source | Licence MPL-2.0 ; on ne reprend que des concepts. |
| Éditeur canevas/timeline, ECS, reconciler, encodage dans le navigateur | Énorme (1 200 fichiers). Notre interface pilote et prévisualise ; elle n'est pas un logiciel de montage. |
| Electron | `CLAUDE.md` demande une interface web locale ouverte dans le navigateur. |
| Services payants (`generate`, `listen` par modèle hébergé, Supabase, Sentry) | Contraires au principe « local + abonnement Claude uniquement ». |
| Serveur MCP | Pas nécessaire en V1 : `claude -p` + fichiers JSON/Markdown suffisent. À reconsidérer si Claude doit interroger le backend en cours de travail. |
| Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) | Il pilote bien le CLI de l'utilisateur, mais `CLAUDE.md` impose `claude -p` et exclut les SDK Anthropic. `claude -p` est plus simple et suffit. |
| SolidJS | Notre interface sera en React (voir la proposition de frameworks). |

### Où ça sert dans notre outil

- **Phase 1 (socle)** : monorepo et `shared/`, modèle de tâche, catalogue tolérant, écran Bibliothèque, lancement de `claude`.
- **Phase 3** : validation de `plan.json` avant rendu, images fixes de contrôle.
- **Phase 5** : méthode de recherche d'extraits et recadrage par locuteur.

---

## 3. `jipraks/yt-short-clipper`

### Ce qu'il fait

Application de bureau **Windows uniquement** qui transforme une vidéo YouTube longue en clips 9:16 :

1. URL + cookies YouTube → yt-dlp récupère la vidéo et ses sous-titres d'origine ;
2. un LLM (n'importe quel point d'accès compatible OpenAI) propose N extraits : début, fin, titre, description, `virality_score`, `hook_text` ;
3. l'utilisateur coche les extraits voulus ;
4. chaque extrait est découpé, recadré en 9:16 (suivi de visage MediaPipe, centré avec barres noires, ou centré sur fond flou), sous-titré mot à mot (ASS façon CapCut), avec texte d'accroche et filigrane ;
5. publication optionnelle via Repliz.

### Organisation

```
src/                     React 19 + Vite + Tailwind + zustand
  pages/                 Create, HighlightSelection, Processing, ClipDetail, Library, Settings, AIModels…
src-tauri/               coquille Rust (Tauri v2), lance le sidecar
yt_short_clipper_core/   sidecar Python figé avec PyInstaller, protocole JSON Lines sur stdin/stdout
  prompts.py             prompt de sélection des extraits
  highlight_finder.py    appel LLM + parsing
  portrait.py            recadrage 9:16 (suivi de visage, centré, flou)
  caption_generator.py   sous-titres ASS mot à mot
  clip_processor.py, session.py, watermark.py, hook_generator.py…
```

### Ce qu'on reprend

- **Flux d'interface en deux temps** : proposer → sélectionner (cartes avec score, durée, citation, accroche) → traiter avec une progression par extrait. Modèle direct pour les extraits courts de l'écran Projet.
- **Consignes de sélection d'extraits** (à réécrire dans notre skill `proposer-extraits`, pas à copier) :
  - critères explicites (tension, confession, punchline, arc complet, phrase qui tient seule) ;
  - explorer toute la durée, sans prendre seulement le début ; pas de chevauchement ;
  - horodatages recopiés de la transcription, jamais estimés ;
  - barème de score honnête (tous les extraits ne valent pas 9) ;
  - checklist finale avant de répondre.
  
  Avec `--json-schema`, les précautions sur le JSON mal formé deviennent inutiles.
- **Consigne libre de l'utilisateur** (« AI direction ») : prioritaire sur les critères par défaut, plages horaires explicites respectées à la lettre, ordre de la liste = ordre de priorité, et **rappel de la consigne après la transcription** (une longue transcription fait oublier ce qui précède). À reprendre comme champ « consignes » quand on demande un plan ou des extraits.
- **Recadrage 9:16 en trois modes**, dont le « centré sur fond flou », bien plus rapide que le suivi de visage. Le suivi de visage utilise une zone morte et un lissage pour éviter que le cadre tremble.
- **Chien de garde ffmpeg** : lecture de `-progress pipe:2` pour la progression, et arrêt du processus si aucune image n'avance pendant N secondes. Indispensable pour notre file de tâches.
- **Échappement des chemins Windows** dans les filtres `ass=` / `subtitles=` (`\` → `/`, `:` → `\:`). Piège classique.
- **Sous-titres ASS** dont la résolution de script (`PlayRes`) est égale à la taille réelle de la vidéo ; mot courant surligné dans un groupe de quelques mots.
- **Transparence réseau** : le README liste chaque hôte contacté. Notre outil pourra afficher la même chose (réponse attendue : seulement `claude`).

### Ce qu'on écarte

| Élément | Raison |
| --- | --- |
| Windows uniquement (scripts PowerShell, polices lues dans `C:\Windows\Fonts`) | Contre-exemple : nous devons tourner sur Windows et macOS. |
| Tauri + Rust + sidecar Python figé | Trois langages et une chaîne de build lourde ; nous restons sur Node + binaires externes. |
| Source YouTube, cookies, yt-dlp | Nos sources sont nos propres rushes, en local. |
| Sous-titres YouTube comme transcription | Inexistants pour des rushes. |
| LLM compatibles OpenAI, portefeuille intégré, télémétrie Google Analytics, menu distant, publication Repliz | Contraires à nos principes (abonnement Claude seul, pas de télémétrie, publication manuelle). |
| Polices fournies | Licence inconnue. |
| Durées 60-120 s et ton « viral podcast » | Nos formats courts et le ton des récits sont différents ; nos guides de style décident. |
| MediaPipe en Python | Ajouterait Python au projet ; à ne considérer que si le recadrage par locuteur ne suffit pas pour les vlogs. |

### Où ça sert dans notre outil

- **Phase 5 (formats courts)** principalement : skill `proposer-extraits`, écran de sélection, recadrage, sous-titres incrustés.
- **Phase 2 à 4** : chien de garde et progression ffmpeg dans la file de tâches.

---

## 4. `yihui-dev/awesome-opus5-5-videos`

### Ce qu'il fait

Une liste de 703 prompts (dont 207 partiels) de vidéos créées en demandant à Claude Opus 5.5 d'écrire l'animation en code. Répartition : 369 motion design, 117 scènes 3D, 116 explications animées, 101 interactifs. Techniques les plus citées : Canvas (267), SVG (183), Three.js (131), shaders (92), GSAP (86). Chaque entrée est un fichier `prompts/<auteur>-<id>.md`, et `data/videos.json` les indexe (auteur, catégorie, tags techniques, prompt, lien vers l'original).

### Ce qu'on reprend

- **La confirmation que Claude écrit des motion graphics de qualité en code.** Nos composants de bibliothèque (cartouche nom, bouton abonnement, logo animé, génériques, cartes titre des récits) peuvent être écrits une fois avec Claude en Remotion, puis paramétrés et réutilisés partout.
- **Ce qui rend ces prompts efficaces**, à intégrer dans notre gabarit de brief pour créer un composant :
  - spec technique exacte (résolution, fps, durée) ;
  - direction artistique concrète (palette, typographie, logo) ;
  - une idée formelle forte par scène ;
  - temps d'affichage suffisant pour lire ;
  - un effet sonore discret par élément qui apparaît, du silence sinon ;
  - « rends, vérifie les images toi-même, corrige les chevauchements et les textes coupés avant de montrer ».
- **Rendu déterministe image par image** (temps dérivé du numéro d'image, jamais de l'horloge réelle) : c'est ce qui permet d'exporter une animation en vidéo de façon fiable. C'est le modèle de Remotion.
- **Pistes visuelles pour les récits fantasy** : particules, brume, parallaxe sur illustrations, lumière volumétrique. Effets d'ambiance à ajouter par-dessus les visuels des artistes, sans les dénaturer.

### Ce qu'on écarte

| Élément | Raison |
| --- | --- |
| Le texte des prompts | Propriété de leurs auteurs. |
| Les vidéos | Contenu tiers ; jamais dans un export. |
| Générer une animation sur mesure à chaque vidéo | Coût en quota, résultat non reproductible, style qui dérive ; composants paramétrables à la place. |

### Où ça sert dans notre outil

- **Phase 1** : création des premiers composants de bibliothèque, une fois l'identité graphique définie.
- **Phase 3** : visuels d'ambiance des récits.

---

## 5. `remotion-dev/skills`

### Ce qu'il fait

Les skills officielles de Remotion pour les agents (Claude Code, Codex, Cursor…), synchronisées depuis le monorepo Remotion (version 4.0.540). Une skill « routeur » (`remotion-best-practices`) renvoie vers des sous-skills : création de projet, écriture des compositions, rendu, sous-titres, intégration dans une application, cartes animées, documentation, licence, mise à jour.

### Organisation

```
skills/remotion-best-practices/
  SKILL.md                    routeur : quelle sous-skill lire selon la tâche
  remotion-create/            créer un projet ou une composition
  remotion-markup/            ~35 fiches : séquences, timing, transitions, polices locales, paramètres (zod),
                              audio, voix off, détection de silences, sous-titres, effets, 3D, montage vidéo…
  remotion-render/            rendu vidéo, images fixes, vidéos transparentes
  remotion-captions/          type Caption, affichage, import SRT, transcription
  remotion-saas/              intégrer Remotion dans une application : Player, rendu côté serveur
  remotion-maps/              cartes animées (MapLibre, Mapbox, Cesium)
  remotion-interactivity/, remotion-studio/, remotion-docs/, remotion-license/, remotion-upgrade/…
```

### Ce qu'on reprend

- **Organisation des skills en routeur + fiches courtes chargées à la demande.** Bon modèle si nos skills grossissent : un `SKILL.md` court qui renvoie vers des fiches de référence, plutôt qu'un seul gros fichier.
- **`@remotion/player` dans une application React** : aperçu interactif d'une composition sans rendu. Confirme le choix de React pour l'interface : l'écran Bibliothèque pourra prévisualiser un composant (cartouche, bouton abonnement) avec ses paramètres en direct.
- **Rendu programmatique depuis Node** (`@remotion/bundler` + `@remotion/renderer`) sur un serveur local, avec progression et annulation. Remotion renvoie vers un modèle de serveur de rendu doté de routes rendre/progression/annuler, très proche de notre file de tâches.
- **Composition paramétrée par un schéma zod** : les paramètres d'un composant (nom, rôle, couleur, durée) sont déclarés et validés. Correspond exactement à nos « composants paramétrables » et au champ `parametres` de `catalogue.json`.
- **Durée calculée** (`calculateMetadata`) : la durée de la composition suit celle de l'audio. Indispensable pour les récits (la voix décide de la durée).
- **Format de sous-titre `Caption`** (`text`, `startMs`, `endMs`) et découpage en pages : format cible pour les sous-titres animés des formats courts.
- **Polices locales chargées explicitement** (`@remotion/fonts`), donc pas de dépendance aux polices du système.
- **Détection de silences adaptative** : mesurer d'abord le seuil de bruit du fichier (`loudnorm`), puis s'en servir comme seuil de `silencedetect`. Plus robuste qu'un seuil fixe pour des rushes enregistrés dans des conditions différentes.
- **Montage dans Remotion** : regrouper sous une même séquence les calques qui doivent rester synchronisés (plan + sous-titres + overlay) ; `TransitionSeries` pour les plans qui se suivent.
- **Règle « préserver les modifications de l'utilisateur »** : si un fichier a changé entre deux passages, le considérer comme voulu. À reprendre dans `integrer-retours` (un plan modifié à la main dans l'interface ne doit pas être écrasé).
- **`@remotion/whisper-webgpu`** : Whisper local sur GPU, utilisable en Node, en simple paquet npm. Alternative à whisper.cpp à comparer en phase 2 (pas de binaire à installer), à vérifier sur le français et avec les grands modèles.

### Ce qu'on écarte

| Élément | Raison |
| --- | --- |
| Rendu dans le cloud (Lambda, Vercel, Cloudflare…) | Tout reste local. |
| Voix off générée par ElevenLabs | Les voix sont celles de l'utilisateur. |
| Studio Remotion comme interface | Notre interface web est l'unique point d'entrée ; le Studio peut servir à développer les composants. |
| Cartes géographiques réelles | Hors sujet, sauf peut-être plus tard pour la carte du monde fantasy (à faire en SVG ou canvas, pas avec des tuiles réelles). |

### Où ça sert dans notre outil

- **Phase 1** : composants paramétrables de la bibliothèque et leur aperçu dans l'interface.
- **Phase 3** : rendu des récits (durée calée sur la voix, visuels animés), progression du rendu.
- **Phase 5** : sous-titres animés des formats courts.

---

## 6. `jperrello/shorts` (C0BALT_CUT)

### Ce qu'il fait

Une « usine » de Shorts YouTube, locale et sous macOS. Elle part d'un podcast et produit des Shorts 9:16 entièrement automatisés : coupe des hésitations, rythme resserré, recadrage, plans de coupe, sous-titres karaoké, titre d'ouverture, habillage de marque, musique. **Toutes les décisions sémantiques passent par `claude -p` avec l'abonnement, sans clé API.** Un mode automatique (cron horaire) apprend des statistiques, choisit la source suivante, produit et range les fichiers, **sans jamais publier**.

### Organisation

```
.claude/skills/<nom>/SKILL.md    52 skills atomiques : transcribe, segment-topics, pick-segments,
                                 verify-coherence, bookend-trim, cut-filler, tighten-pace, fill-vertical,
                                 chunk-captions, burn-subtitles, loudnorm, bg-music, end-card,
                                 director-pass, qc-clip, profile-clip, style-corpus, style-gate,
                                 analytics-feedback, sources-ledger, reap-source…
.claude/skills/_lib/pane.sh      run_claude_step : appel de `claude -p` (ou d'un panneau tmux)
CLAUDE.md                        définition canonique du pipeline et règles dures
SPEC-*.md                        une spécification par évolution (contrat de passation)
brand/BRAND.md                   charte : couleur, police, règles de chaque image
current_analytics/               exports YouTube Studio + PIPELINE_TAKEAWAYS.md
references/profiles, targets.json   profils de style des Shorts de référence
work/<id>/, output/              fichiers de travail, puis Shorts finis
```

### Ce qu'on reprend

**Architecture des skills**

- **Une skill = une opération**, des **fichiers JSON sur disque** entre les étapes, et **chaque étape idempotente** (elle ne refait rien si ses entrées n'ont pas changé). N'importe quelle étape peut être relancée seule. C'est exactement notre approche « les fichiers sont la source de vérité ».
- **Forme d'une étape qui fait appel à Claude** : construire le prompt → `claude -p` → analyser la réponse, avec un **repli déterministe** si la réponse est inexploitable. Regrouper plusieurs éléments dans **un seul appel** plutôt qu'un appel par élément, pour économiser le quota.
- **`claude -p` depuis un script** : retirer les variables `CLAUDECODE` et `CLAUDE_CODE_ENTRYPOINT` de l'environnement, car `claude -p` refuse de s'exécuter à l'intérieur d'une autre session Claude Code. Piège concret pour nous : pendant le développement, le backend sera souvent lancé depuis une session Claude Code.
- **Chemins des binaires dans la configuration** (`WHISPER_BIN`, `WHISPER_MODEL`), jamais en dur.
- **whisper.cpp pour la transcription mot à mot** (`--output-json-full`, `--max-len 1 --split-on-word`), après avoir abandonné WhisperX et mlx-whisper (archivés). Ce retour d'expérience conforte notre choix.

**Analyse des vidéos d'inspiration (« style replication »)**

L'idée la plus utile pour notre dossier `guides/<catégorie>/inspiration/` :

- Chaque vidéo de référence est réduite à un **profil de style JSON**, calculé uniquement à partir de l'image et du son : coupes par minute, durée médiane des plans, plus long plan fixe, mots par minute, plus long silence, part de visage et de plans de coupe, présence de sous-titres, musique de fond, délai de la première coupe, présence d'un titre à l'ouverture.
- Un niveau **déterministe** (ffmpeg pour la détection de scènes et les silences, transcription) remplit les champs chiffrés ; **un seul appel de vision** à Claude, sur une planche d'images, ne sert que pour les champs de jugement (type de plans de coupe, style de sous-titres, type d'accroche).
- Les profils de plusieurs références sont résumés en **cibles** (médiane et dispersion), et **nos propres vidéos sont analysées avec le même outil** : l'écart devient un diff JSON lisible.
- Seuls les champs reliés à un **réglage réel** du montage peuvent signaler un écart ; les autres sont informatifs.

Chez nous, cela devient : `coupes.json` + `audio.json` + `transcription.json` + `images/` → un `profil.json` chiffré par vidéo d'inspiration, puis `analyse.md` rédigé par Claude. Les cibles alimentent `style.md` (rythme, durée des plans, silences). Le même profil, calculé sur notre aperçu, permet d'afficher dans l'interface « ton montage vs tes références ». **Sans** modification automatique des réglages : l'utilisateur décide.

**Vérification des rendus**

- **`director-pass`** : Claude « regarde » le rendu à travers une planche de 12 images horodatées + la transcription + le plan, et rédige une liste de corrections. Seules quelques corrections sûres et bornées sont appliquées automatiquement ; tout le reste est **signalé** à l'humain. Chez nous : rien n'est appliqué automatiquement, la liste devient des suggestions dans l'écran Projet, à côté des commentaires de l'utilisateur.
- **`qc-clip`** : contrôle minimal et déterministe (durée dans la plage, taille du fichier) avant d'enregistrer. Toujours utile, et gratuit.

**Statistiques et mémoire de ce qui marche**

- `PIPELINE_TAKEAWAYS.md` est une analyse des statistiques reliée aux réglages du pipeline, prudente sur les biais et la taille d'échantillon (« n = 19, beaucoup de facteurs confondus »). Bon modèle pour l'écran Statistiques : relier chaque résultat au hook et aux choix de montage, sans sur-interpréter.
- Constats transposables : l'ouverture compte plus que tout (visage et phrase forte dès la première image, pas de carton) ; la régularité de publication est le premier levier.
- **Registre des sources** et **nettoyage des fichiers de travail** (`work/` pèse environ 25 fois les exports) : prévoir dans Paramètres un nettoyage de `travail/` et des anciennes versions, sans jamais toucher aux rushes.
- **Une spec par évolution**, écrite pour qu'un agent sans contexte puisse la reprendre (`SPEC-*.md` avec décisions et justifications). Bonne pratique pour nos phases.

### Ce qu'on écarte

| Élément | Raison |
| --- | --- |
| Tout code, prompt ou seuil chiffré | Pas de licence, et l'auteur demande de ne pas l'utiliser. |
| macOS uniquement (Bash, tmux, launchd, chemins `/tmp`) | Nous devons tourner sous Windows. |
| Automatisation complète et boucle cron | Notre principe : l'utilisateur valide chaque étape. |
| Recherche de sources et téléchargement YouTube | Nos sources sont nos rushes. |
| Modification autonome des réglages, voire du code, par la boucle de style | Trop risqué et opaque ; chez nous l'écart est montré, l'utilisateur décide. |
| Textes rendus en PNG avec PIL faute de libass | Le ffmpeg de la station Windows a libass (filtres `ass` et `subtitles` vérifiés) ; et Remotion couvre les textes animés. |
| MediaPipe / OpenCV en Python | Ajouterait Python au projet. |
| Suivi de tâches `bd` (beads) | Hors sujet. |

### Où ça sert dans notre outil

- **Phase 2** : analyse des vidéos d'inspiration (profil chiffré + synthèse), transcription whisper.cpp.
- **Phase 3** : forme des appels à Claude (prompt → `claude -p` → validation → repli), vérifications automatiques et suggestions de Claude sur l'aperçu.
- **Phase 7** : lecture prudente des statistiques, alimentation de `hooks.md`.
- **Paramètres** : nettoyage des fichiers de travail.

---

## 7. `AgriciDaniel/claude-shorts`

### Ce qu'il fait

Une skill Claude Code interactive (`/shorts`) qui transforme une vidéo longue en formats courts en 10 étapes : vérifications préalables → transcription (faster-whisper sur GPU) → détection du type de contenu (face caméra, écran, podcast) → notation des extraits par Claude → tableau de candidats → validation par l'utilisateur → recalage des bornes → extraction et recadrage → rendu Remotion (sous-titres animés, accroche, barre de progression) → export par plateforme et validation des fichiers.

### Organisation

```
SKILL.md                 les 10 étapes, règles, paramètres
references/              scoring-rubric.md, caption-styles.md, platform-specs.md, remotion-patterns.md
scripts/                 preflight.sh, detect_gpu.sh, transcribe.py, detect_content.py,
                         snap_boundaries.py, compute_reframe.py, export.sh, validate.sh
remotion/                projet Remotion : render.mjs, ShortVideo.tsx,
                         composants BoldCaptions / BounceCaptions / CleanCaptions, HookOverlay, ProgressBar
```

### Ce qu'on reprend

- **Grille de notation des extraits en 5 critères pondérés** : force de l'accroche, compréhensible sans contexte, intensité émotionnelle, densité de valeur, qualité de la chute. Plus lisible pour l'utilisateur qu'un score unique, et les poids peuvent venir de `hooks.md`. Chaque candidat reçoit aussi une phrase d'accroche et une justification d'une ligne.
- **Tableau de candidats puis validation, avec ajustement des bornes** (« recule le début de 3 s ») : à transposer en cartes cliquables avec poignées de début et de fin dans l'interface.
- **Recalage des bornes en fonction de l'audio**, en étape séparée et déterministe : début sur une frontière de mot, de préférence en début de phrase ; fin prolongée jusqu'à la fin de la phrase si elle est proche ; marge après le dernier mot ; préférence pour un silence détecté. L'écart appliqué est affiché (« début +150 ms »). Claude choisit l'extrait, un code simple fixe les bornes exactes.
- **Transcription en double format** : segments mot à mot (pour Claude) et liste `Caption` Remotion (pour le rendu).
- **Nettoyage des sous-titres par Claude sans toucher aux horodatages** : suppression des hésitations dans le texte affiché, correction des erreurs de transcription d'après le contexte. Très utile pour des sous-titres en français.
- **Type de contenu → stratégie de recadrage** (face caméra : suivi du visage ; écran : cadre réduit sur fond ; podcast : suivi du locuteur). Pour nous : vlog face caméra, captures d'écran pour les timelapses, illustrations pour les récits.
- **Rendu Remotion depuis Node** : un seul bundle, un seul navigateur partagé, rendu des extraits l'un après l'autre avec une progression par extrait, et `selectComposition` avant `renderMedia` pour une durée dynamique.
- **Trois styles de sous-titres nommés** (gras, rebond, sobre) : modèle pour proposer des styles dans nos guides, avec nos propres polices.
- **Vérification des exports** : fichier lisible, bonne résolution, piste audio présente et non silencieuse, codec H.264, durée dans la plage, taille sous la limite de la plateforme. À intégrer à la phase 4.
- **Détection du GPU avec repli CPU** (NVENC sinon libx264), et vérifications préalables (espace disque, fichier valide) avant de lancer une tâche longue.

### Ce qu'on écarte

| Élément | Raison |
| --- | --- |
| faster-whisper + PyTorch dans un environnement Python | Ajouterait Python ; whisper.cpp est retenu. |
| Windows seulement via WSL | Nous voulons Windows en natif. |
| Extraction avec `-ss … -to … -c copy` | Sans réencodage, la coupe tombe sur une image clé, donc imprécise. Pour une coupe au mot près, on réencode chaque segment (méthode de `video-use`). |
| Liste de mots parasites en anglais | À refaire pour le français (« euh », « ben », « du coup »…), dans nos guides. |
| Spécifications de plateformes recopiées | À revérifier dans les documentations officielles, comme le demande `CLAUDE.md`. |
| Polices Montserrat, Bangers, Inter | Nos polices viennent de notre identité graphique. |
| Une passe Claude interactive dans le terminal | Chez nous, Claude produit un JSON et l'interface présente les candidats. |

### Où ça sert dans notre outil

- **Phase 5** surtout : skill `proposer-extraits` (grille de notation), recalage des bornes, sous-titres Remotion, styles de sous-titres.
- **Phase 4** : vérification des exports, encodage NVENC avec repli.

---

## 8. `haidrrrry/claude-remotion-skill`

### Ce qu'il fait

Une skill Claude Code (`remotion-motion-graphics`) qui apprend à Claude à produire des animations Remotion « de monteur » plutôt que des fondus plats : dix règles non négociables, deux fiches de référence (motifs de mouvement, règles de design) et un modèle de thème. Un dossier `examples/` contient quatre compositions finies (promos, sous-titres, montage calé sur le tempo) et deux scripts qui synthétisent des bruitages et une musique en WAV, sans aucun fichier externe.

### Organisation

- `remotion-motion-graphics/SKILL.md` : règles, déroulé (cadrage, mise en place, construction, rendu, **vérification obligatoire**), pièges fréquents.
- `references/motion-patterns.md` : entrée « premium » (opacité + montée + échelle), décalages, révélation mot à mot, fond en dégradé mouvant, étalonnage par calque, grain procédural, vignette, Ken Burns, compteur, sorties, respiration, parallaxe, transitions, flou de mouvement, synchronisation des bruitages, sous-titres mot à mot.
- `references/design-rules.md` : couleur héroïne unique, typographie, structure d'un format court, zone sûre 9:16, sons, liste de contrôle avant livraison.
- `assets/theme.ts` : une seule source pour les couleurs, courbes d'accélération et ressorts.

### Ce qu'on reprend

- **Aucune interpolation linéaire** : courbes de Bézier et ressorts uniquement, toujours bornés. Appliqué à `TexteAnime` (fondu, sortie, respiration).
- **Entrées sur deux ou trois propriétés à la fois** : le « fondu » monte et grandit légèrement en plus de l'opacité.
- **Sorties plus rapides que les entrées**, avec un léger mouvement vers le haut.
- **Un seul fichier de thème** : `animations/src/theme.ts` (courbes, ressorts, durées) ; plus aucune valeur de mouvement en dur dans les composants.
- **Mot mis en valeur par une étiquette qui grandit derrière lui juste après son arrivée** : nouveau fond « mot surligné ».
- **Boucle de vérification** : rendre des images fixes, les regarder, corriger, recommencer. Script `scripts/controle-animations.ts` (planche de toutes les animations à cinq instants) et skill `creer-animation` qui l'impose.
- **Bruitage 2 à 3 images avant l'effet visuel** (en avance, il paraît synchronisé ; en retard, il paraît raté) : ajouté à la skill `proposer-plan`.
- **Une seule couleur héroïne par instant** : ajouté aux consignes des textes.
- Pour plus tard : étalonnage par calque, grain et vignette (phase étalonnage, récits), Ken Burns sur les visuels fixes (récits), `@remotion/transitions` et flou de mouvement (récits), `@remotion/captions` pour passer les sous-titres à Remotion, synthèse d'un kit de bruitages de départ.

### Ce qu'on écarte

- Le fond en dégradé mouvant, le grain et la vignette **sur nos textes** : nos animations sont transparentes et posées sur la vidéo ; ces calques n'ont de sens que pour une scène entière.
- Le rendu par la ligne de commande Remotion et `@remotion/google-fonts` : nous rendons depuis Node et n'utilisons que les polices de la bibliothèque.
- Les palettes et polices proposées : l'identité graphique vient de l'utilisateur.

### Où ça sert dans notre outil

`animations/` (thème et composants), skill `creer-animation`, script de contrôle, guide « Animations (Remotion) » de l'écran Guides (vidéos de motion design analysées image par image), skill `proposer-plan` (bruitages, couleur héroïne).

## Synthèse : qui inspire quoi

| Partie de l'outil | Inspiration principale | Idée retenue |
| --- | --- | --- |
| Monorepo, types partagés | `editor` | npm workspaces, `shared/` d'interfaces |
| File de tâches et progression | `editor`, `yt-short-clipper`, `remotion-skills` | États de tâche normalisés, `-progress pipe:2`, chien de garde, rendu/progression/annulation |
| Appel de Claude | `editor`, `shorts` | Binaire résolu et réglable, environnement filtré (sans `ANTHROPIC_API_KEY`, `CLAUDECODE`, `CLAUDE_CODE_ENTRYPOINT`), session reprise, sans sous-agents, un appel groupé plutôt que plusieurs, validation + repli |
| Transcription | `video-use`, `editor`, `shorts`, `claude-shorts` | whisper.cpp mot à mot, cache par source, JSON parcourable + format `Caption`, vue compacte en Markdown |
| Analyse des vidéos d'inspiration | `shorts`, `video-use`, `editor` | Profil de style chiffré (coupes, débit, silences, visages, sous-titres) + un appel de vision sur une planche ; cibles = médiane des références ; même profil calculé sur nos aperçus |
| Plan de montage | `video-use` | EDL avec `quote` et `reason` par segment, validation stricte avant rendu |
| Rendu ffmpeg | `video-use` | Segments réencodés + concat sans réencodage, fondus 30 ms, sous-titres en dernier, loudnorm deux passes |
| Rendu Remotion | `remotion-skills`, `claude-shorts` | Rendu depuis Node (bundle unique, navigateur partagé), compositions paramétrées par schéma, durée calée sur l'audio |
| Qualité des animations | `claude-remotion-skill` | Courbes et ressorts uniquement, entrées sur plusieurs propriétés, sorties plus rapides, thème unique, vérification sur images avant livraison |
| Vérification de l'aperçu | `video-use`, `editor`, `shorts` | Contrôles déterministes (durée, LUFS, true peak) + revue de Claude sur planche d'images → suggestions, jamais de correction imposée |
| Bibliothèque et identité | `editor`, `awesome`, `remotion-skills` | Catalogue tolérant, jetons de design, composants paramétrables écrits une fois, aperçu par `@remotion/player` |
| Extraits courts | `yt-short-clipper`, `claude-shorts`, `editor` | Proposer → sélectionner, grille de notation, autonomie, consigne utilisateur, recalage des bornes au mot, recadrage par type de contenu |
| Exports | `claude-shorts`, `video-use` | Encodage NVENC avec repli CPU, validation des fichiers exportés |
| Statistiques | `shorts` | Relier résultats, hooks et choix de montage, avec prudence sur la taille d'échantillon |
| Skills `.claude/skills` | `video-use`, `shorts`, `remotion-skills` | Une skill par type de travail ; principes, règles dures, déroulé, formats, anti-patterns ; fiches de référence chargées à la demande |

## Pièges Windows + macOS relevés

- **Chemins** : toujours `node:path` ; dans les JSON, stocker des chemins **relatifs** à `creations/` pour que les deux machines lisent les mêmes fichiers.
- **Filtres ffmpeg avec un chemin** (`subtitles=`, `ass=`) : échapper `:` et `\` sous Windows, ou lancer ffmpeg depuis le dossier du fichier avec un chemin relatif.
- **Polices** : jamais de police système implicite. Les polices sont livrées dans `bibliotheque/commun/identite/` et passées explicitement (`fontsdir` pour libass, chargement vérifié dans Remotion).
- **Binaires externes** (`ffmpeg`, `ffprobe`, `claude`, transcripteur) : chemins réglables dans `parametres.json`, détectés au démarrage, avec un message clair s'ils manquent.
- **Lancement de `claude`** : sous Windows, l'installation native fournit `claude.exe` (déjà le cas sur la station) ; une installation npm fournirait un `claude.cmd` qui exige un shell pour être lancé. Sur macOS, un processus lancé hors terminal n'hérite pas du PATH du shell. Dans les deux cas, retirer `CLAUDECODE` et `CLAUDE_CODE_ENTRYPOINT` de l'environnement si le backend est démarré depuis une session Claude Code.
- **Coupes précises** : ne pas couper avec `-c copy` (coupe sur image clé) ; réencoder chaque segment, puis concaténer.
- **Dossiers synchronisés** : éviter OneDrive, iCloud Drive (« Bureau et Documents » sur Mac) et Dropbox pour `creations/`, ou au minimum exclure `travail/` et `versions/` de la synchronisation.
- **Noms de fichiers** : accents et espaces fréquents dans les rushes ; toujours passer les arguments en tableau à `spawn`, jamais par une chaîne de shell.
- **Accélération GPU** : NVENC/CUDA sous Windows (RTX 5060), VideoToolbox/Metal sur Mac. Toujours garder un repli CPU.

## À vérifier au prototype

- Précision des horodatages mot à mot de whisper.cpp sur de vrais rushes en français, et conservation des hésitations (« euh ») utiles pour couper. Comparaison rapide avec `@remotion/whisper-webgpu`.
- Version de whisper.cpp compatible avec la RTX 5060 (CUDA récent ou Vulkan) et avec Metal sur le Mac.
- ~~Chargement des skills du dépôt quand `claude -p` travaille sur un dossier de projet situé hors du dépôt.~~ Vérifié le 2026-11-03 (Claude Code 2.1.317) : lancé depuis le dossier du projet avec `--add-dir <dépôt>`, les skills de `<dépôt>/.claude/skills` sont chargées, et le `CLAUDE.md` du dépôt **n'est pas** lu d'office (aucun coût en quota). Pour ne pas dépendre de l'interprétation de `/skill` en mode `-p`, le backend passera la skill par `--append-system-prompt-file` ; le même `SKILL.md` reste utilisable à la main.
- ~~Comportement de `--json-schema` et `--resume`.~~ Vérifié : `--json-schema` fonctionne avec `--output-format stream-json --verbose`, le résultat arrive dans `structured_output` de l'événement `result`, et les événements intermédiaires restent lisibles pour la progression. `--tools "Read,Glob,Grep"` limite réellement les outils disponibles (pas de Bash ni d'écriture). `--session-id <uuid>` puis `--resume <uuid>` retrouve le contexte, **à condition de relancer depuis le même dossier et sur la même machine** : après un renommage du projet ou sur l'autre machine, il faut repartir sur une nouvelle session. À tester encore sur un plan long.
- Depuis Git Bash, un argument qui commence par `/` est converti en chemin Windows (`MSYS_NO_PATHCONV=1` pour l'éviter). Le backend n'est pas concerné, puisqu'il appelle `spawn` sans shell.
- Temps de rendu Remotion d'un récit de 15 à 20 minutes sur les deux machines.
