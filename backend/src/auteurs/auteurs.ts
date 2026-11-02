import {
  FICHE_AUTEUR_VIDE,
  schemaFicheAuteur,
  type Auteur,
  type FicheAuteur,
  type ReponseListeAuteurs,
  type SaisieAuteur,
} from "@editeur/shared";
import { ErreurHttp } from "../erreurs.ts";
import {
  creerFiche,
  ecrireFiche,
  ficheALaCorbeille,
  lireFiche,
  listerFiches,
  trierParNom,
  type DossierFiches,
} from "../fiches.ts";

const AUTEURS: DossierFiches<FicheAuteur> = {
  racine: "auteurs",
  libelle: "Auteur",
  schema: schemaFicheAuteur,
  vide: FICHE_AUTEUR_VIDE,
};

export async function lireAuteur(creations: string, id: string): Promise<Auteur> {
  const { fiche } = await lireFiche(creations, AUTEURS, id);
  return { id, fiche };
}

export async function listerAuteurs(creations: string): Promise<ReponseListeAuteurs> {
  const { fiches, illisibles } = await listerFiches(creations, AUTEURS);
  return { auteurs: trierParNom(fiches.map(({ id, fiche }) => ({ id, fiche }))), illisibles };
}

export async function creerAuteur(creations: string, saisie: SaisieAuteur): Promise<Auteur> {
  const id = await creerFiche(creations, AUTEURS, saisie.nom, { ...saisie, recits: [] });
  return lireAuteur(creations, id);
}

export async function modifierAuteur(creations: string, id: string, saisie: SaisieAuteur): Promise<Auteur> {
  const actuel = await lireAuteur(creations, id);
  await ecrireFiche(creations, AUTEURS, id, { ...saisie, recits: actuel.fiche.recits });
  return lireAuteur(creations, id);
}

export async function supprimerAuteur(creations: string, id: string): Promise<string> {
  const actuel = await lireAuteur(creations, id);
  const nombre = actuel.fiche.recits.length;
  if (nombre > 0) {
    throw new ErreurHttp(
      409,
      `${actuel.fiche.nom} a ${nombre} ${nombre === 1 ? "récit" : "récits"} sur la chaîne : sa fiche est conservée.`,
    );
  }
  return ficheALaCorbeille(creations, AUTEURS, id);
}

export async function ajouterRecitAuteur(creations: string, id: string, projet: string): Promise<void> {
  const { fiche } = await lireAuteur(creations, id);
  if (!fiche.recits.includes(projet)) {
    await ecrireFiche(creations, AUTEURS, id, { ...fiche, recits: [...fiche.recits, projet] });
  }
}
