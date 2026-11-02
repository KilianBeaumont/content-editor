import { z } from "zod";
import { schemaLiens, schemaNomFiche, schemaSaisieLiens, type FicheIllisible } from "./fiches.ts";

export const TAILLE_MAX_PREUVE = 50 * 1024 * 1024;
export const EXTENSIONS_PREUVE = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf", ".txt", ".eml"] as const;

export interface AccordArtiste {
  date: string | null;
  monetisation: boolean;
  reutilisationAutorisee: boolean;
  preuve: string | null;
}

export interface FicheArtiste {
  nom: string;
  liens: Record<string, string>;
  contact: string;
  accord: AccordArtiste;
  videos: string[];
}

export interface SaisieArtiste {
  nom: string;
  liens: Record<string, string>;
  contact: string;
  accord: {
    date: string | null;
    monetisation: boolean;
    reutilisationAutorisee: boolean;
  };
}

export interface StatutAccord {
  valide: boolean;
  problemes: string[];
}

export interface Artiste {
  id: string;
  fiche: FicheArtiste;
  statut: StatutAccord;
}

export interface ReponseListeArtistes {
  artistes: Artiste[];
  illisibles: FicheIllisible[];
}

export const schemaSaisieArtiste = z.object({
  nom: schemaNomFiche,
  liens: schemaSaisieLiens,
  contact: z.string().trim().max(500),
  accord: z.object({
    date: z.iso.date().nullable(),
    monetisation: z.boolean(),
    reutilisationAutorisee: z.boolean(),
  }),
}) satisfies z.ZodType<SaisieArtiste>;

export const schemaFicheArtiste = z.object({
  nom: schemaNomFiche,
  liens: schemaLiens,
  contact: z.string(),
  accord: z.object({
    date: z.iso.date().nullable(),
    monetisation: z.boolean(),
    reutilisationAutorisee: z.boolean(),
    preuve: z.string().min(1).nullable(),
  }),
  videos: z.array(z.string()),
}) satisfies z.ZodType<FicheArtiste>;

export const FICHE_ARTISTE_VIDE: FicheArtiste = {
  nom: "",
  liens: {},
  contact: "",
  accord: { date: null, monetisation: false, reutilisationAutorisee: false, preuve: null },
  videos: [],
};
