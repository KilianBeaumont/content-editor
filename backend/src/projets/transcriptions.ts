import { randomUUID } from "node:crypto";
import { mkdir, rm, stat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import {
  cheminTranscription,
  genreFichier,
  langueDuFichier,
  tacheActive,
  type FichierTranscriptible,
  type ReponseTranscriptions,
  type Transcription,
} from "@editeur/shared";
import { z } from "zod";
import type { Contexte } from "../contexte.ts";
import { codeErreur, ErreurHttp } from "../erreurs.ts";
import { cheminSur, ecrireJsonAtomique, existe, lireJsonComplete } from "../fichiers.ts";
import { extraireAudio } from "../media/ffmpeg.ts";
import { sonderMedia } from "../media/ffprobe.ts";
import { listerFichiers } from "../media/fichiers-media.ts";
import { cheminModele, transcrire } from "../media/whisper.ts";
import { lireParametres } from "../parametres.ts";
import type { FileDeTaches, OutilsTache } from "../taches/file.ts";
import { lireProjet } from "./projets.ts";

const DOSSIERS_TRANSCRIPTIBLES = ["rushes/", "voix/"];
const PART_EXTRACTION = 0.15;

const schemaTranscription = z.object({
  version: z.literal(1),
  source: z.string(),
  langue: z.string(),
  modele: z.string(),
  acceleration: z.string().nullable(),
  duree: z.number().nullable(),
  tailleSource: z.number(),
  modifieSource: z.string(),
  creeLe: z.string(),
  segments: z.array(
    z.object({
      debut: z.number(),
      fin: z.number(),
      texte: z.string(),
      mots: z.array(z.object({ mot: z.string(), debut: z.number(), fin: z.number(), probabilite: z.number() })),
    }),
  ),
}) satisfies z.ZodType<Transcription>;

function transcriptible(chemin: string): boolean {
  const genre = genreFichier(chemin);
  return (genre === "video" || genre === "audio") && DOSSIERS_TRANSCRIPTIBLES.some((dossier) => chemin.startsWith(dossier));
}

async function lireSiPresente(dossierProjet: string, chemin: string): Promise<Transcription | null> {
  try {
    return await lireJsonComplete(join(dossierProjet, cheminTranscription(chemin)), schemaTranscription, {});
  } catch (erreur) {
    if (codeErreur(erreur) === "ENOENT") return null;
    throw erreur;
  }
}

export async function listerTranscriptions(creations: string, id: string): Promise<ReponseTranscriptions> {
  const projet = await lireProjet(creations, id);
  const dossier = cheminSur(creations, projet.chemin);
  const fichiers: FichierTranscriptible[] = [];
  for (const chemin of (await listerFichiers(dossier)).filter(transcriptible)) {
    const [transcription, infos] = await Promise.all([lireSiPresente(dossier, chemin), stat(join(dossier, chemin))]);
    const aJour =
      transcription !== null && transcription.tailleSource === infos.size && transcription.modifieSource === infos.mtime.toISOString();
    fichiers.push({
      chemin,
      langue: langueDuFichier(chemin),
      etat: transcription === null ? "absente" : aJour ? "a-jour" : "perimee",
      duree: transcription?.duree ?? null,
      nombreMots: transcription === null ? null : transcription.segments.reduce((total, segment) => total + segment.mots.length, 0),
    });
  }
  return { fichiers };
}

export async function lireTranscription(creations: string, id: string, chemin: string): Promise<Transcription> {
  const projet = await lireProjet(creations, id);
  const dossier = cheminSur(creations, projet.chemin);
  cheminSur(dossier, chemin);
  const transcription = await lireSiPresente(dossier, chemin);
  if (transcription === null) throw new ErreurHttp(404, `Pas encore de transcription pour ${chemin}.`);
  return transcription;
}

export async function lancerTranscriptions(
  creations: string,
  file: FileDeTaches,
  id: string,
  demandes: string[] | null,
): Promise<number> {
  const { fichiers } = await listerTranscriptions(creations, id);
  const connus = new Set(fichiers.map((fichier) => fichier.chemin));
  for (const chemin of demandes ?? []) {
    if (!connus.has(chemin)) throw new ErreurHttp(400, `Ce fichier ne peut pas être transcrit : ${chemin}`);
  }
  const enCours = new Set(
    file
      .liste()
      .filter((tache) => tache.type === "transcription" && tache.projet === id && tacheActive(tache))
      .map((tache) => String(tache.parametres.fichier)),
  );
  const choisis = fichiers
    .filter((fichier) => (demandes === null ? fichier.etat !== "a-jour" : demandes.includes(fichier.chemin)))
    .filter((fichier) => !enCours.has(fichier.chemin));
  for (const fichier of choisis) {
    file.ajouter("transcription", `Transcription de ${basename(fichier.chemin)}`, id, { fichier: fichier.chemin });
  }
  return choisis.length;
}

export async function transcrireFichier(contexte: Contexte, id: string, chemin: string, outils: OutilsTache): Promise<string> {
  const { config } = contexte;
  const projet = await lireProjet(config.creations, id);
  const dossier = cheminSur(config.creations, projet.chemin);
  const source = cheminSur(dossier, chemin);
  if (!transcriptible(chemin) || !(await existe(source))) throw new Error(`Fichier introuvable dans le projet : ${chemin}`);

  const { transcription: reglage } = await lireParametres(config.creations);
  const modele = cheminModele(config.modeles, reglage.modele);
  if (!(await existe(modele))) throw new Error(`Modèle ${reglage.modele} absent : télécharge-le dans Paramètres.`);

  outils.progression(0, "Lecture du fichier");
  const infos = await stat(source);
  const media = await sonderMedia(config.binaires.ffprobe, source);
  if (media.audio === null) throw new Error("Ce fichier n'a pas de piste audio.");

  const temporaire = join(dossier, "travail", `.transcription-${randomUUID()}`);
  await mkdir(temporaire, { recursive: true });
  try {
    const wav = join(temporaire, "audio.wav");
    await extraireAudio(
      config.binaires.ffmpeg,
      source,
      wav,
      media.duree,
      (fraction) => outils.progression(fraction * PART_EXTRACTION, "Extraction de l'audio"),
      outils,
    );
    outils.progression(PART_EXTRACTION, "Chargement du modèle");
    const langue = langueDuFichier(chemin);
    const resultat = await transcrire(config.binaires.whisper, modele, wav, langue, join(temporaire, "transcription"), {
      signal: outils.signal,
      progression: (fraction, etape) => outils.progression(PART_EXTRACTION + (fraction ?? 0) * (1 - PART_EXTRACTION), etape),
    });

    const transcription: Transcription = {
      version: 1,
      source: chemin,
      langue,
      modele: reglage.modele,
      acceleration: resultat.acceleration,
      duree: media.duree,
      tailleSource: infos.size,
      modifieSource: infos.mtime.toISOString(),
      creeLe: new Date().toISOString(),
      segments: resultat.segments,
    };
    const cible = join(dossier, cheminTranscription(chemin));
    await mkdir(dirname(cible), { recursive: true });
    await ecrireJsonAtomique(cible, transcription);
    const mots = transcription.segments.reduce((total, segment) => total + segment.mots.length, 0);
    return `${mots} mots transcrits (${langue === "en" ? "anglais" : "français"}).`;
  } finally {
    await rm(temporaire, { recursive: true, force: true });
  }
}
