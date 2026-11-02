import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { slug, type FicheIllisible } from "@editeur/shared";
import type { z } from "zod";
import { mettreALaCorbeille } from "./corbeille.ts";
import { codeErreur, ErreurHttp } from "./erreurs.ts";
import { cheminSur, ecrireJsonAtomique, existe, FichierInvalideError, lireJsonAvecDefauts } from "./fichiers.ts";

const FICHE = "fiche.json";
const MOTIF_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface DossierFiches<T> {
  racine: string;
  libelle: string;
  schema: z.ZodType<T>;
  vide: T;
}

export interface ListeFiches<T> {
  fiches: { id: string; dossier: string; fiche: T }[];
  illisibles: FicheIllisible[];
}

export function dossierFiche<T>(creations: string, type: DossierFiches<T>, id: string): string {
  if (!MOTIF_ID.test(id)) {
    throw new ErreurHttp(404, `${type.libelle} introuvable : ${id}`);
  }
  return cheminSur(creations, `${type.racine}/${id}`);
}

export async function lireFiche<T>(creations: string, type: DossierFiches<T>, id: string): Promise<{ dossier: string; fiche: T }> {
  const dossier = dossierFiche(creations, type, id);
  if (!(await existe(dossier))) {
    throw new ErreurHttp(404, `${type.libelle} introuvable : ${id}`);
  }
  const chemin = join(dossier, FICHE);
  if (!(await existe(chemin))) {
    throw new FichierInvalideError(`${FICHE} manquant.`);
  }
  return { dossier, fiche: await lireJsonAvecDefauts(chemin, type.schema, type.vide) };
}

export async function listerFiches<T>(creations: string, type: DossierFiches<T>): Promise<ListeFiches<T>> {
  const liste: ListeFiches<T> = { fiches: [], illisibles: [] };
  let entrees;
  try {
    entrees = await readdir(cheminSur(creations, type.racine), { withFileTypes: true });
  } catch (erreur) {
    if (codeErreur(erreur) === "ENOENT") return liste;
    throw erreur;
  }

  for (const entree of entrees) {
    if (!entree.isDirectory() || entree.name.startsWith(".")) continue;
    if (!MOTIF_ID.test(entree.name)) {
      liste.illisibles.push({
        id: entree.name,
        erreur: "Nom de dossier non conforme : minuscules sans accents ni espaces, mots séparés par des tirets.",
      });
      continue;
    }
    try {
      liste.fiches.push({ id: entree.name, ...(await lireFiche(creations, type, entree.name)) });
    } catch (erreur) {
      liste.illisibles.push({ id: entree.name, erreur: erreur instanceof Error ? erreur.message : String(erreur) });
    }
  }
  return liste;
}

export async function creerFiche<T>(
  creations: string,
  type: DossierFiches<T>,
  nom: string,
  fiche: T,
  sousDossiers: string[] = [],
): Promise<string> {
  const id = slug(nom);
  const dossier = dossierFiche(creations, type, id);
  await mkdir(cheminSur(creations, type.racine), { recursive: true });
  try {
    await mkdir(dossier);
  } catch (erreur) {
    if (codeErreur(erreur) === "EEXIST") {
      throw new ErreurHttp(409, `Une fiche existe déjà pour « ${id} ».`);
    }
    throw erreur;
  }
  for (const sousDossier of sousDossiers) {
    await mkdir(join(dossier, sousDossier));
  }
  await ecrireJsonAtomique(join(dossier, FICHE), fiche);
  return id;
}

export async function ecrireFiche<T>(creations: string, type: DossierFiches<T>, id: string, fiche: T): Promise<void> {
  await ecrireJsonAtomique(join(dossierFiche(creations, type, id), FICHE), fiche);
}

export function ficheALaCorbeille<T>(creations: string, type: DossierFiches<T>, id: string): Promise<string> {
  dossierFiche(creations, type, id);
  return mettreALaCorbeille(creations, `${type.racine}/${id}`, type.racine);
}

export function trierParNom<T extends { fiche: { nom: string } }>(elements: T[]): T[] {
  return elements.sort((a, b) => a.fiche.nom.localeCompare(b.fiche.nom, "fr"));
}
