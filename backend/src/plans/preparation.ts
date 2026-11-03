import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  cheminPlan,
  LIBELLES_CHAINES,
  LIBELLES_GENRES,
  type FichierMedia,
  type Projet,
  type Transcription,
} from "@editeur/shared";
import { listerBibliotheque } from "../bibliotheque/bibliotheque.ts";
import { codeErreur } from "../erreurs.ts";
import { cheminSur, lireTexte } from "../fichiers.ts";
import { decrireDossier } from "../media/fichiers-media.ts";
import { lireTranscription, listerTranscriptions } from "../projets/transcriptions.ts";
import { listerVersions, lirePlan } from "./plans.ts";

export const CONTEXTE_PLAN = "travail/plan/contexte.md";
const SILENCE_NOTABLE = 1.5;
const DOSSIERS_IGNORES = ["travail/", "versions/", "exports/"];
const TYPES_PROPOSES = new Set(["musique", "ambiance"]);

export function cheminTranscriptionCompacte(chemin: string): string {
  return `travail/transcriptions/${chemin}.md`;
}

const secondes = (valeur: number) => valeur.toFixed(2);

function duree(valeur: number | null): string {
  if (valeur === null) return "?";
  const minutes = Math.floor(valeur / 60);
  return `${minutes}:${(valeur - minutes * 60).toFixed(1).padStart(4, "0")} (${valeur.toFixed(1)} s)`;
}

export function transcriptionCompacte(transcription: Transcription): string {
  const langue = transcription.langue === "en" ? "anglais" : "français";
  const lignes = [`# ${transcription.source} : ${duree(transcription.duree)}, ${langue}`, ""];
  let fin = 0;
  for (const segment of transcription.segments) {
    if (segment.debut - fin >= SILENCE_NOTABLE) lignes.push(`(silence de ${(segment.debut - fin).toFixed(1)} s)`);
    lignes.push(`[${secondes(segment.debut)}-${secondes(segment.fin)}] ${segment.texte}`);
    fin = segment.fin;
  }
  if (transcription.duree !== null && transcription.duree - fin >= SILENCE_NOTABLE) {
    lignes.push(`(silence de ${(transcription.duree - fin).toFixed(1)} s jusqu'à la fin)`);
  }
  if (transcription.segments.length === 0) lignes.push("(aucune parole détectée)");
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

async function lireGuide(creations: string, chemin: string): Promise<string> {
  try {
    return (await lireTexte(cheminSur(creations, chemin))).trim();
  } catch (erreur) {
    if (codeErreur(erreur) === "ENOENT") return "(fichier absent)";
    throw erreur;
  }
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
): Promise<Preparation> {
  const dossier = cheminSur(creations, projet.chemin);
  const { metadata } = projet;

  const transcrites = new Map<string, string>();
  for (const fichier of (await listerTranscriptions(creations, projet.id)).fichiers) {
    if (fichier.etat === "absente") continue;
    const compacte = cheminTranscriptionCompacte(fichier.chemin);
    const cible = join(dossier, compacte);
    await mkdir(dirname(cible), { recursive: true });
    await writeFile(cible, transcriptionCompacte(await lireTranscription(creations, projet.id, fichier.chemin)), "utf8");
    transcrites.set(fichier.chemin, fichier.etat === "perimee" ? `${compacte} (rush modifié depuis)` : compacte);
  }

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
  ];

  const cible = join(dossier, CONTEXTE_PLAN);
  await mkdir(dirname(cible), { recursive: true });
  await writeFile(cible, lignes.join("\n"), "utf8");
  return { transcriptions: transcrites.size, version, planPrecedent: planPrecedent?.version ?? null };
}
