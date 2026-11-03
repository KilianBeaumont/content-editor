import { randomUUID } from "node:crypto";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import {
  cheminAnalyseAudio,
  cheminPreparation,
  cheminProxy,
  dossierPlanches,
  genreFichier,
  tacheActive,
  type PlanchesRush,
  type PreparationRush,
} from "@editeur/shared";
import type { Contexte } from "../contexte.ts";
import { ErreurHttp } from "../erreurs.ts";
import { cheminSur, ecrireJsonAtomique, existe, renommer } from "../fichiers.ts";
import { executerFfmpeg } from "../media/ffmpeg.ts";
import { sonderMedia } from "../media/ffprobe.ts";
import { listerTranscriptions } from "../projets/transcriptions.ts";
import { lireProjet } from "../projets/projets.ts";
import type { FileDeTaches, OutilsTache } from "../taches/file.ts";
import {
  analyserNiveaux,
  argumentsNiveaux,
  argumentsProxy,
  COLONNES_PLANCHE,
  estHdr,
  filtrePlanches,
  intervallePlanches,
  LIGNES_PLANCHE,
  lireNiveau,
} from "./analyse.ts";

const POLICES: Partial<Record<NodeJS.Platform, string[]>> = {
  win32: ["C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/segoeui.ttf"],
  darwin: ["/System/Library/Fonts/Supplemental/Arial.ttf", "/Library/Fonts/Arial.ttf", "/System/Library/Fonts/Helvetica.ttc"],
  linux: ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"],
};
const PART_PROXY = 0.75;
const PART_AUDIO = 0.85;

async function policePlanches(): Promise<string | null> {
  for (const police of POLICES[process.platform] ?? []) {
    if (await existe(police)) return police;
  }
  return null;
}

function pluriel(nombre: number, mot: string): string {
  return `${nombre} ${mot}${nombre > 1 ? "s" : ""}`;
}

export async function preparerRush(contexte: Contexte, id: string, chemin: string, outils: OutilsTache): Promise<string> {
  const { config } = contexte;
  const { ffmpeg, ffprobe } = config.binaires;
  const projet = await lireProjet(config.creations, id);
  const dossier = cheminSur(config.creations, projet.chemin);
  const source = cheminSur(dossier, chemin);
  const genre = genreFichier(chemin);
  if (genre !== "video" && genre !== "audio") throw new Error(`Ce fichier ne se prépare pas : ${chemin}`);

  outils.progression(0, "Lecture du fichier");
  const infos = await stat(source);
  const media = await sonderMedia(ffprobe, source);
  const video = genre === "video" ? media.video : null;
  const hdr = estHdr(video);
  const duree = media.duree;
  const morceaux: string[] = [];

  let proxy: string | null = null;
  if (video !== null) {
    outils.progression(0, hdr ? "Création du proxy (conversion des couleurs HDR)" : "Création du proxy");
    proxy = cheminProxy(chemin);
    const cible = join(dossier, proxy);
    const temporaire = join(dirname(cible), `.${basename(cible)}.${randomUUID()}.mp4`);
    await mkdir(dirname(cible), { recursive: true });
    try {
      await executerFfmpeg(
        ffmpeg,
        argumentsProxy(source, video, media.audio !== null, temporaire),
        { duree, action: "Création du proxy", surProgression: (fraction) => outils.progression(fraction * PART_PROXY) },
        outils,
      );
      await renommer(temporaire, cible);
    } finally {
      await rm(temporaire, { force: true });
    }
    morceaux.push(`proxy ${video.largeur >= video.hauteur ? "640 px de large" : "640 px de haut"}${hdr ? " (HDR converti)" : ""}`);
  }

  let audio: string | null = null;
  if (media.audio !== null) {
    outils.progression(PART_PROXY, "Mesure des niveaux sonores");
    const niveaux: number[] = [];
    await executerFfmpeg(
      ffmpeg,
      argumentsNiveaux(proxy === null ? source : join(dossier, proxy)),
      {
        duree,
        action: "Mesure des niveaux sonores",
        surSortie: (ligne) => {
          const niveau = lireNiveau(ligne);
          if (niveau !== null) niveaux.push(niveau);
        },
      },
      outils,
    );
    const analyse = analyserNiveaux(niveaux);
    audio = cheminAnalyseAudio(chemin);
    await mkdir(dirname(join(dossier, audio)), { recursive: true });
    await ecrireJsonAtomique(join(dossier, audio), analyse);
    morceaux.push(`${pluriel(analyse.silences.length, "silence")} et ${pluriel(analyse.pics.length, "pic")} sonores repérés`);
  }

  let planches: PlanchesRush | null = null;
  if (proxy !== null && duree !== null) {
    outils.progression(PART_AUDIO, "Création des planches d'images");
    const intervalle = intervallePlanches(duree);
    const police = await policePlanches();
    const relatif = dossierPlanches(chemin);
    const cible = join(dossier, relatif);
    await rm(cible, { recursive: true, force: true });
    await mkdir(cible, { recursive: true });
    await executerFfmpeg(
      ffmpeg,
      ["-i", join(dossier, proxy), "-an", "-vf", filtrePlanches(intervalle, police), "-q:v", "4", join(cible, "planche-%02d.jpg")],
      { duree, action: "Création des planches", surProgression: (fraction) => outils.progression(PART_AUDIO + fraction * (1 - PART_AUDIO)) },
      outils,
    );
    const fichiers = (await readdir(cible)).filter((nom) => nom.endsWith(".jpg")).sort().map((nom) => `${relatif}/${nom}`);
    planches = { intervalle, colonnes: COLONNES_PLANCHE, lignes: LIGNES_PLANCHE, horodatees: police !== null, fichiers };
    morceaux.push(`${pluriel(fichiers.length, "planche")} d'images (une image toutes les ${intervalle} s)`);
  }

  const preparation: PreparationRush = {
    version: 1,
    source: chemin,
    tailleSource: infos.size,
    modifieSource: infos.mtime.toISOString(),
    creeLe: new Date().toISOString(),
    duree,
    hdr,
    proxy,
    planches,
    audio,
  };
  const fichier = join(dossier, cheminPreparation(chemin));
  await mkdir(dirname(fichier), { recursive: true });
  await ecrireJsonAtomique(fichier, preparation);
  const resume = morceaux.join(", ");
  return resume === "" ? "Rien à préparer : ce fichier n'a ni image ni son." : `${resume.charAt(0).toUpperCase()}${resume.slice(1)}.`;
}

export async function lancerPreparations(creations: string, file: FileDeTaches, id: string, demandes: string[] | null): Promise<number> {
  const { fichiers } = await listerTranscriptions(creations, id);
  const connus = new Set(fichiers.map((fichier) => fichier.chemin));
  for (const chemin of demandes ?? []) {
    if (!connus.has(chemin)) throw new ErreurHttp(400, `Ce fichier ne peut pas être préparé : ${chemin}`);
  }
  const enCours = new Set(
    file
      .liste()
      .filter((tache) => tache.type === "preparation-rush" && tache.projet === id && tacheActive(tache))
      .map((tache) => String(tache.parametres.fichier)),
  );
  const choisis = fichiers
    .filter((fichier) => (demandes === null ? fichier.preparation !== "a-jour" : demandes.includes(fichier.chemin)))
    .filter((fichier) => !enCours.has(fichier.chemin));
  for (const fichier of choisis) {
    file.ajouter("preparation-rush", `Préparation de ${basename(fichier.chemin)}`, id, { fichier: fichier.chemin });
  }
  return choisis.length;
}
