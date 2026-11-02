import { mkdir, readdir } from "node:fs/promises";
import { basename, extname } from "node:path";
import type { Readable } from "node:stream";
import {
  ASSET_PAR_DEFAUT,
  CHAINES_BIBLIOTHEQUE,
  schemaAssetBibliotheque,
  slug,
  TYPES,
  TYPES_ASSET,
  type Artiste,
  type AssetBibliotheque,
  type ChaineBibliotheque,
  type ElementBibliotheque,
  type EntreeInvalide,
  type NouvelAsset,
  type ReponseBibliotheque,
  type ReponseTeleversementAsset,
  type SaisieAsset,
  type StatutAsset,
  type TypeAsset,
} from "@editeur/shared";
import { z } from "zod";
import { lireArtiste } from "../artistes/artistes.ts";
import { mettreALaCorbeille } from "../corbeille.ts";
import { codeErreur, ErreurHttp } from "../erreurs.ts";
import {
  CheminInterditError,
  cheminSur,
  ecrireJsonAtomique,
  estObjet,
  existe,
  FichierInvalideError,
  fusionnerAvecDefauts,
  lireTexte,
} from "../fichiers.ts";
import { enregistrerFlux, nomLibre, verifierExtension } from "../televersement.ts";

const RACINE = "bibliotheque";
const CATALOGUE = `${RACINE}/catalogue.json`;

interface Catalogue {
  fichier: Record<string, unknown>;
  entrees: unknown[];
}

interface CatalogueAnalyse {
  assets: { asset: AssetBibliotheque; position: number }[];
  invalides: EntreeInvalide[];
}

function cheminDansBibliotheque(creations: string, chemin: string): string {
  return cheminSur(cheminSur(creations, RACINE), chemin);
}

let file: Promise<unknown> = Promise.resolve();

function enSerie<T>(operation: () => Promise<T>): Promise<T> {
  const resultat = file.then(operation, operation);
  file = resultat.catch(() => undefined);
  return resultat;
}

async function lireCatalogue(creations: string): Promise<Catalogue> {
  let contenu: unknown;
  try {
    contenu = JSON.parse(await lireTexte(cheminSur(creations, CATALOGUE)));
  } catch (erreur) {
    if (codeErreur(erreur) === "ENOENT") {
      return { fichier: {}, entrees: [] };
    }
    if (erreur instanceof SyntaxError) {
      throw new FichierInvalideError(`catalogue.json n'est pas un JSON valide : ${erreur.message}`);
    }
    throw erreur;
  }
  if (!estObjet(contenu) || !Array.isArray(contenu.assets)) {
    throw new FichierInvalideError("catalogue.json doit contenir un objet avec une liste « assets ».");
  }
  return { fichier: contenu, entrees: contenu.assets };
}

function ecrireCatalogue(creations: string, catalogue: Catalogue): Promise<void> {
  return ecrireJsonAtomique(cheminSur(creations, CATALOGUE), { ...catalogue.fichier, assets: catalogue.entrees });
}

function analyser(entrees: unknown[]): CatalogueAnalyse {
  const analyse: CatalogueAnalyse = { assets: [], invalides: [] };
  const ids = new Set<string>();
  entrees.forEach((brut, position) => {
    const id = estObjet(brut) && typeof brut.id === "string" ? brut.id : null;
    const resultat = schemaAssetBibliotheque.safeParse(fusionnerAvecDefauts(ASSET_PAR_DEFAUT, brut));
    if (!resultat.success) {
      analyse.invalides.push({ position, id, erreur: z.prettifyError(resultat.error) });
    } else if (ids.has(resultat.data.id)) {
      analyse.invalides.push({ position, id, erreur: "Identifiant déjà utilisé par une autre entrée du catalogue." });
    } else {
      ids.add(resultat.data.id);
      analyse.assets.push({ asset: resultat.data, position });
    }
  });
  return analyse;
}

