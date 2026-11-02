import { mkdir, rm, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import type { Readable } from "node:stream";
import {
  CATEGORIES_PAR_CHAINE,
  CHAINES,
  DEFINITIONS_SORTIES,
  destinationsPossibles,
  DOSSIERS_CHAINES,
  EXTENSIONS_PREUVE,
  schemaMetadataProjet,
  slug,
  type AuteurProjet,
  type AutorisationProjet,
  type Chaine,
  type FichierProjet,
  type MetadataProjet,
  type Projet,
  type ReponseCreationProjet,
  type SaisieProjet,
} from "@editeur/shared";
import { ajouterVideoArtiste, lireArtiste } from "../artistes/artistes.ts";
import { ajouterRecitAuteur, lireAuteur } from "../auteurs/auteurs.ts";
import { ajouterUtilisations, lireAsset } from "../bibliotheque/bibliotheque.ts";
import { codeErreur, ErreurHttp } from "../erreurs.ts";
import { cheminSur, ecrireJsonAtomique, existe, FichierInvalideError, lireJsonComplete } from "../fichiers.ts";
import { enregistrerFlux, nomLibre, verifierExtension } from "../televersement.ts";
import { deplacerTous, ErreurDeplacement, type Deplacement, type Renommer } from "./deplacement.ts";

export const MOTIF_ID_PROJET = /^\d{4}-\d{2}-\d{2}_[a-z0-9]+(?:-[a-z0-9]+)*$/;
const METADATA = "metadata.json";
const COMPLEMENTS_METADATA: Partial<MetadataProjet> = {
  description: { fr: "", en: "" },
  auteur: null,
  autorisation: null,
  artistes: [],
  assetsBibliotheque: [],
  langues: ["fr"],
  sorties: [],
  nombreFormatsCourts: null,
  consignes: { intention: "", dureeViseeMinutes: null, aGarder: "", aEviter: "" },
  fichiers: [],
  versionValidee: null,
  sessionClaude: null,
};

function cheminDansInbox(creations: string, chemin: string): string {
  return cheminSur(cheminSur(creations, "inbox"), chemin);
}

function refuser(message: string): never {
  throw new ErreurHttp(400, message);
}

async function verifierExistence(verification: () => Promise<unknown>, message: string): Promise<void> {
  try {
    await verification();
  } catch (erreur) {
    if (erreur instanceof ErreurHttp && erreur.statut === 404) refuser(message);
    throw erreur;
  }
}

interface SaisieVerifiee extends SaisieProjet {
  auteur: AuteurProjet | null;
}

async function verifierSaisie(creations: string, saisie: SaisieProjet): Promise<SaisieVerifiee> {
  const { chaine } = saisie;
  if (!CATEGORIES_PAR_CHAINE[chaine].includes(saisie.categorie)) {
    refuser(`La catégorie ${saisie.categorie} n'existe pas pour la chaîne ${chaine}.`);
  }
  const anglais = chaine === "recits" && saisie.anglais;
  const titreEn = saisie.titre.en?.trim() || null;
  if (anglais && titreEn === null) refuser("Indique le titre anglais.");

  for (const sortie of saisie.sorties) {
    const definition = DEFINITIONS_SORTIES[sortie];
    if (!definition.chaines.includes(chaine)) refuser(`La sortie « ${definition.libelle} » n'existe pas pour cette chaîne.`);
    if (definition.anglais && !anglais) refuser(`La sortie « ${definition.libelle} » demande une version anglaise.`);
  }
  const formatsCourts = saisie.sorties.includes("formats-courts");
  if (formatsCourts && saisie.nombreFormatsCourts === null) refuser("Indique le nombre de formats courts souhaités.");

  const destinations = destinationsPossibles(chaine, anglais, saisie.artistes);
  const vus = new Set<string>();
  for (const fichier of saisie.fichiers) {
    if (vus.has(fichier.chemin)) refuser(`Fichier choisi deux fois : ${fichier.chemin}`);
    vus.add(fichier.chemin);
    if (!destinations.includes(fichier.destination)) refuser(`Destination inconnue pour ${fichier.chemin} : ${fichier.destination}`);
    const absolu = cheminDansInbox(creations, fichier.chemin);
    if (!(await existe(absolu)) || !(await stat(absolu)).isFile()) refuser(`Fichier introuvable dans l'inbox : ${fichier.chemin}`);
  }

  for (const artiste of saisie.artistes) {
    await verifierExistence(() => lireArtiste(creations, artiste), `Artiste inconnu : ${artiste}`);
  }
  for (const asset of saisie.assetsBibliotheque) {
    await verifierExistence(() => lireAsset(creations, asset), `Asset inconnu dans la bibliothèque : ${asset}`);
  }

  let auteur: AuteurProjet | null = null;
  if (chaine === "recits") {
    if (saisie.auteur === null) refuser("Indique l'auteur du récit, ou que c'est ton histoire.");
    if (saisie.auteur.estUtilisateur) {
      auteur = { ...saisie.auteur, id: null };
    } else {
      const id = saisie.auteur.id;
      if (id === null) refuser("Choisis la fiche de l'auteur ou de l'autrice.");
      let nom = "";
      await verifierExistence(async () => {
        nom = (await lireAuteur(creations, id)).fiche.nom;
      }, `Auteur inconnu : ${id}`);
      auteur = { ...saisie.auteur, nom };
      if (saisie.autorisation === null) refuser("Renseigne l'autorisation de l'auteur.");
    }
  }

  return {
    ...saisie,
    anglais,
    titre: { fr: saisie.titre.fr, en: anglais ? titreEn : null },
    nombreFormatsCourts: formatsCourts ? saisie.nombreFormatsCourts : null,
    auteur,
    autorisation: auteur !== null && !auteur.estUtilisateur ? saisie.autorisation : null,
  };
}

function sousDossiers(saisie: SaisieVerifiee): string[] {
  const dossiers = ["assets", "travail", "versions", ...saisie.sorties.map((sortie) => `exports/${sortie}`)];
  if (saisie.chaine === "creation") {
    dossiers.push("rushes");
  } else {
    dossiers.push("texte", "voix/fr", "autorisation");
    if (saisie.anglais) dossiers.push("voix/en");
  }
  dossiers.push(...saisie.artistes.map((artiste) => `assets/${artiste}`));
  return dossiers;
}

function nomUnique(nom: string, pris: Set<string>): string {
  const extension = extname(nom);
  const base = nom.slice(0, nom.length - extension.length);
  for (let numero = 1; ; numero++) {
    const candidat = numero === 1 ? nom : `${base} (${numero})${extension}`;
    if (!pris.has(candidat.toLowerCase())) {
      pris.add(candidat.toLowerCase());
      return candidat;
    }
  }
}

async function projetExiste(creations: string, id: string): Promise<boolean> {
  for (const chaine of CHAINES) {
    if (await existe(cheminSur(creations, `${DOSSIERS_CHAINES[chaine]}/${id}`))) return true;
  }
  return false;
}

export async function creerProjet(
  creations: string,
  saisieBrute: SaisieProjet,
  renommerFichier?: Renommer,
  maintenant = new Date(),
): Promise<ReponseCreationProjet> {
  const saisie = await verifierSaisie(creations, saisieBrute);
  const titreSlug = slug(saisie.titre.fr);
  if (titreSlug === "") refuser("Le titre doit contenir au moins une lettre ou un chiffre.");
  const id = `${saisie.datePublicationPrevue}_${titreSlug}`;
  const relatif = `${DOSSIERS_CHAINES[saisie.chaine]}/${id}`;
  const dossier = cheminSur(creations, relatif);

  if (await projetExiste(creations, id)) {
    throw new ErreurHttp(409, `Un projet existe déjà sous le nom ${id}.`);
  }
  await mkdir(cheminSur(creations, DOSSIERS_CHAINES[saisie.chaine]), { recursive: true });
  try {
    await mkdir(dossier);
  } catch (erreur) {
    if (codeErreur(erreur) === "EEXIST") throw new ErreurHttp(409, `Un projet existe déjà sous le nom ${id}.`);
    throw erreur;
  }

  for (const sousDossier of sousDossiers(saisie)) {
    await mkdir(join(dossier, sousDossier), { recursive: true });
  }

  const pris = new Map<string, Set<string>>();
  const deplacements: Deplacement[] = [];
  const fichiers: FichierProjet[] = [];
  for (const fichier of saisie.fichiers) {
    const noms = pris.get(fichier.destination) ?? new Set<string>();
    pris.set(fichier.destination, noms);
    const chemin = `${fichier.destination}/${nomUnique(basename(fichier.chemin), noms)}`;
    deplacements.push({ source: cheminDansInbox(creations, fichier.chemin), cible: join(dossier, chemin) });
    fichiers.push({ chemin, origine: `inbox/${fichier.chemin}`, note: fichier.note });
  }

  try {
    await deplacerTous(deplacements, renommerFichier);
  } catch (erreur) {
    if (!(erreur instanceof ErreurDeplacement)) throw erreur;
    if (erreur.nonRemis.length === 0) {
      await rm(dossier, { recursive: true, force: true });
      throw new ErreurHttp(500, `${erreur.message}\nRien n'a été créé : tous les fichiers sont restés dans l'inbox.`);
    }
    const liste = erreur.nonRemis.map((element) => `- ${element.cible}`).join("\n");
    throw new ErreurHttp(
      500,
      `${erreur.message}\nCes fichiers n'ont pas pu être remis dans l'inbox et se trouvent dans le projet :\n${liste}`,
    );
  }

  const autorisation: AutorisationProjet | null = saisie.autorisation === null ? null : { ...saisie.autorisation, preuve: null };
  const metadata: MetadataProjet = {
    categorie: saisie.categorie,
    chaine: saisie.chaine,
    titre: saisie.titre,
    description: { fr: "", en: "" },
    auteur: saisie.auteur,
    autorisation,
    artistes: saisie.artistes,
    assetsBibliotheque: saisie.assetsBibliotheque,
    langues: saisie.anglais ? ["fr", "en"] : ["fr"],
    sorties: saisie.sorties,
    nombreFormatsCourts: saisie.nombreFormatsCourts,
    consignes: saisie.consignes,
    fichiers,
    versionValidee: null,
    datePublicationPrevue: saisie.datePublicationPrevue,
    sessionClaude: null,
    creeLe: maintenant.toISOString(),
  };
  await ecrireJsonAtomique(join(dossier, METADATA), metadata);

  const avertissements: string[] = [];
  const lier = async (operation: () => Promise<void>, description: string) => {
    try {
      await operation();
    } catch (erreur) {
      avertissements.push(`${description} : ${erreur instanceof Error ? erreur.message : String(erreur)}`);
    }
  };
  for (const artiste of saisie.artistes) {
    await lier(() => ajouterVideoArtiste(creations, artiste, id), `Fiche de l'artiste ${artiste} non mise à jour`);
  }
  if (saisie.auteur?.id) {
    const auteurId = saisie.auteur.id;
    await lier(() => ajouterRecitAuteur(creations, auteurId, id), `Fiche de l'auteur ${auteurId} non mise à jour`);
  }
  if (saisie.assetsBibliotheque.length > 0) {
    await lier(() => ajouterUtilisations(creations, saisie.assetsBibliotheque, id), "Catalogue de la bibliothèque non mis à jour");
  }

  return { projet: { id, chemin: relatif, metadata }, avertissements };
}

async function trouverProjet(creations: string, id: string): Promise<{ chaine: Chaine; dossier: string }> {
  if (MOTIF_ID_PROJET.test(id)) {
    for (const chaine of CHAINES) {
      const dossier = cheminSur(creations, `${DOSSIERS_CHAINES[chaine]}/${id}`);
      if (await existe(dossier)) return { chaine, dossier };
    }
  }
  throw new ErreurHttp(404, `Projet introuvable : ${id}`);
}

export async function lireProjet(creations: string, id: string): Promise<Projet> {
  const { chaine, dossier } = await trouverProjet(creations, id);
  const chemin = join(dossier, METADATA);
  if (!(await existe(chemin))) throw new FichierInvalideError(`${METADATA} manquant dans ${id}.`);
  const metadata = await lireJsonComplete(chemin, schemaMetadataProjet, COMPLEMENTS_METADATA);
  return { id, chemin: `${DOSSIERS_CHAINES[chaine]}/${id}`, metadata };
}

export async function enregistrerPreuveAutorisation(
  creations: string,
  id: string,
  nomFichier: string,
  flux: Readable,
): Promise<Projet> {
  verifierExtension(nomFichier, EXTENSIONS_PREUVE);
  const projet = await lireProjet(creations, id);
  if (projet.metadata.autorisation === null) {
    throw new ErreurHttp(400, "Ce projet n'a pas d'autorisation d'auteur à prouver.");
  }
  const dossier = join(cheminSur(creations, projet.chemin), "autorisation");
  await mkdir(dossier, { recursive: true });
  const nom = await nomLibre(dossier, nomFichier, "autorisation");
  await enregistrerFlux(flux, dossier, nom);
  const metadata: MetadataProjet = {
    ...projet.metadata,
    autorisation: { ...projet.metadata.autorisation, preuve: `autorisation/${nom}` },
  };
  await ecrireJsonAtomique(join(cheminSur(creations, projet.chemin), METADATA), metadata);
  return { ...projet, metadata };
}
