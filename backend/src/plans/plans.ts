import { copyFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  cheminPlan,
  MOTIF_VERSION,
  numeroVersion,
  schemaPlanMontage,
  type PlanMontage,
  type Projet,
  type PropositionPlan,
  type ReponsePlans,
  type VersionPlan,
} from "@editeur/shared";
import { codeErreur } from "../erreurs.ts";
import { listerBibliotheque } from "../bibliotheque/bibliotheque.ts";
import { cheminSur, ecrireJsonAtomique, existe, FichierInvalideError, lireJsonComplete } from "../fichiers.ts";
import { decrireDossier } from "../media/fichiers-media.ts";
import { lireProjet } from "../projets/projets.ts";
import { validerPlan, type SourcesPlan } from "./validation.ts";

const MOTIF_APERCU = /^apercu\.[a-z0-9]+$/;

interface EtatVersion {
  version: string;
  apercu: boolean;
}

export async function listerVersions(dossierProjet: string): Promise<EtatVersion[]> {
  let entrees;
  try {
    entrees = await readdir(join(dossierProjet, "versions"), { withFileTypes: true });
  } catch (erreur) {
    if (codeErreur(erreur) === "ENOENT") return [];
    throw erreur;
  }
  const versions: EtatVersion[] = [];
  for (const entree of entrees) {
    if (!entree.isDirectory() || !MOTIF_VERSION.test(entree.name)) continue;
    const fichiers = await readdir(join(dossierProjet, "versions", entree.name));
    versions.push({ version: entree.name, apercu: fichiers.some((nom) => MOTIF_APERCU.test(nom)) });
  }
  return versions.sort((a, b) => numeroVersion(b.version) - numeroVersion(a.version));
}

export async function sourcesPlan(creations: string, projet: Projet, ffprobe: string): Promise<SourcesPlan> {
  const dossier = cheminSur(creations, projet.chemin);
  const [{ fichiers }, bibliotheque] = await Promise.all([decrireDossier(dossier, ffprobe), listerBibliotheque(creations)]);
  const minutes = projet.metadata.consignes.dureeViseeMinutes;
  return {
    medias: new Map(fichiers.map((fichier) => [fichier.chemin, { genre: fichier.genre, duree: fichier.infos?.duree ?? null }])),
    assets: new Map(bibliotheque.elements.map(({ asset, statut }) => [asset.id, { asset, valide: statut.valide }])),
    assetsChoisis: projet.metadata.assetsBibliotheque,
    dureeViseeSecondes: minutes === null ? null : minutes * 60,
  };
}

export async function lirePlan(dossierProjet: string, version: string): Promise<PlanMontage | null> {
  const chemin = join(dossierProjet, cheminPlan(version));
  if (!(await existe(chemin))) return null;
  return lireJsonComplete(chemin, schemaPlanMontage, {});
}

export async function listerPlans(creations: string, id: string, ffprobe: string): Promise<ReponsePlans> {
  const projet = await lireProjet(creations, id);
  const dossier = cheminSur(creations, projet.chemin);
  const etats = await listerVersions(dossier);
  if (etats.length === 0) return { versions: [] };
  const sources = await sourcesPlan(creations, projet, ffprobe);
  const versions: VersionPlan[] = [];
  for (const { version, apercu } of etats) {
    try {
      const plan = await lirePlan(dossier, version);
      if (plan === null) continue;
      versions.push({ version, plan, erreur: null, problemes: validerPlan(plan, sources), apercu });
    } catch (erreur) {
      if (!(erreur instanceof FichierInvalideError)) throw erreur;
      versions.push({ version, plan: null, erreur: erreur.message, problemes: [], apercu });
    }
  }
  return { versions };
}

export async function versionAProposer(dossierProjet: string): Promise<{ version: string; remplace: boolean }> {
  const [derniere] = await listerVersions(dossierProjet);
  if (derniere === undefined) return { version: "v1", remplace: false };
  if (!derniere.apercu && !(await estValide(dossierProjet, derniere.version))) return { version: derniere.version, remplace: true };
  return { version: `v${numeroVersion(derniere.version) + 1}`, remplace: false };
}

export async function enregistrerProposition(dossierProjet: string, proposition: PropositionPlan, maintenant = new Date()): Promise<PlanMontage> {
  const { version, remplace } = await versionAProposer(dossierProjet);
  const cible = join(dossierProjet, cheminPlan(version));
  if (remplace && (await existe(cible))) {
    const archive = join(dossierProjet, "travail", "propositions", `${version}_${maintenant.toISOString().replaceAll(":", "-")}.json`);
    await mkdir(dirname(archive), { recursive: true });
    await copyFile(cible, archive);
  }
  const plan: PlanMontage = { ...proposition, version, statut: "propose", creeLe: maintenant.toISOString(), modifieLe: null };
  await mkdir(dirname(cible), { recursive: true });
  await ecrireJsonAtomique(cible, plan);
  return plan;
}

async function estValide(dossierProjet: string, version: string): Promise<boolean> {
  try {
    return (await lirePlan(dossierProjet, version))?.statut === "valide";
  } catch (erreur) {
    if (erreur instanceof FichierInvalideError) return false;
    throw erreur;
  }
}
