import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  cheminPlan,
  situer,
  LIBELLES_CHAINES,
  LIBELLES_GENRES,
  type AnalyseAudio,
  type CommentaireRetour,
  type FichierMedia,
  type Intervalle,
  type PlanchesRush,
  type PlanMontage,
  type Projet,
  type SegmentTranscrit,
  type Transcription,
} from "@editeur/shared";
import { listerBibliotheque } from "../bibliotheque/bibliotheque.ts";
import { codeErreur } from "../erreurs.ts";
import { cheminSur, lireTexte } from "../fichiers.ts";
import { decrireDossier } from "../media/fichiers-media.ts";
import { lireTranscription, listerTranscriptions } from "../projets/transcriptions.ts";
import { lireAnalyseAudio, lirePreparation } from "../rushes/etat.ts";
import { lireReperes } from "../rushes/reperes.ts";
import { referencesInspiration, sectionAnimations } from "../inspiration/inspiration.ts";
import { listerVersions, lirePlan } from "./plans.ts";

export const CONTEXTE_PLAN = "travail/plan/contexte.md";
const SILENCE_NOTABLE = 1.5;
const PAUSE_MIN = 0.3;
const ECART_REPERE = 0.25;
const MOTS_ENTRE_REPERES = 8;
const DOSSIERS_IGNORES = ["travail/", "versions/", "exports/"];
const TYPES_PROPOSES = new Set(["musique", "ambiance", "son"]);

export function cheminTranscriptionCompacte(chemin: string): string {
  return `travail/transcriptions/${chemin}.md`;
}

const secondes = (valeur: number) => valeur.toFixed(2);

function duree(valeur: number | null): string {
  if (valeur === null) return "?";
  const minutes = Math.floor(valeur / 60);
  return `${minutes}:${(valeur - minutes * 60).toFixed(1).padStart(4, "0")} (${valeur.toFixed(1)} s)`;
}

function texteSegment(segment: SegmentTranscrit, silences: Intervalle[]): string {
  if (segment.corrige || segment.mots.length === 0) return segment.texte;
  const morceaux: string[] = [];
  let depuisRepere = 0;
  segment.mots.forEach((mot, index) => {
    const precedent = segment.mots[index - 1];
    const pause = silences.find(
      (silence) =>
        silence.fin - silence.debut >= PAUSE_MIN - 0.01 &&
        silence.debut < mot.fin &&
        (precedent === undefined ? silence.debut <= mot.debut + 0.05 && silence.fin > mot.debut + 0.1 : silence.debut > precedent.debut + 0.05),
    );
    if (pause !== undefined) {
      silences.splice(silences.indexOf(pause), 1);
      morceaux.push(`(pause ${(pause.fin - pause.debut).toFixed(1)} s) {${secondes(Math.max(mot.debut, pause.fin))}}`);
      depuisRepere = 0;
    } else if (precedent !== undefined && (mot.debut - precedent.fin >= ECART_REPERE || depuisRepere >= MOTS_ENTRE_REPERES)) {
      morceaux.push(`{${secondes(mot.debut)}}`);
      depuisRepere = 0;
    }
    morceaux.push(mot.mot.trim());
    depuisRepere++;
  });
  return morceaux.join(" ");
}

export function transcriptionCompacte(transcription: Transcription, audio: AnalyseAudio | null = null): string {
  const langue = transcription.langue === "en" ? "anglais" : "français";
  const lignes = [
    `# ${transcription.source} : ${duree(transcription.duree)}, ${langue}`,
    "",
    "Une ligne par passage : [début-fin] en secondes dans le rush. {t} : horaire du mot qui suit.",
    ...(audio === null ? [] : ["(pause x s) : silence mesuré dans l'audio, bon endroit pour couper ; le mot qui suit reprend à {t}."]),
    "",
  ];
  const silences = audio === null ? [] : [...audio.silences];
  let fin = 0;
  for (const segment of transcription.segments) {
    if (segment.debut - fin >= SILENCE_NOTABLE) lignes.push(`(silence de ${(segment.debut - fin).toFixed(1)} s)`);
    lignes.push(`[${secondes(segment.debut)}-${secondes(segment.fin)}] ${texteSegment(segment, silences)}`);
    fin = segment.fin;
  }
  if (transcription.duree !== null && transcription.duree - fin >= SILENCE_NOTABLE) {
    lignes.push(`(silence de ${(transcription.duree - fin).toFixed(1)} s jusqu'à la fin)`);
  }
  if (transcription.segments.length === 0) lignes.push("(aucune parole détectée)");
  if (audio !== null && audio.pics.length > 0) {
    lignes.push("", `Pics sonores (moments les plus forts du son) : ${audio.pics.map((pic) => pic.temps.toFixed(1)).join(", ")}.`);
  }
  return `${lignes.join("\n")}\n`;
}

function cellule(texte: string): string {
  return texte.replaceAll("|", "/").replaceAll(/\s*\n\s*/g, " ").trim() || "—";
}

