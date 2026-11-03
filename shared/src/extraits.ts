import { z } from "zod";
import { schemaCadrage, type Cadrage } from "./plans.ts";

export const CRITERES_EXTRAIT = ["accroche", "autonomie", "emotion", "densite", "chute"] as const;
export type CritereExtrait = (typeof CRITERES_EXTRAIT)[number];

export const LIBELLES_CRITERES: Record<CritereExtrait, string> = {
  accroche: "Accroche",
  autonomie: "Compréhensible seul",
  emotion: "Émotion",
  densite: "Densité",
  chute: "Chute",
};

export interface PassageExtrait {
  source: string;
  debut: number;
  fin: number;
  citation: string;
  cadrage: Cadrage | null;
}

export interface CandidatExtrait {
  titre: string;
  accroche: string;
  justification: string;
  notes: Record<CritereExtrait, number>;
  passages: PassageExtrait[];
}

export interface PropositionExtraits {
  candidats: CandidatExtrait[];
}

export interface EcartRecalage {
  debut: number;
  fin: number;
}

export interface CandidatPropose extends CandidatExtrait {
  numero: number;
  noteGlobale: number;
  duree: number;
  recalages: EcartRecalage[];
  projet: string | null;
}

export interface PropositionsExtraits {
  version: string;
  creeLe: string;
  candidats: CandidatPropose[];
}

export interface ResumeEnfant {
  id: string;
  titre: string;
}

export interface ReponseExtraits {
  propositions: PropositionsExtraits | null;
  enfants: ResumeEnfant[];
  nombreDemande: number;
}

export interface SaisieCreationExtrait {
  numero: number;
  titre: string;
}

const note = z.number().min(0).max(10);

export const schemaPropositionExtraits = z.object({
  candidats: z
    .array(
      z.object({
        titre: z.string().max(120).describe("Titre court de l'extrait, pour l'utilisateur et la publication."),
        accroche: z.string().max(300).describe("La phrase ou l'image d'ouverture, celle qui retient dans la première seconde."),
        justification: z.string().max(1000).describe("Pourquoi cet extrait marche seul en format court : ce qu'il raconte, sa chute."),
        notes: z
          .object({
            accroche: note.describe("Force de l'accroche dans la première seconde, sur 10."),
            autonomie: note.describe("Compréhensible sans avoir vu la vidéo longue, sur 10."),
            emotion: note.describe("Intensité (drôle, surprenant, touchant, impressionnant), sur 10."),
            densite: note.describe("Valeur par seconde, sans temps mort, sur 10."),
            chute: note.describe("Qualité de la fin (révélation, punchline, boucle), sur 10."),
          })
          .describe("Notes sur 10 pour chaque critère."),
        passages: z
          .array(
            z.object({
              source: z.string().min(1).describe("Chemin du rush, relatif au dossier du projet."),
              debut: z.number().min(0).describe("Début dans le rush, en secondes."),
              fin: z.number().min(0).describe("Fin dans le rush, en secondes."),
              citation: z.string().max(1000).describe("Ce qui est dit pendant le passage."),
              cadrage: schemaCadrage,
            }),
          )
          .min(1)
          .describe("Les passages de l'extrait, dans l'ordre (souvent un seul, parfois deux ou trois resserrés)."),
      }),
    )
    .describe("Les extraits proposés, du plus fort au moins fort."),
}) satisfies z.ZodType<PropositionExtraits, unknown>;

export const schemaSaisieCreationExtrait = z.object({
  numero: z.number().int().min(1),
  titre: z.string().trim().min(1).max(150),
}) satisfies z.ZodType<SaisieCreationExtrait>;

export function noteGlobale(notes: Record<CritereExtrait, number>): number {
  return Math.round((CRITERES_EXTRAIT.reduce((total, critere) => total + notes[critere], 0) / CRITERES_EXTRAIT.length) * 10) / 10;
}
