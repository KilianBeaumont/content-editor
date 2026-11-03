import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { EtatModeleWhisper, SegmentTranscrit } from "@editeur/shared";
import { z } from "zod";
import { codeErreur } from "../erreurs.ts";
import { existe, renommer } from "../fichiers.ts";
import { lancer } from "../processus.ts";
import type { OutilsTache } from "../taches/file.ts";

const HUGGING_FACE = "https://huggingface.co";
export const DEPOT_MODELES = "ggerganov/whisper.cpp";
export const DEPOT_VAD = "ggml-org/whisper-vad";
export const FICHIER_VAD = "ggml-silero-v5.1.2.bin";
const DEPOTS_AUTORISES = [DEPOT_MODELES, DEPOT_VAD];

export class WhisperIntrouvableError extends Error {}

export function fichierModele(nom: string): string {
  return `ggml-${nom}.bin`;
}

export function cheminModele(dossier: string, nom: string): string {
  return join(dossier, fichierModele(nom));
}

export async function etatModele(dossier: string, nom: string): Promise<EtatModeleWhisper> {
  const chemin = cheminModele(dossier, nom);
  const cheminVad = join(dossier, FICHIER_VAD);
  const vad = { chemin: cheminVad, present: await existe(cheminVad) };
  try {
    return { nom, chemin, present: true, taille: (await stat(chemin)).size, vad };
  } catch (erreur) {
    if (codeErreur(erreur) !== "ENOENT") throw erreur;
    return { nom, chemin, present: false, taille: null, vad };
  }
}

export async function telechargerModele(
  dossier: string,
  fichier: string,
  depot: string,
  outils: OutilsTache,
  adresse = HUGGING_FACE,
): Promise<string> {
  if (!/^[a-z0-9][a-z0-9._-]*.bin$/.test(fichier) || !DEPOTS_AUTORISES.includes(depot)) {
    throw new Error(`Modèle invalide : ${fichier}`);
  }
  const cible = join(dossier, fichier);
  if (await existe(cible)) return `Le modèle ${fichier} est déjà présent.`;
  await mkdir(dossier, { recursive: true });

  outils.progression(0, "Connexion à Hugging Face");
  const reponse = await fetch(`${adresse}/${depot}/resolve/main/${fichier}`, { signal: outils.signal });
  if (!reponse.ok || reponse.body === null) {
    throw new Error(`Modèle introuvable sur Hugging Face (erreur ${reponse.status}) : ${fichier}`);
  }
  const total = Number(reponse.headers.get("content-length")) || null;
  const empreinte = (reponse.headers.get("x-linked-etag") ?? "").replaceAll('"', "");
  const attendue = /^[0-9a-f]{64}$/.test(empreinte) ? empreinte : null;

  const temporaire = join(dossier, `.${fichier}.${randomUUID()}.part`);
  const hachage = createHash("sha256");
  let recu = 0;
  const compteur = new Transform({
    transform(morceau: Buffer, _encodage, suite) {
      recu += morceau.length;
      hachage.update(morceau);
      outils.progression(total === null ? null : recu / total, "Téléchargement du modèle");
      suite(null, morceau);
    },
  });

  try {
    await pipeline(Readable.fromWeb(reponse.body), compteur, createWriteStream(temporaire, { flags: "wx" }), { signal: outils.signal });
    if (total !== null && recu !== total) throw new Error(`Téléchargement incomplet : ${recu} octets sur ${total}.`);
    outils.progression(1, "Vérification");
    if (attendue !== null && hachage.digest("hex") !== attendue) {
      throw new Error("Le fichier téléchargé est abîmé (empreinte SHA-256 différente). Relance le téléchargement.");
    }
    await renommer(temporaire, cible);
  } catch (erreur) {
    await rm(temporaire, { force: true });
    throw erreur;
  }
  const taille = recu < 1024 * 1024 ? `${Math.round(recu / 1024)} Ko` : `${Math.round(recu / 1024 / 1024)} Mo`;
  return `Modèle ${fichier} téléchargé et vérifié (${taille}).`;
}

export function progressionWhisper(ligne: string): number | null {
  const resultat = /progress\s*=\s*(\d+)\s*%/.exec(ligne);
  return resultat ? Number(resultat[1]) / 100 : null;
}

export function accelerationWhisper(lignes: string[]): string | null {
  const texte = lignes.join("\n");
  if (/using CUDA\d* backend|CUDA\d+ total size/.test(texte)) return "CUDA";
  if (/using (Metal|MTL)\d* backend|ggml_metal_init|MTL\d+ total size/.test(texte)) return "Metal";
  if (/using Vulkan\d* backend|Vulkan\d+ total size/.test(texte)) return "Vulkan";
  return null;
}

const schemaJsonWhisper = z.object({
  transcription: z.array(
    z.object({
      offsets: z.object({ from: z.number(), to: z.number() }),
      text: z.string(),
      tokens: z
        .array(z.object({ text: z.string(), offsets: z.object({ from: z.number(), to: z.number() }), p: z.number().optional() }))
        .optional(),
    }),
  ),
});

