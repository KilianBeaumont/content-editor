export const TYPES_TACHE = ["telechargement-modele", "essai-transcription", "transcription", "preparation-rush", "proposition-plan"] as const;
export type TypeTache = (typeof TYPES_TACHE)[number];

export const ETATS_TACHE = ["attente", "en-cours", "terminee", "echouee", "annulee", "interrompue"] as const;
export type EtatTache = (typeof ETATS_TACHE)[number];

export const LIBELLES_ETATS_TACHE: Record<EtatTache, string> = {
  attente: "En attente",
  "en-cours": "En cours",
  terminee: "Terminée",
  echouee: "Échouée",
  annulee: "Annulée",
  interrompue: "Interrompue",
};

export type ParametresTache = Record<string, string | number | boolean | null>;

export interface Tache {
  id: string;
  type: TypeTache;
  libelle: string;
  projet: string | null;
  parametres: ParametresTache;
  etat: EtatTache;
  progression: number | null;
  etape: string | null;
  resteSecondes: number | null;
  creeLe: string;
  demarreLe: string | null;
  termineLe: string | null;
  resultat: string | null;
  erreur: string | null;
}

export interface ReponseTaches {
  taches: Tache[];
}

export function tacheActive(tache: Tache): boolean {
  return tache.etat === "attente" || tache.etat === "en-cours";
}
