import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Readable } from "node:stream";
import {
  EXTENSIONS_PREUVE,
  FICHE_ARTISTE_VIDE,
  schemaFicheArtiste,
  type AccordArtiste,
  type Artiste,
  type FicheArtiste,
  type ReponseListeArtistes,
  type SaisieArtiste,
  type StatutAccord,
} from "@editeur/shared";
import { ErreurHttp } from "../erreurs.ts";
import {
  creerFiche,
  dossierFiche,
  ecrireFiche,
  ficheALaCorbeille,
  lireFiche,
  listerFiches,
  trierParNom,
  type DossierFiches,
} from "../fiches.ts";
import { cheminSur, existe } from "../fichiers.ts";
import { enregistrerFlux, nomLibre, verifierExtension } from "../televersement.ts";

const ARTISTES: DossierFiches<FicheArtiste> = {
  racine: "artistes",
  libelle: "Artiste",
  schema: schemaFicheArtiste,
  vide: FICHE_ARTISTE_VIDE,
};
const DOSSIER_ACCORD = "accord";

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

async function versArtiste(id: string, dossier: string, fiche: FicheArtiste): Promise<Artiste> {
  return { id, fiche, statut: await statutAccord(dossier, fiche.accord) };
}

export async function lireArtiste(creations: string, id: string): Promise<Artiste> {
  const { dossier, fiche } = await lireFiche(creations, ARTISTES, id);
  return versArtiste(id, dossier, fiche);
}

export async function listerArtistes(creations: string): Promise<ReponseListeArtistes> {
  const { fiches, illisibles } = await listerFiches(creations, ARTISTES);
  const artistes = await Promise.all(fiches.map(({ id, dossier, fiche }) => versArtiste(id, dossier, fiche)));
  return { artistes: trierParNom(artistes), illisibles };
}

export async function creerArtiste(creations: string, saisie: SaisieArtiste): Promise<Artiste> {
  const fiche: FicheArtiste = { ...saisie, accord: { ...saisie.accord, preuve: null }, videos: [] };
  const id = await creerFiche(creations, ARTISTES, saisie.nom, fiche, [DOSSIER_ACCORD]);
  return lireArtiste(creations, id);
}

export async function modifierArtiste(creations: string, id: string, saisie: SaisieArtiste): Promise<Artiste> {
  const actuel = await lireArtiste(creations, id);
  await ecrireFiche(creations, ARTISTES, id, {
    ...saisie,
    accord: { ...saisie.accord, preuve: actuel.fiche.accord.preuve },
    videos: actuel.fiche.videos,
  });
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
  return ficheALaCorbeille(creations, ARTISTES, id);
}

export async function enregistrerPreuve(
  creations: string,
  id: string,
  nomFichier: string,
  flux: Readable,
): Promise<Artiste> {
  verifierExtension(nomFichier, EXTENSIONS_PREUVE);
  const actuel = await lireArtiste(creations, id);
  const dossierAccord = join(dossierFiche(creations, ARTISTES, id), DOSSIER_ACCORD);
  await mkdir(dossierAccord, { recursive: true });
  const nom = await nomLibre(dossierAccord, nomFichier, "preuve");
  await enregistrerFlux(flux, dossierAccord, nom);

  await ecrireFiche(creations, ARTISTES, id, {
    ...actuel.fiche,
    accord: { ...actuel.fiche.accord, preuve: `${DOSSIER_ACCORD}/${nom}` },
  });
  return lireArtiste(creations, id);
}