export function analyserJsonWhisper(json: string): SegmentTranscrit[] {
  const { transcription } = schemaJsonWhisper.parse(JSON.parse(json));
  return transcription
    .map((segment) => {
      const mots: SegmentTranscrit["mots"] = [];
      for (const jeton of segment.tokens ?? []) {
        if (jeton.text.startsWith("[_") || jeton.text.trim() === "") continue;
        const debut = jeton.offsets.from / 1000;
        const fin = jeton.offsets.to / 1000;
        const probabilite = jeton.p ?? 1;
        const dernier = mots.at(-1);
        if (dernier !== undefined && !/^\s/.test(jeton.text)) {
          dernier.mot += jeton.text;
          dernier.fin = Math.max(dernier.fin, fin);
          dernier.probabilite = Math.min(dernier.probabilite, probabilite);
        } else {
          mots.push({ mot: jeton.text.trim(), debut, fin, probabilite });
        }
      }
      return { debut: segment.offsets.from / 1000, fin: segment.offsets.to / 1000, texte: segment.text.trim(), mots, corrige: false };
    })
    .filter((segment) => segment.texte !== "");
}

export interface ResultatWhisper {
  segments: SegmentTranscrit[];
  acceleration: string | null;
}

export interface OptionsWhisper {
  langue: string;
  sortieSansExtension: string;
  vocabulaire?: string;
  etape?: string;
}

export function argumentsWhisper(modele: string, wav: string, options: OptionsWhisper): string[] {
  const args = ["-m", modele, "-f", wav, "-l", options.langue, "-ojf", "-of", options.sortieSansExtension, "-pp", "-mc", "0", "-sns"];
  if (options.vocabulaire) args.push("--prompt", options.vocabulaire, "--carry-initial-prompt");
  return args;
}

export interface PassageParole {
  debut: number;
  fin: number;
}

export function lirePassagesParole(lignes: string[]): PassageParole[] {
  const passages: PassageParole[] = [];
  for (const ligne of lignes) {
    const resultat = /VAD segment \d+: start = ([\d.]+), end = ([\d.]+)/.exec(ligne);
    if (resultat) passages.push({ debut: Number(resultat[1]), fin: Number(resultat[2]) });
  }
  return passages;
}

export function filtrerHorsParole(segments: SegmentTranscrit[], passages: PassageParole[], marge = 0.3): SegmentTranscrit[] {
  return segments.filter((segment) =>
    passages.some((passage) => segment.debut < passage.fin + marge && segment.fin > passage.debut - marge),
  );
}

export function commandeDetectionParole(whisper: string): string {
  const extension = extname(whisper);
  const nom = `whisper-vad-speech-segments${extension}`;
  return basename(whisper) === whisper ? nom : join(dirname(whisper), nom);
}

export async function passagesParole(whisper: string, modeleVad: string, wav: string, signal: AbortSignal): Promise<PassageParole[] | null> {
  const lignes: string[] = [];
  try {
    const resultat = await lancer(commandeDetectionParole(whisper), ["-vm", modeleVad, "-f", wav], {
      signal,
      surLigne: (ligne) => lignes.push(ligne),
    });
    return resultat.code === 0 ? lirePassagesParole(lignes) : null;
  } catch (erreur) {
    if (codeErreur(erreur) === "ENOENT") return null;
    throw erreur;
  }
}

export async function transcrire(whisper: string, modele: string, wav: string, options: OptionsWhisper, outils: OutilsTache): Promise<ResultatWhisper> {
  const etape = options.etape ?? "Transcription";
  const lignes: string[] = [];
  let resultat;
  try {
    resultat = await lancer(whisper, argumentsWhisper(modele, wav, options), {
      signal: outils.signal,
      surLigne: (ligne) => {
        if (lignes.length < 200) lignes.push(ligne);
        const fraction = progressionWhisper(ligne);
        if (fraction !== null) outils.progression(fraction, etape);
      },
    });
  } catch (erreur) {
    if (codeErreur(erreur) === "ENOENT") {
      throw new WhisperIntrouvableError("whisper.cpp introuvable : vérifie son chemin dans Paramètres.");
    }
    throw erreur;
  }
  if (outils.signal.aborted) throw new Error("Transcription annulée.");
  if (resultat.code !== 0) {
    const detail = resultat.dernieresErreurs.filter((ligne) => /error|erreur|failed/i.test(ligne)).at(-1) ?? resultat.dernieresErreurs.at(-1);
    throw new Error(`whisper.cpp a échoué${detail ? ` : ${detail.trim()}` : "."}`);
  }
  return {
    segments: analyserJsonWhisper(await readFile(`${options.sortieSansExtension}.json`, "utf8")),
    acceleration: accelerationWhisper(lignes),
  };
}
