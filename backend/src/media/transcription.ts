import { randomUUID } from "node:crypto";
import { mkdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Transcription } from "@editeur/shared";
import type { Contexte } from "../contexte.ts";
import { existe } from "../fichiers.ts";
import { lireParametres } from "../parametres.ts";
import type { OutilsTache } from "../taches/file.ts";
import { extraireAudio } from "./ffmpeg.ts";
import { sonderMedia } from "./ffprobe.ts";
import { cheminModele, FICHIER_VAD, filtrerHorsParole, passagesParole, transcrire } from "./whisper.ts";

const PART_EXTRACTION = 0.15;

export interface SourceATranscrire {
  source: string;
  cheminRelatif: string;
  langue: string;
  vocabulaire: string;
  dossierTemporaire: string;
}

export interface ResultatTranscription {
  transcription: Transcription;
  retires: number;
}

export async function transcrireSource(contexte: Contexte, demande: SourceATranscrire, outils: OutilsTache): Promise<ResultatTranscription> {
  const { config } = contexte;
  const { transcription: reglage } = await lireParametres(config.creations);
  const modele = cheminModele(config.modeles, reglage.modele);
  if (!(await existe(modele))) throw new Error(`Modèle ${reglage.modele} absent : télécharge-le dans Paramètres.`);
  const modeleVad = join(config.modeles, FICHIER_VAD);
  const vad = (await existe(modeleVad)) ? modeleVad : null;

  outils.progression(0, "Lecture du fichier");
  const infos = await stat(demande.source);
  const media = await sonderMedia(config.binaires.ffprobe, demande.source);
  if (media.audio === null) throw new Error("Ce fichier n'a pas de piste audio.");

  const temporaire = join(demande.dossierTemporaire, `.transcription-${randomUUID()}`);
  await mkdir(temporaire, { recursive: true });
  try {
    const wav = join(temporaire, "audio.wav");
    await extraireAudio(
      config.binaires.ffmpeg,
      demande.source,
      wav,
      media.duree,
      (fraction) => outils.progression(fraction * PART_EXTRACTION, "Extraction de l'audio"),
      outils,
    );
    outils.progression(PART_EXTRACTION, "Chargement du modèle");
    const resultat = await transcrire(
      config.binaires.whisper,
      modele,
      wav,
      { langue: demande.langue, sortieSansExtension: join(temporaire, "transcription"), vocabulaire: demande.vocabulaire },
      {
        signal: outils.signal,
        progression: (fraction, etape) => outils.progression(PART_EXTRACTION + (fraction ?? 0) * (1 - PART_EXTRACTION), etape),
      },
    );
    outils.progression(1, "Repérage des passages sans parole");
    const passages = vad === null ? null : await passagesParole(config.binaires.whisper, vad, wav, outils.signal);
    const segments = passages === null ? resultat.segments : filtrerHorsParole(resultat.segments, passages);
    return {
      transcription: {
        version: 1,
        source: demande.cheminRelatif,
        langue: demande.langue,
        modele: reglage.modele,
        acceleration: resultat.acceleration,
        duree: media.duree,
        tailleSource: infos.size,
        modifieSource: infos.mtime.toISOString(),
        creeLe: new Date().toISOString(),
        vad: passages !== null,
        vocabulaire: demande.vocabulaire,
        corrigee: false,
        segments,
      },
      retires: resultat.segments.length - segments.length,
    };
  } finally {
    await rm(temporaire, { recursive: true, force: true });
  }
}
