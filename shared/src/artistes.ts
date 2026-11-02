import { z } from "zod";
import { slug } from "./slug.ts";

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

export interface ArtisteIllisible {
  id: string;
  erreur: string;
}

export interface ReponseListeArtistes {
  artistes: Artiste[];
  illisibles: ArtisteIllisible[];
}

const nom = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine((valeur) => slug(valeur) !== "", "Le nom doit contenir au moins une lettre ou un chiffre.");

const liens = z.record(z.string().trim().min(1).max(40), z.url({ protocol: /^https?$/ }));

export const schemaSaisieArtiste = z.object({
  nom,
  liens,
  contact: z.string().trim().max(500),
  accord: z.object({
    date: z.iso.date().nullable(),
    monetisation: z.boolean(),
    reutilisationAutorisee: z.boolean(),
  }),
}) satisfies z.ZodType<SaisieArtiste>;

export const schemaFicheArtiste = z.object({
  nom,
  liens: z.record(z.string(), z.string()),
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
