import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, mkdir, rm, stat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { codeErreur } from "../erreurs.ts";
import { existe, renommer } from "../fichiers.ts";

export type Renommer = (source: string, cible: string) => Promise<void>;

export interface Deplacement {
  source: string;
  cible: string;
}

export class ErreurDeplacement extends Error {
  readonly nonRemis: Deplacement[];

  constructor(message: string, nonRemis: Deplacement[]) {
    super(message);
    this.nonRemis = nonRemis;
  }
}

export async function deplacerFichier(source: string, cible: string, renommerFichier: Renommer = renommer): Promise<void> {
  if (await existe(cible)) {
    throw new Error(`La destination existe déjà : ${cible}`);
  }
  try {
    await renommerFichier(source, cible);
    return;
  } catch (erreur) {
    if (codeErreur(erreur) !== "EXDEV") throw erreur;
  }

  const temporaire = join(dirname(cible), `.${basename(cible)}.${randomUUID()}.tmp`);
  try {
    await copyFile(source, temporaire, constants.COPYFILE_EXCL);
    const [original, copie] = await Promise.all([stat(source), stat(temporaire)]);
    if (original.size !== copie.size) {
      throw new Error(`Copie incomplète de ${basename(source)} : ${copie.size} octets sur ${original.size}.`);
    }
    await renommer(temporaire, cible);
  } catch (erreur) {
    await rm(temporaire, { force: true });
    throw erreur;
  }
  await rm(source);
}

export async function deplacerTous(deplacements: Deplacement[], renommerFichier: Renommer = renommer): Promise<void> {
  const faits: Deplacement[] = [];
  for (const deplacement of deplacements) {
    try {
      await mkdir(dirname(deplacement.cible), { recursive: true });
      await deplacerFichier(deplacement.source, deplacement.cible, renommerFichier);
      faits.push(deplacement);
    } catch (erreur) {
      const nonRemis: Deplacement[] = [];
      for (const fait of faits.reverse()) {
        try {
          await deplacerFichier(fait.cible, fait.source, renommerFichier);
        } catch {
          nonRemis.push(fait);
        }
      }
      const cause = erreur instanceof Error ? erreur.message : String(erreur);
      throw new ErreurDeplacement(`Impossible de déplacer ${basename(deplacement.source)} : ${cause}`, nonRemis);
    }
  }
}
