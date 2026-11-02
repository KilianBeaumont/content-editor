import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Readable } from "node:stream";
import {
  FICHE_ARTISTE_VIDE,
  schemaFicheArtiste,
  slug,
  type AccordArtiste,
  type Artiste,
  type FicheArtiste,
  type ReponseListeArtistes,
  type SaisieArtiste,
  type StatutAccord,
} from "@editeur/shared";
import { z } from "zod";
import { mettreALaCorbeille } from "../corbeille.ts";
import { codeErreur, ErreurHttp } from "../erreurs.ts";
import {
  cheminSur,
  ecrireJsonAtomique,
  existe,
  FichierInvalideError,
  fusionnerAvecDefauts,
  lireTexte,
} from "../fichiers.ts";
import { enregistrerFlux, nomLibre, verifierExtension } from "../televersement.ts";

const DOSSIER_ARTISTES = "artistes";
const FICHE = "fiche.json";
const DOSSIER_ACCORD = "accord";
const MOTIF_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const EXTENSIONS_PREUVE = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf", ".txt", ".eml"] as const;

function dossierArtiste(creations: string, id: string): string {
  if (!MOTIF_ID.test(id)) {
    throw new ErreurHttp(404, `Artiste introuvable : ${id}`);
  }
  return cheminSur(creations, `${DOSSIER_ARTISTES}/${id}`);
}

export async function statutAccord(dossier: string, accord: AccordArtiste): Promise<StatutAccord> {
  const problemes: string[] = [];
  if (accord.date === null) {
    problemes.push("Date de l'accord manquante.");
  }
  if (accord.preuve === null) {
    problemes.push("Preuve de l'accord manquante.");
  } else {
    let present: boolean;
    try {
      present = await existe(cheminSur(dossier, accord.preuve));
    } catch {
      present = false;
    }
    if (!present) {
      problemes.push(`Fichier de preuve introuvable : ${accord.preuve}`);
    }
  }
  return { valide: problemes.length === 0, problemes };
}

async function lireFiche(dossier: string): Promise<FicheArtiste> {
  let brut: unknown;
  try {
    brut = JSON.parse(await lireTexte(join(dossier, FICHE)));
  } catch (erreur) {
    if (codeErreur(erreur) === "ENOENT") {
      throw new FichierInvalideError(`${FICHE} manquant.`);
    }
    if (erreur instanceof SyntaxError) {
      throw new FichierInvalideError(`${FICHE} n'est pas un JSON valide : ${erreur.message}`);
    }
    throw erreur;
  }
  const resultat = schemaFicheArtiste.safeParse(fusionnerAvecDefauts(FICHE_ARTISTE_VIDE, brut));
  if (!resultat.success) {
    throw new FichierInvalideError(`${FICHE} invalide :\n${z.prettifyError(resultat.error)}`);
  }
  return resultat.data;
}

export async function lireArtiste(creations: string, id: string): Promise<Artiste> {
  const dossier = dossierArtiste(creations, id);
  if (!(await existe(dossier))) {
    throw new ErreurHttp(404, `Artiste introuvable : ${id}`);
  }
  const fiche = await lireFiche(dossier);
  return { id, fiche, statut: await statutAccord(dossier, fiche.accord) };
}

export async function listerArtistes(creations: string): Promise<ReponseListeArtistes> {
  const reponse: ReponseListeArtistes = { artistes: [], illisibles: [] };
  let entrees;
  try {
    entrees = await readdir(cheminSur(creations, DOSSIER_ARTISTES), { withFileTypes: true });
  } catch (erreur) {
    if (codeErreur(erreur) === "ENOENT") return reponse;
    throw erreur;
  }

  for (const entree of entrees) {
    if (!entree.isDirectory() || entree.name.startsWith(".")) continue;
    if (!MOTIF_ID.test(entree.name)) {
      reponse.illisibles.push({
        id: entree.name,
        erreur: "Nom de dossier non conforme : minuscules sans accents ni espaces, mots séparés par des tirets.",
      });
      continue;
    }
    try {
      reponse.artistes.push(await lireArtiste(creations, entree.name));
    } catch (erreur) {
      reponse.illisibles.push({ id: entree.name, erreur: erreur instanceof Error ? erreur.message : String(erreur) });
    }
  }

  reponse.artistes.sort((a, b) => a.fiche.nom.localeCompare(b.fiche.nom, "fr"));
  return reponse;
}

export async function creerArtiste(creations: string, saisie: SaisieArtiste): Promise<Artiste> {
  const id = slug(saisie.nom);
  const dossier = dossierArtiste(creations, id);
  await mkdir(cheminSur(creations, DOSSIER_ARTISTES), { recursive: true });
  try {
    await mkdir(dossier);
  } catch (erreur) {
    if (codeErreur(erreur) === "EEXIST") {
      throw new ErreurHttp(409, `Une fiche existe déjà pour « ${id} ».`);
    }
    throw erreur;
  }
  await mkdir(join(dossier, DOSSIER_ACCORD));
  const fiche: FicheArtiste = { ...saisie, accord: { ...saisie.accord, preuve: null }, videos: [] };
  await ecrireJsonAtomique(join(dossier, FICHE), fiche);
  return lireArtiste(creations, id);
}

export async function modifierArtiste(creations: string, id: string, saisie: SaisieArtiste): Promise<Artiste> {
  const actuel = await lireArtiste(creations, id);
  const fiche: FicheArtiste = {
    ...saisie,
    accord: { ...saisie.accord, preuve: actuel.fiche.accord.preuve },
    videos: actuel.fiche.videos,
  };
  await ecrireJsonAtomique(join(dossierArtiste(creations, id), FICHE), fiche);
  return lireArtiste(creations, id);
}

export async function supprimerArtiste(creations: string, id: string): Promise<string> {
  const actuel = await lireArtiste(creations, id);
  const nombre = actuel.fiche.videos.length;
  if (nombre > 0) {
    throw new ErreurHttp(
      409,
      `${actuel.fiche.nom} a participé à ${nombre} ${nombre === 1 ? "vidéo" : "vidéos"} : sa fiche est conservée.`,
    );
  }
  return mettreALaCorbeille(creations, `${DOSSIER_ARTISTES}/${id}`, DOSSIER_ARTISTES);
}

export async function enregistrerPreuve(
  creations: string,
  id: string,
  nomFichier: string,
  flux: Readable,
): Promise<Artiste> {
  verifierExtension(nomFichier, EXTENSIONS_PREUVE);
  const actuel = await lireArtiste(creations, id);
  const dossierAccord = join(dossierArtiste(creations, id), DOSSIER_ACCORD);
  await mkdir(dossierAccord, { recursive: true });
  const nom = await nomLibre(dossierAccord, nomFichier, "preuve");
  await enregistrerFlux(flux, dossierAccord, nom);

  const fiche: FicheArtiste = { ...actuel.fiche, accord: { ...actuel.fiche.accord, preuve: `${DOSSIER_ACCORD}/${nom}` } };
  await ecrireJsonAtomique(join(dossierArtiste(creations, id), FICHE), fiche);
  return lireArtiste(creations, id);
}
