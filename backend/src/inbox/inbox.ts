import { stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import type { Readable } from "node:stream";
import type { FichierMedia, ReponseInbox } from "@editeur/shared";
import { mettreALaCorbeille } from "../corbeille.ts";
import { ErreurHttp } from "../erreurs.ts";
import { cheminSur, existe } from "../fichiers.ts";
import { decrireDossier, decrireFichier, espaceLibre } from "../media/fichiers-media.ts";
import { enregistrerFlux } from "../televersement.ts";

const RACINE = "inbox";
const CARACTERES_INTERDITS = '<>:"/\\|?*';

export async function listerInbox(creations: string, ffprobe: string): Promise<ReponseInbox> {
  const dossier = cheminSur(creations, RACINE);
  const { fichiers, ffprobeDisponible } = await decrireDossier(dossier, ffprobe);
  return { fichiers, espaceLibre: await espaceLibre(dossier), ffprobeDisponible };
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
): Promise<FichierMedia> {
  const dossier = cheminSur(creations, RACINE);
  const libre = await espaceLibre(dossier);
  if (libre !== null && tailleAnnoncee !== null && tailleAnnoncee > libre) {
    throw new ErreurHttp(507, "Espace disque insuffisant pour ce fichier.");
  }
  const nom = await nomDisponible(dossier, nomFichier);
  await enregistrerFlux(flux, dossier, nom);
  return (await decrireFichier(dossier, nom, ffprobe)).fichier;
}

export async function mettreInboxALaCorbeille(creations: string, chemin: string): Promise<string> {
  const absolu = cheminSur(cheminSur(creations, RACINE), chemin);
  const relatif = `${RACINE}/${chemin}`;
  if (chemin === "" || !(await existe(absolu))) {
    throw new ErreurHttp(404, `Fichier introuvable : ${relatif}`);
  }
  if (!(await stat(absolu)).isFile()) {
    throw new ErreurHttp(400, "Seuls les fichiers peuvent être mis à la corbeille depuis l'inbox.");
  }
  return mettreALaCorbeille(creations, relatif, RACINE);
}
