import type { BinairesMachine } from "./config.ts";

export type NomBinaire = keyof BinairesMachine;

export interface DiagnosticBinaire {
  nom: NomBinaire;
  commande: string;
  trouve: boolean;
  version: string | null;
  erreur: string | null;
}

export interface ReponseDiagnostic {
  binaires: DiagnosticBinaire[];
}

export interface FenetreLimite {
  nom: string;
  utilisation: number;
  statut: string;
  reinitialisation: string;
}

export interface LimitesClaude {
  statut: string;
  fenetres: FenetreLimite[];
}

export interface ResultatTestClaude {
  ok: boolean;
  abonnement: boolean | null;
  sourceCle: string | null;
  modele: string | null;
  reponse: string | null;
  limites: LimitesClaude | null;
  limiteAtteinte: boolean;
  dureeMs: number;
  erreur: string | null;
}
