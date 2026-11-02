import { z } from "zod";
import { schemaLiens, schemaNomFiche, schemaSaisieLiens, type FicheIllisible } from "./fiches.ts";

export interface FicheAuteur {
  nom: string;
  liens: Record<string, string>;
  contact: string;
  recits: string[];
}

export interface SaisieAuteur {
  nom: string;
  liens: Record<string, string>;
  contact: string;
}

export interface Auteur {
  id: string;
  fiche: FicheAuteur;
}

export interface ReponseListeAuteurs {
  auteurs: Auteur[];
  illisibles: FicheIllisible[];
}

export const schemaSaisieAuteur = z.object({
  nom: schemaNomFiche,
  liens: schemaSaisieLiens,
  contact: z.string().trim().max(500),
}) satisfies z.ZodType<SaisieAuteur>;

export const schemaFicheAuteur = z.object({
  nom: schemaNomFiche,
  liens: schemaLiens,
  contact: z.string(),
  recits: z.array(z.string()),
}) satisfies z.ZodType<FicheAuteur>;

export const FICHE_AUTEUR_VIDE: FicheAuteur = {
  nom: "",
  liens: {},
  contact: "",
  recits: [],
};
