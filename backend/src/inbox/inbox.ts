import { readdir, stat, statfs } from "node:fs/promises";
import { basename, extname, join, relative, sep } from "node:path";
import type { Readable } from "node:stream";
import { genreFichier, type FichierInbox, type InfosMedia, type ReponseInbox } from "@editeur/shared";
import { mettreALaCorbeille } from "../corbeille.ts";
import { codeErreur, ErreurHttp } from "../erreurs.ts";
import { cheminSur, existe } from "../fichiers.ts";
import { FfprobeIntrouvableError, sonderMedia } from "../media/ffprobe.ts";
import { enregistrerFlux } from "../televersement.ts";

const RACINE = "inbox";
const ANALYSES_SIMULTANEES = 4;
const CARACTERES_INTERDITS = '<>:"/\\|?*';

interface Analyse {
  cle: string;
  infos: InfosMedia | null;
  erreur: string | null;
  introuvable: boolean;
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

async function decrire(dossierInbox: string, chemin: string, ffprobe: string): Promise<{ fichier: FichierInbox; introuvable: boolean }> {
  const absolu = join(dossierInbox, chemin);
  const infos = await stat(absolu);
  const genre = genreFichier(chemin);
  const base = { chemin, taille: infos.size, modifie: infos.mtime.toISOString(), genre };
  if (genre !== "video" && genre !== "audio" && genre !== "image") {
    return { fichier: { ...base, infos: null, erreurAnalyse: null }, introuvable: false };
  }
  const analyse = await analyser(ffprobe, absolu, `${infos.size}-${infos.mtimeMs}`);
  return { fichier: { ...base, infos: analyse.infos, erreurAnalyse: analyse.erreur }, introuvable: analyse.introuvable };
}

async function espaceLibre(dossier: string): Promise<number | null> {
  try {
    const infos = await statfs(dossier);
    return infos.bavail * infos.bsize;
  } catch {
    return null;
  }
}

export async function listerInbox(creations: string, ffprobe: string): Promise<ReponseInbox> {
  const dossier = cheminSur(creations, RACINE);
  let chemins: string[];
  try {
    chemins = await parcourir(dossier, dossier);
  } catch (erreur) {
    if (codeErreur(erreur) !== "ENOENT") throw erreur;
    chemins = [];
  }
  const descriptions = await enParallele(chemins, ANALYSES_SIMULTANEES, (chemin) => decrire(dossier, chemin, ffprobe));
  const fichiers = descriptions.map(({ fichier }) => fichier).sort((a, b) => a.chemin.localeCompare(b.chemin, "fr", { numeric: true }));
  return {
    fichiers,
    espaceLibre: await espaceLibre(dossier),
    ffprobeDisponible: !descriptions.some(({ introuvable }) => introuvable),
  };
}

export function nomSansDanger(nomFichier: string): string {
  const nom = [...basename(nomFichier.replace(/\\/g, "/"))]
    .map((caractere) => (caractere.charCodeAt(0) < 32 || CARACTERES_INTERDITS.includes(caractere) ? "_" : caractere))
    .join("")
    .replace(/[. ]+$/, "")
    .trim();
  return nom === "" ? "fichier" : nom;
}

async function nomDisponible(dossier: string, nomFichier: string): Promise<string> {
  const nom = nomSansDanger(nomFichier);
  const extension = extname(nom);
  const base = nom.slice(0, nom.length - extension.length);
  for (let numero = 1; ; numero++) {
    const candidat = numero === 1 ? nom : `${base} (${numero})${extension}`;
    if (!(await existe(join(dossier, candidat)))) return candidat;
  }
}

export async function enregistrerDansInbox(
  creations: string,
  ffprobe: string,
  nomFichier: string,
  flux: Readable,
  tailleAnnoncee: number | null,
): Promise<FichierInbox> {
  const dossier = cheminSur(creations, RACINE);
  const libre = await espaceLibre(dossier);
  if (libre !== null && tailleAnnoncee !== null && tailleAnnoncee > libre) {
    throw new ErreurHttp(507, "Espace disque insuffisant pour ce fichier.");
  }
  const nom = await nomDisponible(dossier, nomFichier);
  await enregistrerFlux(flux, dossier, nom);
  return (await decrire(dossier, nom, ffprobe)).fichier;
}

export async function mettreInboxALaCorbeille(creations: string, chemin: string): Promise<string> {
  const relatif = `${RACINE}/${chemin}`;
  const absolu = cheminSur(creations, relatif);
  if (chemin === "" || !(await existe(absolu))) {
    throw new ErreurHttp(404, `Fichier introuvable : ${relatif}`);
  }
  if (!(await stat(absolu)).isFile()) {
    throw new ErreurHttp(400, "Seuls les fichiers peuvent être mis à la corbeille depuis l'inbox.");
  }
  return mettreALaCorbeille(creations, relatif, RACINE);
}
