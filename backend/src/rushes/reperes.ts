import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { type Repere, type ReponseReperes, type SaisieRepere } from "@editeur/shared";
import { z } from "zod";
import { ErreurHttp } from "../erreurs.ts";
import { cheminSur, ecrireJsonAtomique, existe, lireJsonAvecDefauts } from "../fichiers.ts";
import { lireProjet } from "../projets/projets.ts";
import { enSerie } from "../serie.ts";

export const FICHIER_REPERES = "travail/reperes.json";

const schemaReperes = z.object({
  reperes: z.array(z.object({ id: z.string(), source: z.string(), temps: z.number(), note: z.string(), creeLe: z.string() })),
}) satisfies z.ZodType<ReponseReperes>;

async function dossierProjet(creations: string, id: string): Promise<string> {
  return cheminSur(creations, (await lireProjet(creations, id)).chemin);
}

export async function lireReperes(dossier: string): Promise<Repere[]> {
  const { reperes } = await lireJsonAvecDefauts(join(dossier, FICHIER_REPERES), schemaReperes, { reperes: [] });
  return reperes.sort((a, b) => a.source.localeCompare(b.source, "fr", { numeric: true }) || a.temps - b.temps);
}

export async function listerReperes(creations: string, id: string): Promise<ReponseReperes> {
  return { reperes: await lireReperes(await dossierProjet(creations, id)) };
}

export async function ajouterRepere(creations: string, id: string, saisie: SaisieRepere): Promise<ReponseReperes> {
  const dossier = await dossierProjet(creations, id);
  if (!(await existe(cheminSur(dossier, saisie.source)))) throw new ErreurHttp(400, `Fichier introuvable dans le projet : ${saisie.source}`);
  return enSerie(dossier, async () => {
    const reperes = await lireReperes(dossier);
    reperes.push({ id: randomUUID(), ...saisie, temps: Math.round(saisie.temps * 100) / 100, creeLe: new Date().toISOString() });
    await ecrireJsonAtomique(join(dossier, FICHIER_REPERES), { reperes });
    return { reperes: await lireReperes(dossier) };
  });
}

export async function supprimerRepere(creations: string, id: string, repere: string): Promise<ReponseReperes> {
  const dossier = await dossierProjet(creations, id);
  return enSerie(dossier, async () => {
    const reperes = await lireReperes(dossier);
    if (!reperes.some((element) => element.id === repere)) throw new ErreurHttp(404, "Repère introuvable.");
    await ecrireJsonAtomique(join(dossier, FICHIER_REPERES), { reperes: reperes.filter((element) => element.id !== repere) });
    return { reperes: await lireReperes(dossier) };
  });
}
