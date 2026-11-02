import { mkdir, readdir, rm, stat } from "node:fs/promises";
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
  type FichierChoisi,
  type FichierProjet,
  type MetadataProjet,
  type ModificationProjet,
  type Projet,
  type ReponseCreationProjet,
  type ReponseModificationProjet,
  type SaisieProjet,
} from "@editeur/shared";
import { lireArtiste } from "../artistes/artistes.ts";
import { lireAuteur } from "../auteurs/auteurs.ts";
import { lireAsset } from "../bibliotheque/bibliotheque.ts";
import { mettreALaCorbeille } from "../corbeille.ts";
import { codeErreur, ErreurHttp } from "../erreurs.ts";
import { cheminSur, ecrireJsonAtomique, existe, FichierInvalideError, lireJsonComplete, renommer } from "../fichiers.ts";
import { enregistrerFlux, nomLibre, verifierExtension } from "../televersement.ts";
import { deplacerTous, ErreurDeplacement, type Deplacement, type Renommer } from "./deplacement.ts";
import { mettreAJourReferences } from "./references.ts";

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
  futurRoman: false,
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

async function verifierFichiersInbox(creations: string, fichiers: FichierChoisi[], destinations: string[]): Promise<void> {
  const vus = new Set<string>();
  for (const fichier of fichiers) {
    if (vus.has(fichier.chemin)) refuser(`Fichier choisi deux fois : ${fichier.chemin}`);
    vus.add(fichier.chemin);
    if (!destinations.includes(fichier.destination)) refuser(`Destination inconnue pour ${fichier.chemin} : ${fichier.destination}`);
    const absolu = cheminDansInbox(creations, fichier.chemin);
    if (!(await existe(absolu)) || !(await stat(absolu)).isFile()) refuser(`Fichier introuvable dans l'inbox : ${fichier.chemin}`);
  }
}

async function verifierSaisie(creations: string, saisie: SaisieProjet): Promise<SaisieProjet> {
  const { chaine } = saisie;
  if (!CATEGORIES_PAR_CHAINE[chaine].includes(saisie.categorie)) {
    refuser(`La catégorie ${saisie.categorie} n'existe pas pour la chaîne ${chaine}.`);
  }
  const anglais = chaine === "recits" && saisie.anglais;
  const titreEn = saisie.titre.en?.trim() || null;
  if (anglais && titreEn === null) refuser("Indique le titre anglais.");
  if (slug(saisie.titre.fr) === "") refuser("Le titre doit contenir au moins une lettre ou un chiffre.");

  for (const sortie of saisie.sorties) {
    const definition = DEFINITIONS_SORTIES[sortie];
    if (!definition.chaines.includes(chaine)) refuser(`La sortie « ${definition.libelle} » n'existe pas pour cette chaîne.`);
    if (definition.anglais && !anglais) refuser(`La sortie « ${definition.libelle} » demande une version anglaise.`);
  }
  const formatsCourts = saisie.sorties.includes("formats-courts");
  if (formatsCourts && saisie.nombreFormatsCourts === null) refuser("Indique le nombre de formats courts souhaités.");

  await verifierFichiersInbox(creations, saisie.fichiers, destinationsPossibles(chaine, anglais, saisie.artistes));

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
    futurRoman: auteur?.estUtilisateur === true && saisie.futurRoman,
  };
}

function sousDossiers(saisie: SaisieProjet): string[] {
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

async function nomsExistants(dossier: string): Promise<Set<string>> {
  try {
    return new Set((await readdir(dossier)).map((nom) => nom.toLowerCase()));
  } catch (erreur) {
    if (codeErreur(erreur) === "ENOENT") return new Set();
    throw erreur;
  }
}

async function ranger(
  creations: string,
  dossier: string,
  choisis: FichierChoisi[],
  renommerFichier: Renommer | undefined,
  siRienRemis: () => Promise<void>,
  messageRienRemis: string,
): Promise<FichierProjet[]> {
  const pris = new Map<string, Set<string>>();
  const deplacements: Deplacement[] = [];
  const fichiers: FichierProjet[] = [];
  for (const fichier of choisis) {
    const noms = pris.get(fichier.destination) ?? (await nomsExistants(join(dossier, fichier.destination)));
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
      await siRienRemis();
      throw new ErreurHttp(500, `${erreur.message}\n${messageRienRemis}`);
    }
    const liste = erreur.nonRemis.map((element) => `- ${element.cible}`).join("\n");
    throw new ErreurHttp(
      500,
      `${erreur.message}\nCes fichiers n'ont pas pu être remis dans l'inbox et se trouvent dans le projet :\n${liste}`,
    );
  }
  return fichiers;
}

async function projetExiste(creations: string, id: string): Promise<boolean> {
  for (const chaine of CHAINES) {
    if (await existe(cheminSur(creations, `${DOSSIERS_CHAINES[chaine]}/${id}`))) return true;
  }
  return false;
}

function identifiant(saisie: Pick<SaisieProjet, "datePublicationPrevue" | "titre">): string {
  return `${saisie.datePublicationPrevue}_${slug(saisie.titre.fr)}`;
}

