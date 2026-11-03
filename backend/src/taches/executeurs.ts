import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TypeTache } from "@editeur/shared";
import type { Contexte } from "../contexte.ts";
import { codeErreur } from "../erreurs.ts";
import { existe } from "../fichiers.ts";
import { cheminModele, FICHIER_VAD, passagesParole, telechargerModele, transcrire } from "../media/whisper.ts";
import { lireParametres } from "../parametres.ts";
import { transcrireFichier } from "../projets/transcriptions.ts";
import { lancer } from "../processus.ts";
import type { Executeur, OutilsTache } from "./file.ts";

async function essaiTranscription(contexte: Contexte, outils: OutilsTache): Promise<string> {
  const { config } = contexte;
  const { transcription } = await lireParametres(config.creations);
  const modele = cheminModele(config.modeles, transcription.modele);
  if (!(await existe(modele))) {
    throw new Error(`Modèle ${transcription.modele} absent de ${config.modeles} : télécharge-le dans Paramètres.`);
  }
  const dossier = await mkdtemp(join(tmpdir(), "editeur-essai-whisper-"));
  try {
    const wav = join(dossier, "silence.wav");
    outils.progression(null, "Préparation d'un extrait de test");
    const generation = await lancer(config.binaires.ffmpeg, ["-v", "error", "-nostdin", "-f", "lavfi", "-i", "anullsrc=r=16000:cl=mono", "-t", "3", "-c:a", "pcm_s16le", wav], {
      signal: outils.signal,
    }).catch((erreur: unknown) => {
      if (codeErreur(erreur) === "ENOENT") throw new Error("ffmpeg introuvable : vérifie son chemin dans Paramètres.");
      throw erreur;
    });
    if (generation.code !== 0) throw new Error("ffmpeg n'a pas pu préparer l'extrait de test.");

    const debut = Date.now();
    outils.progression(null, "Chargement du modèle");
    const modeleVad = join(config.modeles, FICHIER_VAD);
    const vad = (await existe(modeleVad)) ? modeleVad : null;
    const { acceleration } = await transcrire(
      config.binaires.whisper,
      modele,
      wav,
      { langue: "fr", sortieSansExtension: join(dossier, "silence"), etape: "Transcription de l'extrait" },
      outils,
    );
    const secondes = ((Date.now() - debut) / 1000).toFixed(1).replace(".", ",");
    const materiel = acceleration === null ? "sur le processeur (plus lent)" : `avec l'accélération ${acceleration}`;
    const passages = vad === null ? null : await passagesParole(config.binaires.whisper, vad, wav, outils.signal);
    const detection =
      vad === null ? " (détection de la parole absente)" : passages === null ? " (outil de détection de la parole introuvable)" : ", avec la détection de la parole";
    return `whisper.cpp fonctionne ${materiel}${detection} : modèle ${transcription.modele} chargé et extrait traité en ${secondes} s.`;
  } finally {
    await rm(dossier, { recursive: true, force: true });
  }
}

export function executeurs(contexte: Contexte): Record<TypeTache, Executeur> {
  return {
    "telechargement-modele": async (tache, outils) =>
      telechargerModele(contexte.config.modeles, String(tache.parametres.fichier), String(tache.parametres.depot), outils),
    "essai-transcription": async (_tache, outils) => essaiTranscription(contexte, outils),
    transcription: async (tache, outils) =>
      transcrireFichier(contexte, tache.projet ?? "", String(tache.parametres.fichier), outils),
  };
}
