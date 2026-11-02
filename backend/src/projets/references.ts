import type { MetadataProjet } from "@editeur/shared";
import { lierVideoArtiste } from "../artistes/artistes.ts";
import { lierRecitAuteur } from "../auteurs/auteurs.ts";
import { lierUtilisations } from "../bibliotheque/bibliotheque.ts";

type Liens = Pick<MetadataProjet, "artistes" | "auteur" | "assetsBibliotheque">;

const AUCUN_LIEN: Liens = { artistes: [], auteur: null, assetsBibliotheque: [] };

export async function mettreAJourReferences(
  creations: string,
  ancienId: string | null,
  nouveauId: string | null,
  avant: Liens = AUCUN_LIEN,
  apres: Liens = AUCUN_LIEN,
): Promise<string[]> {
  const avertissements: string[] = [];
  const essayer = async (operation: () => Promise<void>, description: string) => {
    try {
      await operation();
    } catch (erreur) {
      avertissements.push(`${description} : ${erreur instanceof Error ? erreur.message : String(erreur)}`);
    }
  };

  for (const artiste of new Set([...avant.artistes, ...apres.artistes])) {
    const garde = apres.artistes.includes(artiste) ? nouveauId : null;
    await essayer(() => lierVideoArtiste(creations, artiste, ancienId, garde), `Fiche de l'artiste ${artiste} non mise à jour`);
  }

  const auteurs = new Set([avant.auteur?.id, apres.auteur?.id].filter((id): id is string => typeof id === "string"));
  for (const auteur of auteurs) {
    const garde = apres.auteur?.id === auteur ? nouveauId : null;
    await essayer(() => lierRecitAuteur(creations, auteur, ancienId, garde), `Fiche de l'auteur ${auteur} non mise à jour`);
  }

  if (avant.assetsBibliotheque.length > 0 || apres.assetsBibliotheque.length > 0) {
    await essayer(
      () => lierUtilisations(creations, ancienId, nouveauId, apres.assetsBibliotheque),
      "Catalogue de la bibliothèque non mis à jour",
    );
  }
  return avertissements;
}
