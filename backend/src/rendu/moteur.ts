import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { dureePlan, type PlanMontage, type SegmentPlan } from "@editeur/shared";
import { executerFfmpeg } from "../media/ffmpeg.ts";
import type { OutilsTache } from "../taches/file.ts";
import {
  argumentsClipAudio,
  argumentsClipVideo,
  type BruitageRendu,
  decouper,
  filtreLoudnorm,
  grapheAudio,
  grapheVideo,
  lireMesureLoudnorm,
  type MesureLoudnorm,
  type MusiqueRendu,
  peripheriqueImage,
  type ProfilImage,
  type SourceImage,
} from "./graphe.ts";
import type { SousTitresRendu } from "./sous-titres.ts";

export interface ProfilRendu {
  image: ProfilImage;
  encodageClip: string[];
  encodageSortie: string[];
  loudness: number;
  deuxPasses: boolean;
  debitAudio: string;
}

export interface EntreesRendu {
  plan: PlanMontage;
  image: (chemin: string) => SourceImage | null;
  son: (chemin: string) => string;
  musiques: MusiqueRendu[];
  bruitages: BruitageRendu[];
}

const PARTS = { clips: 0.55, melange: 0.6, mesure: 0.65 };
const CONTIGU = 0.02;

export function segmentsContigus(avant: SegmentPlan | undefined, apres: SegmentPlan | undefined): boolean {
  return avant !== undefined && apres !== undefined && avant.source === apres.source && Math.abs(apres.debut - avant.fin) <= CONTIGU;
}

function nomClip(prefixe: string, index: number, extension: string): string {
  return `${prefixe}${String(index + 1).padStart(3, "0")}.${extension}`;
}

export async function mesurerVolume(ffmpeg: string, fichier: string, cible: number, outils: OutilsTache, action: string): Promise<MesureLoudnorm | null> {
  const journal: string[] = [];
  await executerFfmpeg(
    ffmpeg,
    ["-i", fichier, "-vn", "-af", `${filtreLoudnorm(cible, null)}:print_format=json`, "-f", "null", "-"],
    { duree: null, action, surJournal: (ligne) => journal.push(ligne) },
    outils,
  );
  return lireMesureLoudnorm(journal.slice(-40));
}

export async function rendre(
  ffmpeg: string,
  entrees: EntreesRendu,
  profil: ProfilRendu,
  temporaire: string,
  sortie: string,
  outils: OutilsTache,
  sousTitres: SousTitresRendu | null = null,
): Promise<void> {
  const { plan } = entrees;
  const total = dureePlan(plan);
  const decoupes = decouper(plan.segments, profil.image.ips);
  const videos: string[] = [];
  const audios: string[] = [];
  for (const [index, decoupe] of decoupes.entries()) {
    const segment = plan.segments[index];
    if (segment === undefined) continue;
    outils.progression((index / decoupes.length) * PARTS.clips, `Découpe du segment ${segment.id} (${index + 1}/${decoupes.length})`);
    if (decoupe.image.images > 0) {
      const clip = nomClip("v", index, "mp4");
      const args = argumentsClipVideo(entrees.image(segment.source), decoupe.image.debut, decoupe.image.images, profil.image, profil.encodageClip, join(temporaire, clip), segment.cadrage, segment.transition);
      await executerFfmpeg(ffmpeg, args, { duree: null, action: "Découpe de l'image" }, outils);
      videos.push(clip);
    }
    const clip = nomClip("a", index, "wav");
    const fondus = { entree: !segmentsContigus(plan.segments[index - 1], segment), sortie: !segmentsContigus(segment, plan.segments[index + 1]) };
    await executerFfmpeg(ffmpeg, argumentsClipAudio(entrees.son(segment.source), decoupe.audio.debut, decoupe.audio.duree, join(temporaire, clip), fondus), { duree: null, action: "Découpe du son" }, outils);
    audios.push(clip);
  }
  await writeFile(join(temporaire, "videos.txt"), videos.map((nom) => `file '${nom}'`).join("\n"), "utf8");
  await writeFile(join(temporaire, "audios.txt"), audios.map((nom) => `file '${nom}'`).join("\n"), "utf8");

  outils.progression(PARTS.clips, "Mélange de la voix, de la musique et des bruitages");
  const melange = join(temporaire, "melange.wav");
  const audio = grapheAudio(total, entrees.musiques, entrees.bruitages);
  await executerFfmpeg(
    ffmpeg,
    ["-f", "concat", "-safe", "0", "-i", join(temporaire, "audios.txt"), ...audio.entrees, "-filter_complex", audio.filtre, "-map", "[a]", "-t", String(total), "-c:a", "pcm_s16le", "-ar", "48000", melange],
    { duree: null, action: "Mélange du son" },
    outils,
  );

  let mesure: MesureLoudnorm | null = null;
  if (profil.deuxPasses) {
    outils.progression(PARTS.melange, "Mesure du volume");
    mesure = await mesurerVolume(ffmpeg, melange, profil.loudness, outils, "Mesure du volume");
    if (mesure === null) throw new Error("La mesure du volume a échoué : relance l'export.");
  }

  outils.progression(PARTS.mesure, "Assemblage final");
  const coupes = plan.plansDeCoupe.flatMap((coupe) => {
    const source = entrees.image(coupe.source);
    return source === null ? [] : [{ source, debut: coupe.debut, duree: coupe.fin - coupe.debut, position: coupe.position, cadrage: coupe.cadrage }];
  });
  const video = grapheVideo(profil.image, coupes, 2);
  let filtreVideo = video.filtre;
  let sortieVideo = "[v]";
  const dossierSousTitres = sousTitres === null ? null : await mkdtemp(join(tmpdir(), "editeur-st-"));
  if (sousTitres !== null && dossierSousTitres !== null) {
    await mkdir(join(dossierSousTitres, "polices"));
    await copyFile(sousTitres.police, join(dossierSousTitres, "polices", `police${extname(sousTitres.police).toLowerCase()}`));
    await writeFile(join(dossierSousTitres, "sous-titres.ass"), sousTitres.ass, "utf8");
    filtreVideo = `${filtreVideo};[v]ass=sous-titres.ass:fontsdir=polices[vs]`;
    sortieVideo = "[vs]";
  }
  try {
  await executerFfmpeg(
    ffmpeg,
    [
      ...(coupes.length > 0 ? peripheriqueImage(profil.image) : []),
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      join(temporaire, "videos.txt"),
      "-i",
      melange,
      ...video.entrees,
      "-filter_complex",
      `${filtreVideo};[1:a]${filtreLoudnorm(profil.loudness, mesure)},aresample=48000[a]`,
      "-map",
      sortieVideo,
      "-map",
      "[a]",
      "-t",
      String(Math.round(total * 1000) / 1000),
      ...profil.encodageSortie,
      "-c:a",
      "aac",
      "-b:a",
      profil.debitAudio,
      "-ar",
      "48000",
      "-movflags",
      "+faststart",
      sortie,
    ],
    { duree: total, action: "Assemblage", cwd: dossierSousTitres ?? temporaire, surProgression: (fraction) => outils.progression(PARTS.mesure + fraction * (1 - PARTS.mesure)) },
    outils,
  );
  } finally {
    if (dossierSousTitres !== null) await rm(dossierSousTitres, { recursive: true, force: true });
  }
}
