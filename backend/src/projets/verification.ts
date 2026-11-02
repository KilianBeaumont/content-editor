import { readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  DEFINITIONS_SORTIES,
  LIBELLES_PLATEFORMES,
  PLATEFORMES_PAR_SORTIE,
  type Artiste,
  type ProblemeExport,
  type Projet,
  type Sortie,
  type VerificationExport,
} from "@editeur/shared";
import { lireArtiste } from "../artistes/artistes.ts";
import { lireAsset } from "../bibliotheque/bibliotheque.ts";
import { codeErreur, ErreurHttp } from "../erreurs.ts";
import { cheminSur, existe } from "../fichiers.ts";

async function preuvePresente(dossier: string, preuve: string | null): Promise<boolean> {
  if (preuve === null) return false;
  try {
    return await existe(cheminSur(dossier, preuve));
  } catch {
    return false;
  }
}

async function dossiersArtistes(dossier: string): Promise<string[]> {
  try {
    const entrees = await readdir(join(dossier, "assets"), { withFileTypes: true });
    const pleins: string[] = [];
    for (const entree of entrees) {
      if (!entree.isDirectory() || entree.name.startsWith(".")) continue;
      const contenu = await readdir(join(dossier, "assets", entree.name));
      if (contenu.some((nom) => !nom.startsWith("."))) pleins.push(entree.name);
    }
    return pleins;
  } catch (erreur) {
    if (codeErreur(erreur) === "ENOENT") return [];
    throw erreur;
  }
}

async function lireArtisteOuNull(creations: string, id: string): Promise<Artiste | null> {
  try {
    return await lireArtiste(creations, id);
  } catch (erreur) {
    if (erreur instanceof ErreurHttp && erreur.statut === 404) return null;
    throw erreur;
  }
}

export async function verifierExportable(creations: string, projet: Projet): Promise<VerificationExport> {
  const { metadata } = projet;
  const dossier = cheminSur(creations, projet.chemin);
  const problemes: ProblemeExport[] = [];
  const bloquer = (message: string, sorties: Sortie[] = []) => problemes.push({ niveau: "blocage", message, sorties });
  const avertir = (message: string, sorties: Sortie[] = []) => problemes.push({ niveau: "avertissement", message, sorties });
  const sortiesAnglaises = metadata.sorties.filter((sortie) => DEFINITIONS_SORTIES[sortie].anglais);

  const { auteur, autorisation } = metadata;
  if (auteur !== null && auteur.estUtilisateur && auteur.nom.trim() === "") {
    avertir("Signature manquante : la vidéo doit commencer par « Une histoire originale de … ».");
  }
  if (metadata.futurRoman) {
    const longues = metadata.sorties.filter((sortie) => sortie !== "formats-courts" && sortie !== "instagram");
    if (longues.length > 0) {
      avertir("Histoire destinée à devenir un roman : n'en publier que des extraits, jamais l'histoire entière.", longues);
    }
  }
  if (auteur !== null && !auteur.estUtilisateur) {
    const nom = auteur.nom || "l'auteur";
    if (autorisation === null || !autorisation.obtenue) {
      bloquer(`Autorisation de ${nom} non obtenue.`);
    } else {
      if (!(await preuvePresente(dossier, autorisation.preuve))) {
        bloquer(
          autorisation.preuve === null
            ? `Preuve de l'autorisation de ${nom} manquante.`
            : `Fichier de preuve introuvable : ${autorisation.preuve}`,
        );
      }
      if (!autorisation.lecture) bloquer(`${nom} n'a pas autorisé la lecture de son histoire.`);
      if (autorisation.date === null) avertir("Date de l'autorisation non renseignée.");
      if (sortiesAnglaises.length > 0 && !autorisation.traductionAnglaise) {
        bloquer(`${nom} n'a pas autorisé la traduction anglaise.`, sortiesAnglaises);
      }
      if (!autorisation.monetisation) avertir(`${nom} n'a pas accepté la monétisation : la vidéo ne doit pas être monétisée.`);
      for (const sortie of metadata.sorties) {
        const attendues = PLATEFORMES_PAR_SORTIE[sortie];
        const manquantes = attendues.filter((plateforme) => !autorisation.plateformes.includes(plateforme));
        const libelles = manquantes.map((plateforme) => LIBELLES_PLATEFORMES[plateforme]).join(", ");
        const libelleSortie = DEFINITIONS_SORTIES[sortie].libelle;
        if (manquantes.length === attendues.length) {
          bloquer(`${libelleSortie} : aucune plateforme autorisée par ${nom} (${libelles}).`, [sortie]);
        } else if (manquantes.length > 0) {
          avertir(`${libelleSortie} : publication non autorisée sur ${libelles}.`, [sortie]);
        }
      }
    }
  }

  const artistes = new Set([...metadata.artistes, ...(await dossiersArtistes(dossier))]);
  for (const id of artistes) {
    const artiste = await lireArtisteOuNull(creations, id);
    if (artiste === null) {
      bloquer(`assets/${id}/ : aucune fiche d'artiste à ce nom. Les sous-dossiers d'assets/ sont réservés aux visuels d'artistes.`);
      continue;
    }
    const { nom, accord } = artiste.fiche;
    if (!artiste.statut.valide) {
      bloquer(`Accord incomplet pour ${nom} : ${artiste.statut.problemes.join(" ")}`);
    }
    if (!accord.monetisation) avertir(`${nom} n'a pas accepté la monétisation : la vidéo ne doit pas être monétisée.`);
  }

  for (const id of metadata.assetsBibliotheque) {
    try {
      const { asset, statut } = await lireAsset(creations, id);
      for (const probleme of statut.problemes) {
        bloquer(`Asset ${asset.chemin.split("/").at(-1) ?? id} : ${probleme}`);
      }
    } catch (erreur) {
      if (!(erreur instanceof ErreurHttp && erreur.statut === 404)) throw erreur;
      bloquer(`Asset ${id} introuvable dans la bibliothèque.`);
    }
  }

  const blocageGeneral = problemes.some(({ niveau, sorties }) => niveau === "blocage" && sorties.length === 0);
  const sortiesBloquees = blocageGeneral
    ? metadata.sorties
    : metadata.sorties.filter((sortie) =>
        problemes.some(({ niveau, sorties }) => niveau === "blocage" && sorties.includes(sortie)),
      );
  return { exportable: !problemes.some(({ niveau }) => niveau === "blocage"), sortiesBloquees, problemes };
}
