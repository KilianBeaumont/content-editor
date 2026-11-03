import { z } from "zod";
import type { Categorie } from "./categories.ts";

export interface ProfilInspiration {
  duree: number | null;
  largeur: number | null;
  hauteur: number | null;
  imagesParSeconde: number | null;
  coupes: number;
  coupesParMinute: number | null;
  dureeMoyennePlan: number | null;
  dureeMedianePlan: number | null;
  plusLongPlan: number | null;
  premiereCoupe: number | null;
  mots: number;
  motsParMinute: number | null;
  premierMot: number | null;
  partParole: number | null;
  plusLongSilence: number | null;
}

export type EtatAnalyse = "absente" | "a-jour" | "perimee";

export interface AnalyseInspiration {
  resume: string;
  techniques: string[];
  analyse: string;
}

export interface VideoInspiration {
  nom: string;
  chemin: string;
  taille: number;
  etat: EtatAnalyse;
  dossierAnalyse: string;
  profil: ProfilInspiration | null;
  claude: AnalyseInspiration | null;
  planches: string[];
}

export interface GuideCategorie {
  categorie: Categorie;
  style: string;
  hooks: string;
  videos: VideoInspiration[];
}

export interface ResumeGuide {
  categorie: Categorie;
  videos: number;
  analysees: number;
}

export interface ReponseGuides {
  guides: ResumeGuide[];
}

export interface SaisieGuide {
  style: string;
  hooks: string;
}

export const EXTENSIONS_INSPIRATION = [".mp4", ".mov", ".webm", ".mkv", ".m4v"] as const;

export const schemaSaisieGuide = z.object({
  style: z.string().max(100_000),
  hooks: z.string().max(100_000),
}) satisfies z.ZodType<SaisieGuide>;

export const schemaAnalyseInspiration = z.object({
  resume: z
    .string()
    .max(1500)
    .describe("En quelques phrases : ce qui fait l'efficacité de cette vidéo et ce qu'on peut en reprendre (accroche, rythme, montage, son, textes)."),
  techniques: z
    .array(z.string().max(200))
    .max(20)
    .describe("Les techniques de montage repérées, une par ligne et concrètes : « zoom brusque sur un détail à 0:03 pour relancer », « boucle : la dernière phrase raccorde à la première »…"),
  analyse: z
    .string()
    .max(20_000)
    .describe("L'analyse complète en Markdown, avec les sections Accroche, Structure, Rythme, Visuels et montage, Textes à l'écran, Son, Ce qu'on retient."),
}) satisfies z.ZodType<AnalyseInspiration>;
