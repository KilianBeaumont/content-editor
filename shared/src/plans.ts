import { z } from "zod";

export const ORIGINES_MUSIQUE = ["projet", "bibliotheque"] as const;
export type OrigineMusique = (typeof ORIGINES_MUSIQUE)[number];

export const STATUTS_PLAN = ["propose", "valide"] as const;
export type StatutPlan = (typeof STATUTS_PLAN)[number];

export interface SegmentPlan {
  id: string;
  source: string;
  debut: number;
  fin: number;
  role: string;
  citation: string;
  raison: string;
}

export interface MusiquePlan {
  origine: OrigineMusique;
  reference: string;
  debut: number;
  fin: number | null;
  volumeDb: number;
  baisseSousVoix: boolean;
  raison: string;
}

export interface ReponseRetour {
  commentaire: number;
  changement: string;
}

export interface PropositionPlan {
  resume: string;
  hook: { segment: string; explication: string };
  segments: SegmentPlan[];
  musiques: MusiquePlan[];
  pointsAVerifier: string[];
  reponsesRetours: ReponseRetour[];
}

export interface PlanMontage extends PropositionPlan {
  version: string;
  statut: StatutPlan;
  creeLe: string;
  modifieLe: string | null;
}

export interface ProblemePlan {
  niveau: "erreur" | "avertissement";
  message: string;
  segment: string | null;
}

export interface VersionPlan {
  version: string;
  plan: PlanMontage | null;
  erreur: string | null;
  problemes: ProblemePlan[];
  apercu: boolean;
}

export interface ReponsePlans {
  versions: VersionPlan[];
}

export interface SaisiePropositionPlan {
  consigne: string;
}

export const MOTIF_VERSION = /^v[1-9]\d*$/;

export function cheminPlan(version: string): string {
  return `versions/${version}/plan.json`;
}

export function numeroVersion(version: string): number {
  return Number(version.slice(1));
}

export function dureePlan(plan: Pick<PropositionPlan, "segments">): number {
  return plan.segments.reduce((total, segment) => total + Math.max(0, segment.fin - segment.debut), 0);
}

const texte = (max: number) => z.string().max(max);

export const schemaPropositionPlan = z.object({
  resume: texte(3000).describe("La stratégie de montage en quelques phrases, lisible par l'utilisateur."),
  hook: z.object({
    segment: z.string().describe("Identifiant du segment qui sert d'accroche (en général le premier)."),
    explication: texte(1000).describe("Pourquoi cette accroche retient le spectateur dès les premières secondes."),
  }),
  segments: z
    .array(
      z.object({
        id: z.string().regex(/^s\d+$/).describe("Identifiant unique : s1, s2, s3…"),
        source: z.string().min(1).describe("Chemin du rush, relatif au dossier du projet, par exemple rushes/clip.mp4."),
        debut: z.number().min(0).describe("Début dans le rush, en secondes."),
        fin: z.number().min(0).describe("Fin dans le rush, en secondes."),
        role: texte(60).describe("Rôle dans la structure : accroche, mise en place, moment fort, transition, conclusion…"),
        citation: texte(1000).describe("Ce qui est dit pendant le segment, tiré de la transcription (vide s'il n'y a pas de parole)."),
        raison: texte(1000).describe("Pourquoi ce passage est gardé à cet endroit."),
      }),
    )
    .describe("Les segments dans l'ordre de la vidéo finale."),
  musiques: z.array(
    z.object({
      origine: z.enum(ORIGINES_MUSIQUE).describe("projet : fichier du dossier du projet ; bibliotheque : asset de la bibliothèque."),
      reference: z.string().min(1).describe("Chemin relatif au projet (origine projet) ou identifiant de l'asset (origine bibliotheque)."),
      debut: z.number().min(0).describe("Début sur la timeline de la vidéo finale, en secondes."),
      fin: z.number().min(0).nullable().describe("Fin sur la timeline de la vidéo finale, ou null jusqu'à la fin."),
      volumeDb: z.number().min(-60).max(0).describe("Volume de la musique en dB (0 = volume d'origine)."),
      baisseSousVoix: z.boolean().describe("Baisser automatiquement la musique quand quelqu'un parle."),
      raison: texte(500),
    }),
  ),
  pointsAVerifier: z
    .array(texte(500))
    .describe("Doutes ou informations manquantes à signaler à l'utilisateur (guide de style vide, passage peu clair…)."),
  reponsesRetours: z
    .array(
      z.object({
        commentaire: z.number().int().min(0).describe("Position du commentaire dans retours.json, à partir de 0."),
        changement: texte(1000).describe("Ce qui a été changé pour en tenir compte."),
      }),
    )
    .describe("Vide pour une première proposition."),
}) satisfies z.ZodType<PropositionPlan>;

export const schemaPlanMontage = schemaPropositionPlan.extend({
  version: z.string().regex(MOTIF_VERSION),
  statut: z.enum(STATUTS_PLAN),
  creeLe: z.string(),
  modifieLe: z.string().nullable(),
}) satisfies z.ZodType<PlanMontage>;

export const schemaSaisiePropositionPlan = z.object({
  consigne: z.string().trim().max(4000),
}) satisfies z.ZodType<SaisiePropositionPlan>;
