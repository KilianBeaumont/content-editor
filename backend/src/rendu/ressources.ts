import type { PlanMontage, Projet } from "@editeur/shared";
import { lireAsset } from "../bibliotheque/bibliotheque.ts";
import { cheminSur } from "../fichiers.ts";
import { sonderMedia } from "../media/ffprobe.ts";
import { sourcesPlan } from "../plans/plans.ts";
import { validerPlan } from "../plans/validation.ts";
import type { MusiqueRendu } from "./graphe.ts";

export async function verifierPlanSansErreur(creations: string, projet: Projet, plan: PlanMontage, ffprobe: string): Promise<void> {
  const erreurs = validerPlan(plan, await sourcesPlan(creations, projet, ffprobe)).filter((probleme) => probleme.niveau === "erreur");
  if (erreurs.length > 0) throw new Error(`Le plan contient des erreurs : ${erreurs.map((probleme) => probleme.message).join(" ")}`);
}

export async function resoudreMusiques(creations: string, dossier: string, plan: PlanMontage, ffprobe: string): Promise<MusiqueRendu[]> {
  const musiques: MusiqueRendu[] = [];
  for (const musique of plan.musiques) {
    const fichier =
      musique.origine === "projet"
        ? cheminSur(dossier, musique.reference)
        : cheminSur(creations, `bibliotheque/${(await lireAsset(creations, musique.reference)).asset.chemin}`);
    musiques.push({ ...musique, source: fichier, dureeFichier: (await sonderMedia(ffprobe, fichier)).duree });
  }
  return musiques;
}
