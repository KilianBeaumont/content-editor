import type { Chaine, Sortie } from "./projets.ts";

export interface ExportSortie {
  sortie: Sortie;
  fichier: string;
  version: string;
  creeLe: string;
  largeur: number;
  hauteur: number;
  imagesParSeconde: number;
  encodeur: string;
  dureePlan: number;
  duree: number | null;
  volumeLufs: number | null;
  creteDb: number | null;
  taille: number;
  dureeRenduSecondes: number;
  controles: string[];
  publieLe: string | null;
}

export interface ReponseExports {
  exports: ExportSortie[];
  sortiesVideo: Sortie[];
}

export interface SaisieExport {
  sortie: Sortie;
}

export interface SaisiePublication {
  publie: boolean;
}

export function cheminFicheExport(sortie: Sortie): string {
  return `travail/exports/${sortie}.json`;
}

export interface ReponseDescription {
  texte: string;
}

export interface ElementExport {
  projet: { id: string; chemin: string; titre: string; chaine: Chaine; datePublicationPrevue: string; versionValidee: string | null };
  fiche: ExportSortie;
}

export interface ReponseExportsGlobaux {
  elements: ElementExport[];
}
