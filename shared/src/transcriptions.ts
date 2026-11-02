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
