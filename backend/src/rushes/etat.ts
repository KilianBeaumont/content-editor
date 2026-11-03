import { stat } from "node:fs/promises";
import { join } from "node:path";
import { cheminPreparation, type AnalyseAudio, type EtatTranscription, type PreparationRush } from "@editeur/shared";
import { z } from "zod";
import { codeErreur } from "../erreurs.ts";
import { FichierInvalideError, lireJsonComplete } from "../fichiers.ts";

const schemaPreparation = z.object({
  version: z.literal(1),
  source: z.string(),
  tailleSource: z.number(),
  modifieSource: z.string(),
  creeLe: z.string(),
  duree: z.number().nullable(),
  hdr: z.boolean(),
  proxy: z.string().nullable(),
  planches: z
    .object({
      intervalle: z.number(),
      colonnes: z.number(),
      lignes: z.number(),
      horodatees: z.boolean(),
      fichiers: z.array(z.string()),
    })
    .nullable(),
  audio: z.string().nullable(),
}) satisfies z.ZodType<PreparationRush>;

export async function lirePreparation(dossierProjet: string, chemin: string): Promise<PreparationRush | null> {
  try {
    return await lireJsonComplete(join(dossierProjet, cheminPreparation(chemin)), schemaPreparation, {});
  } catch (erreur) {
    if (codeErreur(erreur) === "ENOENT" || erreur instanceof FichierInvalideError) return null;
    throw erreur;
  }
}

export async function etatPreparation(dossierProjet: string, chemin: string, preparation: PreparationRush | null): Promise<EtatTranscription> {
  if (preparation === null) return "absente";
  const infos = await stat(join(dossierProjet, chemin));
  return infos.size === preparation.tailleSource && infos.mtime.toISOString() === preparation.modifieSource ? "a-jour" : "perimee";
}

const schemaAnalyseAudio = z.object({
  pas: z.number(),
  niveaux: z.array(z.number()),
  seuilSilence: z.number(),
  silences: z.array(z.object({ debut: z.number(), fin: z.number() })),
  pics: z.array(z.object({ temps: z.number(), niveau: z.number() })),
}) satisfies z.ZodType<AnalyseAudio>;

export async function lireAnalyseAudio(dossierProjet: string, preparation: PreparationRush | null): Promise<AnalyseAudio | null> {
  if (preparation?.audio === null || preparation?.audio === undefined) return null;
  try {
    return await lireJsonComplete(join(dossierProjet, preparation.audio), schemaAnalyseAudio, {});
  } catch (erreur) {
    if (codeErreur(erreur) === "ENOENT" || erreur instanceof FichierInvalideError) return null;
    throw erreur;
  }
}
