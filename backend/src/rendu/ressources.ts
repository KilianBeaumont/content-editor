import type { OrigineMusique, PlanMontage, Projet } from "@editeur/shared";
import { lireAsset } from "../bibliotheque/bibliotheque.ts";
import { cheminSur } from "../fichiers.ts";
import { sonderMedia } from "../media/ffprobe.ts";
import { sourcesPlan } from "../plans/plans.ts";
import { validerPlan } from "../plans/validation.ts";
import type { BruitageRendu, MusiqueRendu } from "./graphe.ts";

export async function verifierPlanSansErreur(creations: string, projet: Projet, plan: PlanMontage, ffprobe: string): Promise<void> {
  const erreurs = validerPlan(plan, await sourcesPlan(creations, projet, ffprobe)).filter((probleme) => probleme.niveau === "erreur");
  if (erreurs.length > 0) throw new Error(`Le plan contient des erreurs : ${erreurs.map((probleme) => probleme.message).join(" ")}`);
}

export async function resoudreMusiques(creations: string, dossier: string, plan: PlanMontage, ffprobe: string): Promise<MusiqueRendu[]> {
  const musiques: MusiqueRendu[] = [];
  for (const musique of plan.musiques) {
    const fichier = await cheminAudio(creations, dossier, musique.origine, musique.reference);
    musiques.push({ ...musique, source: fichier, dureeFichier: (await sonderMedia(ffprobe, fichier)).duree });
  }
  return musiques;
}

async function cheminAudio(creations: string, dossier: string, origine: OrigineMusique, reference: string): Promise<string> {
  return origine === "projet" ? cheminSur(dossier, reference) : cheminSur(creations, `bibliotheque/${(await lireAsset(creations, reference)).asset.chemin}`);
}

export async function resoudreBruitages(creations: string, dossier: string, plan: PlanMontage): Promise<BruitageRendu[]> {
  const bruitages: BruitageRendu[] = [];
  for (const bruitage of plan.bruitages) {
    bruitages.push({ source: await cheminAudio(creations, dossier, bruitage.origine, bruitage.reference), position: bruitage.position, volumeDb: bruitage.volumeDb });
  }
  return bruitages;
}