async function statutAsset(
  creations: string,
  asset: AssetBibliotheque,
  artistes: Map<string, Promise<Artiste | string>>,
): Promise<StatutAsset> {
  const problemes: string[] = [];
  try {
    if (!(await existe(cheminDansBibliotheque(creations, asset.chemin)))) {
      problemes.push(`Fichier introuvable : ${RACINE}/${asset.chemin}`);
    }
  } catch (erreur) {
    if (!(erreur instanceof CheminInterditError)) throw erreur;
    problemes.push(erreur.message);
  }

  if (asset.source === "artiste") {
    if (asset.artiste === null) {
      problemes.push("Artiste non précisé.");
    } else {
      const id = asset.artiste;
      if (!artistes.has(id)) {
        artistes.set(
          id,
          lireArtiste(creations, id).catch((erreur: unknown) =>
            erreur instanceof ErreurHttp && erreur.statut === 404
              ? `Artiste inconnu : ${id}`
              : `Fiche de l'artiste ${id} illisible.`,
          ),
        );
      }
      const artiste = await artistes.get(id);
      if (typeof artiste === "string") {
        problemes.push(artiste);
      } else if (artiste !== undefined) {
        if (!artiste.statut.valide) {
          problemes.push(`Accord incomplet pour ${artiste.fiche.nom}.`);
        }
        if (!artiste.fiche.accord.reutilisationAutorisee) {
          problemes.push(`${artiste.fiche.nom} n'autorise pas la réutilisation de ses visuels.`);
        }
      }
    }
  }
  return { valide: problemes.length === 0, problemes };
}

async function nonCatalogues(creations: string, catalogues: Set<string>): Promise<string[]> {
  const liste: string[] = [];
  for (const chaine of CHAINES_BIBLIOTHEQUE) {
    for (const type of TYPES_ASSET) {
      const dossier = `${chaine}/${TYPES[type].dossier}`;
      let entrees: string[];
      try {
        entrees = await readdir(cheminSur(creations, `${RACINE}/${dossier}`));
      } catch (erreur) {
        if (codeErreur(erreur) === "ENOENT") continue;
        throw erreur;
      }
      for (const entree of entrees.sort()) {
        const chemin = `${dossier}/${entree}`;
        if (!entree.startsWith(".") && !catalogues.has(chemin)) {
          liste.push(chemin);
        }
      }
    }
  }
  return liste;
}

export async function listerBibliotheque(creations: string): Promise<ReponseBibliotheque> {
  const { entrees } = await lireCatalogue(creations);
  const { assets, invalides } = analyser(entrees);
  const artistes = new Map<string, Promise<Artiste | string>>();
  const elements = await Promise.all(
    assets.map(async ({ asset }) => ({ asset, statut: await statutAsset(creations, asset, artistes) })),
  );
  elements.sort((a, b) => a.asset.chemin.localeCompare(b.asset.chemin, "fr"));
  const catalogues = new Set(assets.map(({ asset }) => asset.chemin));
  return { elements, invalides, nonCatalogues: await nonCatalogues(creations, catalogues) };
}

function trouver(analyse: CatalogueAnalyse, id: string): { asset: AssetBibliotheque; position: number } {
  const trouve = analyse.assets.find(({ asset }) => asset.id === id);
  if (trouve === undefined) {
    throw new ErreurHttp(404, `Asset introuvable : ${id}`);
  }
  return trouve;
}

export async function lireAsset(creations: string, id: string): Promise<ElementBibliotheque> {
  const { asset } = trouver(analyser((await lireCatalogue(creations)).entrees), id);
  return { asset, statut: await statutAsset(creations, asset, new Map()) };
}

function typeDuDossier(dossier: string): TypeAsset | undefined {
  return TYPES_ASSET.find((type) => TYPES[type].dossier === dossier);
}

function verifierEmplacement(chaine: string, type: string): { chaine: ChaineBibliotheque; type: TypeAsset } {
  const chaineValide = CHAINES_BIBLIOTHEQUE.find((element) => element === chaine);
  const typeValide = TYPES_ASSET.find((element) => element === type);
  if (chaineValide === undefined || typeValide === undefined) {
    throw new ErreurHttp(400, `Emplacement inconnu dans la bibliothèque : ${chaine} / ${type}`);
  }
  return { chaine: chaineValide, type: typeValide };
}

function normaliser(saisie: SaisieAsset, type: TypeAsset): SaisieAsset {
  if (saisie.source === "artiste" && saisie.artiste === null) {
    throw new ErreurHttp(400, "Choisis l'artiste qui a créé cet asset.");
  }
  const regleLangue = TYPES[type].langue;
  if (regleLangue === "obligatoire" && saisie.langue === null) {
    throw new ErreurHttp(400, "Précise la langue de cette voix.");
  }
  return {
    ...saisie,
    artiste: saisie.source === "artiste" ? saisie.artiste : null,
    langue: regleLangue === "sans" ? null : saisie.langue,
    etiquettes: [...new Set(saisie.etiquettes)],
  };
}

