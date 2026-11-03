import type { InfosMedia } from "@editeur/shared";
import { z } from "zod";
import { codeErreur } from "../erreurs.ts";
import { executer } from "../processus.ts";

const DELAI_MS = 30_000;

export class FfprobeIntrouvableError extends Error {}

const schemaSortie = z.object({
  format: z.object({ duration: z.string().optional() }).optional(),
  streams: z
    .array(
      z.object({
        codec_type: z.string().optional(),
        codec_name: z.string().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
        avg_frame_rate: z.string().optional(),
        r_frame_rate: z.string().optional(),
        color_transfer: z.string().optional(),
        channels: z.number().optional(),
        sample_rate: z.string().optional(),
        tags: z.object({ rotate: z.string().optional() }).optional(),
        side_data_list: z.array(z.object({ rotation: z.number().optional() })).optional(),
        disposition: z.object({ attached_pic: z.number().optional() }).optional(),
      }),
    )
    .optional(),
});

function nombre(texte: string | undefined): number | null {
  if (texte === undefined) return null;
  const valeur = Number(texte);
  return Number.isFinite(valeur) ? valeur : null;
}

function fraction(texte: string | undefined): number | null {
  if (texte === undefined) return null;
  const [numerateur, denominateur] = texte.split("/").map(Number);
  if (numerateur === undefined || denominateur === undefined || !denominateur || !numerateur) return null;
  return Math.round((numerateur / denominateur) * 100) / 100;
}

export function analyserSortieFfprobe(json: string): InfosMedia {
  const sortie = schemaSortie.parse(JSON.parse(json));
  const flux = sortie.streams ?? [];
  const video = flux.find((element) => element.codec_type === "video" && element.disposition?.attached_pic !== 1);
  const audio = flux.find((element) => element.codec_type === "audio");

  let infosVideo: InfosMedia["video"] = null;
  if (video?.width !== undefined && video.height !== undefined) {
    const rotation = video.side_data_list?.find((donnee) => donnee.rotation !== undefined)?.rotation ?? nombre(video.tags?.rotate) ?? 0;
    const pivote = Math.abs(rotation) % 180 === 90;
    infosVideo = {
      largeur: pivote ? video.height : video.width,
      hauteur: pivote ? video.width : video.height,
      codec: video.codec_name ?? "inconnu",
      imagesParSeconde: fraction(video.avg_frame_rate) ?? fraction(video.r_frame_rate),
      transfert: video.color_transfer ?? null,
    };
  }

  return {
    duree: nombre(sortie.format?.duration),
    video: infosVideo,
    audio:
      audio === undefined
        ? null
        : { codec: audio.codec_name ?? "inconnu", canaux: audio.channels ?? 0, frequence: nombre(audio.sample_rate) },
  };
}

export async function sonderMedia(ffprobe: string, chemin: string): Promise<InfosMedia> {
  let resultat;
  try {
    resultat = await executer(ffprobe, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", chemin], {
      delaiMs: DELAI_MS,
    });
  } catch (erreur) {
    if (codeErreur(erreur) === "ENOENT") {
      throw new FfprobeIntrouvableError("ffprobe introuvable : vérifie son chemin dans Paramètres.");
    }
    throw erreur;
  }
  if (resultat.delaiDepasse) {
    throw new Error("ffprobe ne répond pas.");
  }
  if (resultat.code !== 0) {
    const detail = resultat.erreurs
      .split(/\r?\n/)
      .map((ligne) => ligne.replace(/^\[[^\]]*\]\s*/, "").trim())
      .find((ligne) => ligne !== "");
    throw new Error(`Fichier illisible par ffprobe${detail ? ` : ${detail}` : "."}`);
  }
  return analyserSortieFfprobe(resultat.sortie);
}
