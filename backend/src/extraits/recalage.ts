import type { MotTranscrit } from "@editeur/shared";

const AVANT = 0.12;
const APRES = 0.18;
const RECHERCHE = 0.6;
const ESPACE = 0.05;

const arrondi = (valeur: number) => Math.round(valeur * 100) / 100;

export interface Bornes {
  debut: number;
  fin: number;
}

export function recalerBornes(bornes: Bornes, mots: MotTranscrit[], dureeSource: number | null): Bornes {
  const tries = [...mots].sort((a, b) => a.debut - b.debut);
  if (tries.length === 0) return bornes;

  const chevauchantDebut = tries.find((mot) => mot.debut < bornes.debut && mot.fin > bornes.debut);
  const suivant = tries.find((mot) => mot.debut >= bornes.debut && mot.debut - bornes.debut <= RECHERCHE);
  const premier = chevauchantDebut ?? suivant;
  const precedent = premier === undefined ? undefined : tries.filter((mot) => mot.fin <= premier.debut).at(-1);
  const debut = premier === undefined ? bornes.debut : Math.max(premier.debut - AVANT, precedent === undefined ? 0 : precedent.fin + ESPACE, 0);

  const chevauchantFin = tries.find((mot) => mot.debut < bornes.fin && mot.fin > bornes.fin);
  const dernierAvant = tries.filter((mot) => mot.fin <= bornes.fin && bornes.fin - mot.fin <= RECHERCHE).at(-1);
  const dernier = chevauchantFin ?? dernierAvant;
  const prochain = dernier === undefined ? undefined : tries.find((mot) => mot.debut >= dernier.fin);
  let fin = dernier === undefined ? bornes.fin : Math.min(dernier.fin + APRES, prochain === undefined ? Number.POSITIVE_INFINITY : prochain.debut - ESPACE);
  if (dureeSource !== null) fin = Math.min(fin, dureeSource);
  if (fin <= debut) return bornes;
  return { debut: arrondi(debut), fin: arrondi(fin) };
}