export async function televerserAsset(
  creations: string,
  chaine: string,
  type: string,
  nomFichier: string,
  flux: Readable,
): Promise<ReponseTeleversementAsset> {
  const emplacement = verifierEmplacement(chaine, type);
  verifierExtension(nomFichier, TYPES[emplacement.type].extensions);
  const relatif = `${emplacement.chaine}/${TYPES[emplacement.type].dossier}`;
  const dossier = cheminSur(creations, `${RACINE}/${relatif}`);
  await mkdir(dossier, { recursive: true });
  const nom = await nomLibre(dossier, nomFichier, "asset");
  await enregistrerFlux(flux, dossier, nom);
  return { chemin: `${relatif}/${nom}` };
}

export function ajouterAsset(creations: string, nouvel: NouvelAsset): Promise<ElementBibliotheque> {
  return enSerie(async () => {
    const morceaux = nouvel.chemin.split("/");
    const [chaine, dossier, nom] = morceaux;
    const chaineValide = CHAINES_BIBLIOTHEQUE.find((element) => element === chaine);
    const type = dossier ? typeDuDossier(dossier) : undefined;
    if (morceaux.length !== 3 || chaineValide === undefined || type === undefined || !nom || nom.startsWith(".")) {
      throw new ErreurHttp(400, `Emplacement inconnu dans la bibliothèque : ${nouvel.chemin}`);
    }
    if (!(await existe(cheminDansBibliotheque(creations, nouvel.chemin)))) {
      throw new ErreurHttp(400, `Fichier introuvable : ${RACINE}/${nouvel.chemin}`);
    }
    verifierExtension(nom, TYPES[type].extensions);

    const catalogue = await lireCatalogue(creations);
    const dejaPresent = catalogue.entrees.some((brut) => estObjet(brut) && brut.chemin === nouvel.chemin);
    if (dejaPresent) {
      throw new ErreurHttp(409, `Ce fichier est déjà dans le catalogue : ${nouvel.chemin}`);
    }
    const ids = new Set(catalogue.entrees.map((brut) => (estObjet(brut) ? brut.id : undefined)));
    const base = slug(basename(nom, extname(nom))) || "asset";
    let id = base;
    for (let numero = 2; ids.has(id); numero++) {
      id = `${base}-${numero}`;
    }

    const { chemin, ...saisie } = nouvel;
    const asset: AssetBibliotheque = { id, type, chaine: chaineValide, chemin, ...normaliser(saisie, type), utilisations: [] };
    await ecrireCatalogue(creations, { ...catalogue, entrees: [...catalogue.entrees, asset] });
    return { asset, statut: await statutAsset(creations, asset, new Map()) };
  });
}

export function modifierAsset(creations: string, id: string, saisie: SaisieAsset): Promise<ElementBibliotheque> {
  return enSerie(async () => {
    const catalogue = await lireCatalogue(creations);
    const { asset: actuel, position } = trouver(analyser(catalogue.entrees), id);
    const asset: AssetBibliotheque = { ...actuel, ...normaliser(saisie, actuel.type) };
    const entrees = catalogue.entrees.map((brut, index) => (index === position ? asset : brut));
    await ecrireCatalogue(creations, { ...catalogue, entrees });
    return { asset, statut: await statutAsset(creations, asset, new Map()) };
  });
}

export function supprimerAsset(creations: string, id: string): Promise<{ corbeille: string | null }> {
  return enSerie(async () => {
    const catalogue = await lireCatalogue(creations);
    const { asset, position } = trouver(analyser(catalogue.entrees), id);
    const nombre = asset.utilisations.length;
    if (nombre > 0) {
      throw new ErreurHttp(
        409,
        `Cet asset a servi dans ${nombre} ${nombre === 1 ? "vidéo" : "vidéos"} : il est conservé.`,
      );
    }
    const relatif = `${RACINE}/${asset.chemin}`;
    const corbeille = (await existe(cheminDansBibliotheque(creations, asset.chemin)))
      ? await mettreALaCorbeille(creations, relatif, RACINE)
      : null;
    await ecrireCatalogue(creations, { ...catalogue, entrees: catalogue.entrees.filter((_, index) => index !== position) });
    return { corbeille };
  });
}

export function ajouterUtilisations(creations: string, ids: string[], projet: string): Promise<void> {
  return enSerie(async () => {
    const catalogue = await lireCatalogue(creations);
    const { assets } = analyser(catalogue.entrees);
    const positions = new Map(assets.map(({ asset, position }) => [position, asset]));
    const entrees = catalogue.entrees.map((brut, position) => {
      const asset = positions.get(position);
      if (asset === undefined || !ids.includes(asset.id) || asset.utilisations.includes(projet)) return brut;
      return { ...asset, utilisations: [...asset.utilisations, projet] };
    });
    await ecrireCatalogue(creations, { ...catalogue, entrees });
  });
}
