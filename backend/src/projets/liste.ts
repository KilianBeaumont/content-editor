import { readdir } from "node:fs/promises";
import {
  CHAINES,
  DOSSIERS_CHAINES,
  type DetailProjet,
  type EtapeProjet,
  type MetadataProjet,
  type ReponseFichiersProjet,
  type ReponseListeProjets,
} from "@editeur/shared";
import { codeErreur } from "../erreurs.ts";
import { cheminSur } from "../fichiers.ts";
import { decrireDossier, listerFichiers } from "../media/fichiers-media.ts";
import { lireProjet, MOTIF_ID_PROJET } from "./projets.ts";

export async function etapeProjet(dossier: string, metadata: MetadataProjet): Promise<EtapeProjet> {
  const fichiers = await listerFichiers(dossier);
  if (fichiers.some((chemin) => chemin.startsWith("exports/"))) return "exporte";
  if (metadata.versionValidee !== null) return "valide";
  if (fichiers.some((chemin) => /^versions\/v\d+\/apercu\.[^/]+$/.test(chemin))) return "apercu";
  if (fichiers.some((chemin) => /^versions\/v\d+\/plan\.json$/.test(chemin))) return "plan";
  if (fichiers.some((chemin) => /^travail\/transcriptions?\b/.test(chemin))) return "analyse";
  return "fichiers";
}

export async function lireDetailProjet(creations: string, id: string): Promise<DetailProjet> {
  const projet = await lireProjet(creations, id);
  return { ...projet, etape: await etapeProjet(cheminSur(creations, projet.chemin), projet.metadata) };
}

export async function listerProjets(creations: string): Promise<ReponseListeProjets> {
  const reponse: ReponseListeProjets = { projets: [], illisibles: [] };
  for (const chaine of CHAINES) {
    const racine = DOSSIERS_CHAINES[chaine];
    let entrees;
    try {
      entrees = await readdir(cheminSur(creations, racine), { withFileTypes: true });
    } catch (erreur) {
      if (codeErreur(erreur) === "ENOENT") continue;
      throw erreur;
    }
    for (const entree of entrees) {
      if (!entree.isDirectory() || entree.name.startsWith(".")) continue;
      const chemin = `${racine}/${entree.name}`;
      if (!MOTIF_ID_PROJET.test(entree.name)) {
        reponse.illisibles.push({ chemin, erreur: "Nom de dossier non conforme : AAAA-MM-JJ_titre-en-minuscules." });
        continue;
      }
      try {
        const { id, metadata, etape } = await lireDetailProjet(creations, entree.name);
        reponse.projets.push({
          id,
          chemin,
          chaine: metadata.chaine,
          categorie: metadata.categorie,
          titre: metadata.titre,
          datePublicationPrevue: metadata.datePublicationPrevue,
          etape,
          sorties: metadata.sorties,
          nombreFichiers: metadata.fichiers.length,
        });
      } catch (erreur) {
        reponse.illisibles.push({ chemin, erreur: erreur instanceof Error ? erreur.message : String(erreur) });
      }
    }
  }
  reponse.projets.sort((a, b) => a.datePublicationPrevue.localeCompare(b.datePublicationPrevue) || a.id.localeCompare(b.id));
  return reponse;
}

export async function fichiersProjet(creations: string, id: string, ffprobe: string): Promise<ReponseFichiersProjet> {
  const projet = await lireProjet(creations, id);
  return decrireDossier(cheminSur(creations, projet.chemin), ffprobe, (chemin) => chemin !== "metadata.json" && !chemin.startsWith("travail/") && !chemin.startsWith("versions/"));
}
