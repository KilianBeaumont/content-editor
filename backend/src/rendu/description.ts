import type { PlanMontage, Projet } from "@editeur/shared";
import { lireArtiste } from "../artistes/artistes.ts";
import { lireAuteur } from "../auteurs/auteurs.ts";
import { lireAsset } from "../bibliotheque/bibliotheque.ts";

function liens(valeurs: Record<string, string>): string {
  return Object.entries(valeurs)
    .filter(([, adresse]) => adresse.trim() !== "")
    .map(([nom, adresse]) => `${nom} : ${adresse}`)
    .join(" · ");
}

async function ou<T>(promesse: Promise<T>): Promise<T | null> {
  try {
    return await promesse;
  } catch {
    return null;
  }
}

export async function descriptionProjet(creations: string, projet: Projet, plan: PlanMontage | null): Promise<string> {
  const { metadata } = projet;
  const credits: string[] = [];

  if (metadata.auteur !== null) {
    if (metadata.auteur.estUtilisateur) {
      credits.push(`Une histoire originale de ${metadata.auteur.nom}.`);
    } else {
      const fiche = metadata.auteur.id === null ? null : await ou(lireAuteur(creations, metadata.auteur.id));
      const details = [metadata.auteur.source, fiche === null ? "" : liens(fiche.fiche.liens)].filter((texte) => texte !== "").join(" · ");
      credits.push(`Histoire : ${metadata.auteur.nom}${details === "" ? "" : ` (${details})`}`);
    }
  }

  const artistes = new Set(metadata.artistes);
  const assets = new Set([...metadata.assetsBibliotheque, ...(plan?.musiques ?? []).filter((musique) => musique.origine === "bibliotheque").map((musique) => musique.reference)]);
  const lignesAssets: string[] = [];
  for (const id of assets) {
    const element = await ou(lireAsset(creations, id));
    if (element === null) continue;
    const { asset } = element;
    if (asset.source === "artiste" && asset.artiste !== null) artistes.add(asset.artiste);
    if (asset.source === "externe" && asset.licence.trim() !== "") lignesAssets.push(`${asset.description.trim() || asset.chemin.split("/").at(-1)} : ${asset.licence.trim()}`);
  }
  for (const id of artistes) {
    const artiste = await ou(lireArtiste(creations, id));
    if (artiste === null) continue;
    const adresses = liens(artiste.fiche.liens);
    credits.push(`Visuels : ${artiste.fiche.nom}${adresses === "" ? "" : ` (${adresses})`}`);
  }
  credits.push(...lignesAssets);

  const texte = metadata.description.fr.trim() || metadata.titre.fr;
  return credits.length === 0 ? `${texte}\n` : `${texte}\n\nCrédits\n${credits.map((ligne) => `- ${ligne}`).join("\n")}\n`;
}
