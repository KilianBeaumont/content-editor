import { z } from "zod";

export interface BinairesMachine {
  ffmpeg: string;
  ffprobe: string;
  claude: string;
  whisper: string;
}

export interface ConfigMachine {
  creations: string;
  modeles: string;
  binaires: BinairesMachine;
}

export const schemaConfigMachine = z.object({
  creations: z.string().trim().min(1),
  modeles: z.string().trim().min(1),
  binaires: z.object({
    ffmpeg: z.string().trim().min(1),
    ffprobe: z.string().trim().min(1),
    claude: z.string().trim().min(1),
    whisper: z.string().trim().min(1),
  }),
}) satisfies z.ZodType<ConfigMachine>;

export interface PreReglageVideo {
  largeur: number;
  hauteur: number;
  loudnessLufs: number;
}

export interface ReglagesSousTitres {
  police: string | null;
  taillePourcent: number;
  couleur: string;
  couleurAccent: string;
  contour: number;
  motsMax: number;
  positionPourcent: number;
  majuscules: boolean;
}

export interface Parametres {
  version: 1;
  exports: {
    youtube: PreReglageVideo;
    formatCourt: PreReglageVideo;
    apercu: { largeur: number };
    instagram: { largeur: number; hauteur: number };
    podcast: { debitKbps: number; loudnessLufs: number };
    pochettePodcast: { cote: number };
  };
  transcription: { modele: string; vocabulaire: string };
  claude: { modele: string | null };
  rendusSimultanes: number;
  sousTitres: ReglagesSousTitres;
}

const dimension = z.number().int().min(16).max(8192);
const loudness = z.number().min(-40).max(0);

const schemaPreReglageVideo = z.object({
  largeur: dimension,
  hauteur: dimension,
  loudnessLufs: loudness,
}) satisfies z.ZodType<PreReglageVideo>;

const couleur = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur au format #RRVVBB.");

export const schemaReglagesSousTitres = z.object({
  police: z.string().min(1).nullable(),
  taillePourcent: z.number().min(2).max(15),
  couleur,
  couleurAccent: couleur,
  contour: z.number().min(0).max(10),
  motsMax: z.number().int().min(1).max(8),
  positionPourcent: z.number().min(10).max(95),
  majuscules: z.boolean(),
}) satisfies z.ZodType<ReglagesSousTitres>;

export const schemaParametres = z.object({
  version: z.literal(1),
  exports: z.object({
    youtube: schemaPreReglageVideo,
    formatCourt: schemaPreReglageVideo,
    apercu: z.object({ largeur: dimension }),
    instagram: z.object({ largeur: dimension, hauteur: dimension }),
    podcast: z.object({ debitKbps: z.number().int().min(32).max(320), loudnessLufs: loudness }),
    pochettePodcast: z.object({ cote: z.number().int().min(500).max(5000) }),
  }),
  transcription: z.object({ modele: z.string().trim().min(1), vocabulaire: z.string().max(2000) }),
  claude: z.object({ modele: z.string().trim().min(1).nullable() }),
  rendusSimultanes: z.number().int().min(1).max(8),
  sousTitres: schemaReglagesSousTitres,
}) satisfies z.ZodType<Parametres>;

export const PARAMETRES_PAR_DEFAUT: Parametres = {
  version: 1,
  exports: {
    youtube: { largeur: 1920, hauteur: 1080, loudnessLufs: -14 },
    formatCourt: { largeur: 1080, hauteur: 1920, loudnessLufs: -14 },
    apercu: { largeur: 640 },
    instagram: { largeur: 1080, hauteur: 1350 },
    podcast: { debitKbps: 192, loudnessLufs: -16 },
    pochettePodcast: { cote: 3000 },
  },
  transcription: { modele: "large-v3-turbo", vocabulaire: "" },
  claude: { modele: null },
  rendusSimultanes: 1,
  sousTitres: {
    police: null,
    taillePourcent: 5.5,
    couleur: "#FFFFFF",
    couleurAccent: "#FFD43B",
    contour: 4,
    motsMax: 3,
    positionPourcent: 70,
    majuscules: false,
  },
};
