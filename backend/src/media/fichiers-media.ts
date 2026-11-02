import { readdir, stat, statfs } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { genreFichier, type FichierMedia, type InfosMedia } from "@editeur/shared";
import { codeErreur } from "../erreurs.ts";
import { FfprobeIntrouvableError, sonderMedia } from "./ffprobe.ts";

const ANALYSES_SIMULTANEES = 4;

interface Analyse {
  cle: string;
  infos: InfosMedia | null;
  erreur: string | null;
  introuvable: boolean;
}

export interface DescriptionFichiers {
  fichiers: FichierMedia[];
  ffprobeDisponible: boolean;
}

const cache = new Map<string, Analyse>();

async function enParallele<T, R>(elements: T[], limite: number, operation: (element: T) => Promise<R>): Promise<R[]> {
  const resultats: R[] = new Array<R>(elements.length);
  let suivant = 0;
  async function travailleur() {
    while (suivant < elements.length) {
      const index = suivant++;
      resultats[index] = await operation(elements[index] as T);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, elements.length) }, travailleur));
  return resultats;
}

async function parcourir(dossier: string, racine: string): Promise<string[]> {
  const chemins: string[] = [];
  for (const entree of await readdir(dossier, { withFileTypes: true })) {
    if (entree.name.startsWith(".")) continue;
    const absolu = join(dossier, entree.name);
    if (entree.isDirectory()) {
      chemins.push(...(await parcourir(absolu, racine)));
    } else if (entree.isFile()) {
      chemins.push(relative(racine, absolu).split(sep).join("/"));
    }
  }
  return chemins;
}

async function analyser(ffprobe: string, absolu: string, cle: string): Promise<Analyse> {
  const enCache = cache.get(absolu);
  if (enCache?.cle === cle) return enCache;
  let analyse: Analyse;
  try {
    analyse = { cle, infos: await sonderMedia(ffprobe, absolu), erreur: null, introuvable: false };
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : String(erreur);
    analyse = { cle, infos: null, erreur: message, introuvable: erreur instanceof FfprobeIntrouvableError };
  }
  if (!analyse.introuvable) cache.set(absolu, analyse);
  return analyse;
}

export async function decrireFichier(
  dossier: string,
  chemin: string,
  ffprobe: string,
): Promise<{ fichier: FichierMedia; introuvable: boolean }> {
  const absolu = join(dossier, chemin);
  const infos = await stat(absolu);
  const genre = genreFichier(chemin);
  const base = { chemin, taille: infos.size, modifie: infos.mtime.toISOString(), genre };
  if (genre !== "video" && genre !== "audio" && genre !== "image") {
    return { fichier: { ...base, infos: null, erreurAnalyse: null }, introuvable: false };
  }
  const analyse = await analyser(ffprobe, absolu, `${infos.size}-${infos.mtimeMs}`);
  return { fichier: { ...base, infos: analyse.infos, erreurAnalyse: analyse.erreur }, introuvable: analyse.introuvable };
}

export async function listerFichiers(dossier: string): Promise<string[]> {
  try {
    return await parcourir(dossier, dossier);
  } catch (erreur) {
    if (codeErreur(erreur) === "ENOENT") return [];
    throw erreur;
  }
}

export async function decrireDossier(
  dossier: string,
  ffprobe: string,
  garder: (chemin: string) => boolean = () => true,
): Promise<DescriptionFichiers> {
  const chemins = (await listerFichiers(dossier)).filter(garder);
  const descriptions = await enParallele(chemins, ANALYSES_SIMULTANEES, (chemin) => decrireFichier(dossier, chemin, ffprobe));
  return {
    fichiers: descriptions
      .map(({ fichier }) => fichier)
      .sort((a, b) => a.chemin.localeCompare(b.chemin, "fr", { numeric: true })),
    ffprobeDisponible: !descriptions.some(({ introuvable }) => introuvable),
  };
}

export async function espaceLibre(dossier: string): Promise<number | null> {
  try {
    const infos = await statfs(dossier);
    return infos.bavail * infos.bsize;
  } catch {
    return null;
  }
}