function descriptionMedia(fichier: FichierMedia): { image: string; son: string } {
  const video = fichier.infos?.video;
  const audio = fichier.infos?.audio;
  return {
    image: video ? `${video.largeur}x${video.hauteur}${video.imagesParSeconde ? ` ${video.imagesParSeconde} i/s` : ""}` : "—",
    son: audio ? (audio.canaux === 1 ? "mono" : audio.canaux === 2 ? "stéréo" : `${audio.canaux} canaux`) : "aucun",
  };
}

export async function lireGuide(creations: string, chemin: string): Promise<string> {
  try {
    return (await lireTexte(cheminSur(creations, chemin))).trim();
  } catch (erreur) {
    if (codeErreur(erreur) === "ENOENT") return "(fichier absent)";
    throw erreur;
  }
}

export function sectionPlanches(planches: Map<string, PlanchesRush>): string[] {
  return [
    "## Images des rushes",
    "",
    "Des planches d'images montrent ce qu'on voit dans chaque rush. Une planche est une grille de vignettes à lire de gauche à droite puis de haut en bas, une vignette par intervalle.",
    "",
    "| Rush | Planches | Grille | Intervalle | Horaire des vignettes |",
    "| --- | --- | --- | --- | --- |",
    ...[...planches].map(([chemin, rush]) => {
      const premiere = rush.fichiers[0];
      const fichiers = premiere === undefined ? "aucune" : `${premiere} à ${rush.fichiers.at(-1)?.split("/").at(-1) ?? ""}`;
      const parPlanche = rush.colonnes * rush.lignes;
      const horaire = rush.horodatees
        ? "écrit en haut à gauche de chaque vignette"
        : `vignette n (à partir de 0) de la planche p (à partir de 1) : ((p - 1) × ${parPlanche} + n) × ${rush.intervalle} s`;
      return `| ${chemin} | ${fichiers} | ${rush.colonnes} × ${rush.lignes} | ${rush.intervalle} s | ${horaire} |`;
    }),
    "",
  ];
}

export interface RetoursAIntegrer {
  version: string;
  plan: PlanMontage;
  commentaires: CommentaireRetour[];
}

function instant(secondes: number): string {
  const minutes = Math.floor(secondes / 60);
  return `${minutes}:${(secondes - minutes * 60).toFixed(1).padStart(4, "0")}`;
}

export function sectionRetours(retours: RetoursAIntegrer): string[] {
  const { version, plan, commentaires } = retours;
  return [
    `## Retours de l'utilisateur sur l'aperçu ${version}`,
    "",
    `L'utilisateur a regardé l'aperçu de la version ${version} (plan : ${cheminPlan(version)}) et a laissé ces commentaires. L'instant est celui de la vidéo finale de ${version} ; la colonne « Où » le situe dans le plan ${version} et dans le rush. Réponds à chaque commentaire dans reponsesRetours, avec son numéro.`,
    "",
    "| N° | Instant dans l'aperçu | Où | Commentaire |",
    "| --- | --- | --- | --- |",
    ...commentaires.map((commentaire, index) => {
      const situation = commentaire.temps === null ? null : situer(plan.segments, commentaire.temps);
      const ou = situation === null ? "toute la vidéo" : `${situation.segment} · ${situation.source} à ${secondes(situation.tempsSource)} s`;
      return `| ${index} | ${commentaire.temps === null ? "toute la vidéo" : instant(commentaire.temps)} | ${ou} | ${cellule(commentaire.texte)} |`;
    }),
    "",
  ];
}

export interface TranscriptionsCompactes {
  transcrites: Map<string, string>;
  planches: Map<string, PlanchesRush>;
}

export async function ecrireTranscriptionsCompactes(creations: string, projet: Projet): Promise<TranscriptionsCompactes> {
  const dossier = cheminSur(creations, projet.chemin);
  const transcrites = new Map<string, string>();
  const planches = new Map<string, PlanchesRush>();
  for (const fichier of (await listerTranscriptions(creations, projet.id)).fichiers) {
    const preparationRush = fichier.preparation === "absente" ? null : await lirePreparation(dossier, fichier.chemin);
    if (preparationRush?.planches) planches.set(fichier.chemin, preparationRush.planches);
    if (fichier.etat === "absente") continue;
    const compacte = cheminTranscriptionCompacte(fichier.chemin);
    const cible = join(dossier, compacte);
    const audio = await lireAnalyseAudio(dossier, preparationRush);
    await mkdir(dirname(cible), { recursive: true });
    await writeFile(cible, transcriptionCompacte(await lireTranscription(creations, projet.id, fichier.chemin), audio), "utf8");
    transcrites.set(fichier.chemin, fichier.etat === "perimee" ? `${compacte} (rush modifié depuis)` : compacte);
  }
  return { transcrites, planches };
}

export interface Preparation {
  transcriptions: number;
  version: string;
  planPrecedent: string | null;
}

