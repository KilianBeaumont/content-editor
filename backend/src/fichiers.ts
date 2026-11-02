import { randomUUID } from "node:crypto";
import { access, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve } from "node:path";
import { setTimeout as attendre } from "node:timers/promises";
import { z } from "zod";
import { codeErreur } from "./erreurs.ts";

const CODES_FICHIER_VERROUILLE = new Set(["EPERM", "EBUSY", "EACCES"]);
const ESSAIS_RENOMMAGE = 5;
const CARACTERES_INTERDITS = /[\0\\:]/;

export class CheminInterditError extends Error {}
export class FichierInvalideError extends Error {}

export function cheminSur(racine: string, cheminRelatif: string): string {
  if (CARACTERES_INTERDITS.test(cheminRelatif) || isAbsolute(cheminRelatif)) {
    throw new CheminInterditError(`Chemin interdit : ${cheminRelatif}`);
  }
  const absolu = resolve(racine, cheminRelatif);
  const depuisRacine = relative(racine, absolu);
  if (depuisRacine.startsWith("..") || isAbsolute(depuisRacine)) {
    throw new CheminInterditError(`Chemin interdit : ${cheminRelatif}`);
  }
  return absolu;
}

export async function existe(chemin: string): Promise<boolean> {
  try {
    await access(chemin);
    return true;
  } catch {
    return false;
  }
}

export async function lireTexte(chemin: string): Promise<string> {
  const texte = await readFile(chemin, "utf8");
  return texte.charCodeAt(0) === 0xfeff ? texte.slice(1) : texte;
}

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === "object" && valeur !== null && !Array.isArray(valeur);
}

export function fusionnerAvecDefauts(defauts: unknown, valeur: unknown): unknown {
  if (!estObjet(defauts) || !estObjet(valeur)) {
    return valeur === undefined ? defauts : valeur;
  }
  const resultat: Record<string, unknown> = { ...valeur };
  for (const [cle, defaut] of Object.entries(defauts)) {
    resultat[cle] = fusionnerAvecDefauts(defaut, valeur[cle]);
  }
  return resultat;
}

export async function lireJsonAvecDefauts<T>(chemin: string, schema: z.ZodType<T>, defauts: T): Promise<T> {
  const nom = basename(chemin);
  let contenu: unknown;
  try {
    contenu = JSON.parse(await lireTexte(chemin));
  } catch (erreur) {
    if (codeErreur(erreur) === "ENOENT") {
      return defauts;
    }
    if (erreur instanceof SyntaxError) {
      throw new FichierInvalideError(`${nom} n'est pas un JSON valide : ${erreur.message}`);
    }
    throw erreur;
  }

  const resultat = schema.safeParse(fusionnerAvecDefauts(defauts, contenu));
  if (!resultat.success) {
    throw new FichierInvalideError(`${nom} invalide :\n${z.prettifyError(resultat.error)}`);
  }
  return resultat.data;
}

export async function renommer(source: string, cible: string): Promise<void> {
  for (let essai = 1; ; essai++) {
    try {
      await rename(source, cible);
      return;
    } catch (erreur) {
      const verrouille = CODES_FICHIER_VERROUILLE.has(codeErreur(erreur) ?? "");
      if (!verrouille || essai >= ESSAIS_RENOMMAGE) {
        throw erreur;
      }
      await attendre(50 * essai);
    }
  }
}

export async function ecrireJsonAtomique(chemin: string, donnees: unknown): Promise<void> {
  const temporaire = `${chemin}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaire, `${JSON.stringify(donnees, null, 2)}\n`, "utf8");
    await renommer(temporaire, chemin);
  } catch (erreur) {
    await rm(temporaire, { force: true });
    throw erreur;
  }
}
