import { randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { setTimeout as attendre } from "node:timers/promises";
import { codeErreur } from "./erreurs.ts";

const CODES_FICHIER_VERROUILLE = new Set(["EPERM", "EBUSY", "EACCES"]);
const ESSAIS_RENOMMAGE = 5;

export class CheminInterditError extends Error {}

const CARACTERES_INTERDITS = /[\0\\:]/;

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

async function renommer(source: string, cible: string): Promise<void> {
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

export async function lireTexte(chemin: string): Promise<string> {
  const texte = await readFile(chemin, "utf8");
  return texte.charCodeAt(0) === 0xfeff ? texte.slice(1) : texte;
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
