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
  couleurs: CouleursExport;
  dureePlan: number;
  duree: number | null;
  volumeLufs: number | null;
  creteDb: number | null;
  taille: number;
  dureeRenduSecondes: number;
  controles: string[];
  publieLe: string | null;
}

export const COULEURS_EXPORT = ["sdr", "hdr"] as const;
export type CouleursExport = (typeof COULEURS_EXPORT)[number];

export const QUALITES_EXPORT = ["standard", "4k"] as const;
export type QualiteExport = (typeof QUALITES_EXPORT)[number];

export interface Dimensions {
  largeur: number;
  hauteur: number;
}

export interface OptionsQualite {
  sortie: Sortie;
  standard: Dimensions;
  uhd: Dimensions | null;
  rushes: Dimensions | null;
  hdr: boolean;
}

export interface ReponseExports {
  exports: ExportSortie[];
  sortiesVideo: Sortie[];
  qualites: OptionsQualite[];
}

export interface SaisieExport {
  sortie: Sortie;
  qualite: QualiteExport;
  couleurs: CouleursExport;
}

export function dimensionsQualite(standard: Dimensions, qualite: QualiteExport): Dimensions {
  return qualite === "4k" ? { largeur: standard.largeur * 2, hauteur: standard.hauteur * 2 } : standard;
}

export function qualite4kPossible(standard: Dimensions, rushes: Dimensions | null): boolean {
  return rushes !== null && Math.min(rushes.largeur, rushes.hauteur) >= 2 * Math.min(standard.largeur, standard.hauteur);
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