export async function preparerProposition(
  creations: string,
  projet: Projet,
  ffprobe: string,
  version: string,
  consigne: string,
  retours: RetoursAIntegrer | null = null,
): Promise<Preparation> {
  const dossier = cheminSur(creations, projet.chemin);
  const { metadata } = projet;
  const { transcrites, planches } = await ecrireTranscriptionsCompactes(creations, projet);
  const reperes = await lireReperes(dossier);

  const { fichiers } = await decrireDossier(dossier, ffprobe, (chemin) => chemin !== "metadata.json" && !DOSSIERS_IGNORES.some((d) => chemin.startsWith(d)));
  const notes = new Map(metadata.fichiers.map((fichier) => [fichier.chemin, fichier.note]));
  const { elements } = await listerBibliotheque(creations);
  const chaines = new Set(["commun", metadata.chaine]);
  const assets = elements.filter(
    ({ asset, statut }) =>
      statut.valide && (metadata.assetsBibliotheque.includes(asset.id) || (TYPES_PROPOSES.has(asset.type) && chaines.has(asset.chaine))),
  );

  const precedente = (await listerVersions(dossier)).find((etat) => etat.version !== version);
  const planPrecedent = precedente === undefined ? null : await lirePlan(dossier, precedente.version).catch(() => null);
  const { consignes } = metadata;
  const guides = `guides/${metadata.categorie}`;

  const lignes = [
    `# Projet : ${metadata.titre.fr}`,
    "",
    `- Identifiant : ${projet.id}`,
    `- Catégorie : ${metadata.categorie}`,
    `- Chaîne : ${LIBELLES_CHAINES[metadata.chaine]}`,
    `- Publication prévue : ${metadata.datePublicationPrevue}`,
    `- Version à proposer : ${version}`,
    "",
    "## Consignes de l'utilisateur",
    "",
    `- Intention : ${cellule(consignes.intention)}`,
    `- Durée visée : ${consignes.dureeViseeMinutes === null ? "non précisée" : `${consignes.dureeViseeMinutes} min (${consignes.dureeViseeMinutes * 60} s)`}`,
    `- À garder absolument : ${cellule(consignes.aGarder)}`,
    `- À éviter : ${cellule(consignes.aEviter)}`,
    ...(consigne === "" ? [] : [`- **Consigne pour cette proposition** : ${cellule(consigne)}`]),
    "",
    "## Fichiers du projet",
    "",
    "Les chemins sont relatifs au dossier du projet (le dossier courant).",
    "",
    "| Fichier | Type | Durée | Image | Son | Note de l'utilisateur | Transcription |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...fichiers.map((fichier) => {
      const { image, son } = descriptionMedia(fichier);
      const transcription = transcrites.get(fichier.chemin) ?? "—";
      return `| ${fichier.chemin} | ${LIBELLES_GENRES[fichier.genre]} | ${duree(fichier.infos?.duree ?? null)} | ${image} | ${son} | ${cellule(notes.get(fichier.chemin) ?? "")} | ${transcription} |`;
    }),
    "",
    ...(reperes.length === 0
      ? []
      : [
          "## Moments marqués par l'utilisateur",
          "",
          "L'utilisateur a repéré ces moments en regardant les rushes : ils sont prioritaires.",
          "",
          "| Rush | Horaire (s) | Note |",
          "| --- | --- | --- |",
          ...reperes.map((repere) => `| ${repere.source} | ${secondes(repere.temps)} | ${cellule(repere.note)} |`),
          "",
        ]),
    ...(planches.size === 0 ? [] : sectionPlanches(planches)),
    "## Assets de la bibliothèque utilisables",
    "",
    ...(assets.length === 0
      ? ["Aucun."]
      : [
          "| Identifiant | Type | Description | Étiquettes | Choisi pour ce projet |",
          "| --- | --- | --- | --- | --- |",
          ...assets.map(
            ({ asset }) =>
              `| ${asset.id} | ${asset.type} | ${cellule(asset.description)} | ${cellule(asset.etiquettes.join(", "))} | ${metadata.assetsBibliotheque.includes(asset.id) ? "oui" : "non"} |`,
          ),
        ]),
    "",
    ...(retours === null ? [] : sectionRetours(retours)),
    ...(planPrecedent === null
      ? []
      : [
          "## Plan précédent",
          "",
          `${cheminPlan(planPrecedent.version)}${planPrecedent.modifieLe === null ? "" : " (modifié à la main par l'utilisateur : ses changements font foi)"}.`,
          "",
        ]),
    `## Guide de style (${guides}/style.md)`,
    "",
    await lireGuide(creations, `${guides}/style.md`),
    "",
    `## Accroches (${guides}/hooks.md)`,
    "",
    await lireGuide(creations, `${guides}/hooks.md`),
    "",
    ...(await referencesInspiration(creations, metadata.categorie)),
    ...(await sectionAnimations(creations)),
  ];

  const cible = join(dossier, CONTEXTE_PLAN);
  await mkdir(dirname(cible), { recursive: true });
  await writeFile(cible, lignes.join("\n"), "utf8");
  return { transcriptions: transcrites.size, version, planPrecedent: planPrecedent?.version ?? null };
}