export async function creerProjet(
  creations: string,
  saisieBrute: SaisieProjet,
  renommerFichier?: Renommer,
  maintenant = new Date(),
): Promise<ReponseCreationProjet> {
  const saisie = await verifierSaisie(creations, saisieBrute);
  const id = identifiant(saisie);
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

  const fichiers = await ranger(
    creations,
    dossier,
    saisie.fichiers,
    renommerFichier,
    () => rm(dossier, { recursive: true, force: true }),
    "Rien n'a été créé : tous les fichiers sont restés dans l'inbox.",
  );

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
    futurRoman: saisie.futurRoman,
  };
  await ecrireJsonAtomique(join(dossier, METADATA), metadata);

  const avertissements = await mettreAJourReferences(creations, null, id, undefined, metadata);
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

function ecrireMetadata(creations: string, projet: Projet): Promise<void> {
  return ecrireJsonAtomique(join(cheminSur(creations, projet.chemin), METADATA), projet.metadata);
}

export async function modifierProjet(creations: string, id: string, modification: ModificationProjet): Promise<ReponseModificationProjet> {
  const actuel = await lireProjet(creations, id);
  const ancien = actuel.metadata;
  const saisie = await verifierSaisie(creations, { ...modification, chaine: ancien.chaine, fichiers: [] });
  const nouvelId = identifiant(saisie);
  let projet: Projet = actuel;

  if (nouvelId !== id) {
    if (await projetExiste(creations, nouvelId)) {
      throw new ErreurHttp(409, `Un projet existe déjà sous le nom ${nouvelId}.`);
    }
    const chemin = `${DOSSIERS_CHAINES[ancien.chaine]}/${nouvelId}`;
    try {
      await renommer(cheminSur(creations, actuel.chemin), cheminSur(creations, chemin));
    } catch (erreur) {
      const code = codeErreur(erreur);
      if (code === "EPERM" || code === "EBUSY" || code === "EACCES") {
        throw new ErreurHttp(409, "Impossible de renommer le dossier : un de ses fichiers est ouvert dans un autre programme. Ferme-le puis recommence.");
      }
      throw erreur;
    }
    projet = { ...actuel, id: nouvelId, chemin };
  }

  const dossier = cheminSur(creations, projet.chemin);
  for (const sousDossier of sousDossiers(saisie)) {
    await mkdir(join(dossier, sousDossier), { recursive: true });
  }

  const preuve = ancien.autorisation?.preuve ?? null;
  const metadata: MetadataProjet = {
    ...ancien,
    categorie: saisie.categorie,
    titre: saisie.titre,
    description: modification.description,
    auteur: saisie.auteur,
    autorisation: saisie.autorisation === null ? null : { ...saisie.autorisation, preuve },
    artistes: saisie.artistes,
    assetsBibliotheque: saisie.assetsBibliotheque,
    langues: saisie.anglais ? ["fr", "en"] : ["fr"],
    sorties: saisie.sorties,
    nombreFormatsCourts: saisie.nombreFormatsCourts,
    consignes: saisie.consignes,
    fichiers: ancien.fichiers.map((fichier) => ({ ...fichier, note: modification.notes[fichier.chemin] ?? fichier.note })),
    datePublicationPrevue: saisie.datePublicationPrevue,
    futurRoman: saisie.futurRoman,
  };
  projet = { ...projet, metadata };
  await ecrireMetadata(creations, projet);

  const avertissements = await mettreAJourReferences(creations, id, nouvelId, ancien, metadata);
  return { projet, avertissements };
}

export async function ajouterFichiersProjet(
  creations: string,
  id: string,
  choisis: FichierChoisi[],
  renommerFichier?: Renommer,
): Promise<Projet> {
  const projet = await lireProjet(creations, id);
  const { metadata } = projet;
  const destinations = destinationsPossibles(metadata.chaine, metadata.langues.includes("en"), metadata.artistes);
  await verifierFichiersInbox(creations, choisis, destinations);
  const fichiers = await ranger(
    creations,
    cheminSur(creations, projet.chemin),
    choisis,
    renommerFichier,
    async () => undefined,
    "Aucun fichier n'a été ajouté : ils sont tous restés dans l'inbox.",
  );
  const misAJour: Projet = { ...projet, metadata: { ...metadata, fichiers: [...metadata.fichiers, ...fichiers] } };
  await ecrireMetadata(creations, misAJour);
  return misAJour;
}

export async function supprimerProjet(creations: string, id: string): Promise<{ corbeille: string; avertissements: string[] }> {
  const projet = await lireProjet(creations, id);
  let corbeille: string;
  try {
    corbeille = await mettreALaCorbeille(creations, projet.chemin, "projets");
  } catch (erreur) {
    const code = codeErreur(erreur);
    if (code === "EPERM" || code === "EBUSY" || code === "EACCES") {
      throw new ErreurHttp(409, "Impossible de déplacer le projet : un de ses fichiers est ouvert dans un autre programme. Ferme-le puis recommence.");
    }
    throw erreur;
  }
  const avertissements = await mettreAJourReferences(creations, id, null, projet.metadata);
  return { corbeille, avertissements };
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
  const misAJour: Projet = {
    ...projet,
    metadata: { ...projet.metadata, autorisation: { ...projet.metadata.autorisation, preuve: `autorisation/${nom}` } },
  };
  await ecrireMetadata(creations, misAJour);
  return misAJour;
}
