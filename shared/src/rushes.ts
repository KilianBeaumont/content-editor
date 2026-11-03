import { z } from "zod";

export interface Intervalle {
  debut: number;
  fin: number;
}

export interface PicSonore {
  temps: number;
  niveau: number;
}

export interface AnalyseAudio {
  pas: number;
  niveaux: number[];
  seuilSilence: number;
  silences: Intervalle[];
  pics: PicSonore[];
}

export interface PlanchesRush {
  intervalle: number;
  colonnes: number;
  lignes: number;
  horodatees: boolean;
  fichiers: string[];
}

export interface PreparationRush {
  version: 1;
  source: string;
  tailleSource: number;
  modifieSource: string;
  creeLe: string;
  duree: number | null;
  hdr: boolean;
  proxy: string | null;
  planches: PlanchesRush | null;
  audio: string | null;
}

export interface Repere {
  id: string;
  source: string;
  temps: number;
  note: string;
  creeLe: string;
}

export interface ReponseReperes {
  reperes: Repere[];
}

export interface SaisieRepere {
  source: string;
  temps: number;
  note: string;
}

export interface ReponseLancementPreparations {
  ajoutees: number;
}

export function cheminPreparation(chemin: string): string {
  return `travail/preparation/${chemin}.json`;
}

export function cheminProxy(chemin: string): string {
  return `travail/proxy/${chemin}.mp4`;
}

export function cheminAnalyseAudio(chemin: string): string {
  return `travail/audio/${chemin}.json`;
}

export function dossierPlanches(chemin: string): string {
  return `travail/planches/${chemin}`;
}

export const schemaSaisieRepere = z.object({
  source: z.string().min(1),
  temps: z.number().min(0),
  note: z.string().trim().max(500),
}) satisfies z.ZodType<SaisieRepere>;
