import { z } from "zod";

export interface BinairesMachine {
  ffmpeg: string;
  ffprobe: string;
  claude: string;
  whisper: string;
}

export interface ConfigMachine {
  creations: string;
  binaires: BinairesMachine;
}

export const schemaConfigMachine = z.object({
  creations: z.string().trim().min(1),
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
  transcription: { modele: string };
  claude: { modele: string | null };
  rendusSimultanes: number;
}

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
  transcription: { modele: "large-v3-turbo" },
  claude: { modele: null },
  rendusSimultanes: 1,
};
