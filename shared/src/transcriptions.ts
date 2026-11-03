export interface EtatModeleWhisper {
  nom: string;
  chemin: string;
  present: boolean;
  taille: number | null;
  vad: { chemin: string; present: boolean };
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
  corrige: boolean;
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
  vad: boolean;
  vocabulaire: string;
  corrigee: boolean;
  segments: SegmentTranscrit[];
}

export type EtatTranscription = "absente" | "a-jour" | "perimee";

export interface FichierTranscriptible {
  chemin: string;
  langue: string;
  etat: EtatTranscription;
  duree: number | null;
  nombreMots: number | null;
  corrigee: boolean;
  preparation: EtatTranscription;
  proxy: string | null;
  planches: string[];
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

export interface CorrectionSegment {
  debut: number;
  texte: string | null;
}

export interface SaisieCorrections {
  corrections: CorrectionSegment[];
}

function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function repetitionsSuspectes(segments: SegmentTranscrit[], minimum = 3): number[] {
  const suspects: number[] = [];
  let debutSerie = 0;
  for (let index = 1; index <= segments.length; index++) {
    const precedent = segments[index - 1];
    const courant = segments[index];
    const memeTexte = courant !== undefined && precedent !== undefined && normaliser(courant.texte) === normaliser(precedent.texte);
    if (memeTexte && normaliser(courant.texte) !== "") continue;
    if (index - debutSerie >= minimum) {
      for (let doublon = debutSerie + 1; doublon < index; doublon++) suspects.push(doublon);
    }
    debutSerie = index;
  }
  return suspects;
}

export function repartirMots(texte: string, debut: number, fin: number): MotTranscrit[] {
  const mots = texte.split(/\s+/).filter((mot) => mot !== "");
  const total = mots.reduce((somme, mot) => somme + mot.length, 0);
  let position = debut;
  return mots.map((mot) => {
    const duree = total === 0 ? 0 : ((fin - debut) * mot.length) / total;
    const resultat = { mot, debut: position, fin: position + duree, probabilite: 1 };
    position += duree;
    return resultat;
  });
}
