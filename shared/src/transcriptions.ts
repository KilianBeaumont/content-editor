export interface EtatModeleWhisper {
  nom: string;
  chemin: string;
  present: boolean;
  taille: number | null;
}

export interface MotTranscrit {
  mot: string;
  debut: number;
  fin: number;
  probabilite: number;
}

export interface SegmentTranscrit {
  debut: number;
  fin: number;
  texte: string;
  mots: MotTranscrit[];
}

export interface Transcription {
  version: 1;
  source: string;
  langue: string;
  modele: string;
  acceleration: string | null;
  duree: number | null;
  tailleSource: number;
  modifieSource: string;
  creeLe: string;
  segments: SegmentTranscrit[];
}

export type EtatTranscription = "absente" | "a-jour" | "perimee";

export interface FichierTranscriptible {
  chemin: string;
  langue: string;
  etat: EtatTranscription;
  duree: number | null;
  nombreMots: number | null;
}

export interface ReponseTranscriptions {
  fichiers: FichierTranscriptible[];
}

export interface ReponseLancementTranscriptions {
  ajoutees: number;
}

export function langueDuFichier(chemin: string): string {
  return chemin.startsWith("voix/en/") ? "en" : "fr";
}

export function cheminTranscription(chemin: string): string {
  return `travail/transcriptions/${chemin}.json`;
}
