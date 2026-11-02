import { z } from "zod";
import { slug } from "./slug.ts";

export interface FicheIllisible {
  id: string;
  erreur: string;
}

export const schemaNomFiche = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine((valeur) => slug(valeur) !== "", "Le nom doit contenir au moins une lettre ou un chiffre.");

export const schemaSaisieLiens = z.record(z.string().trim().min(1).max(40), z.url({ protocol: /^https?$/ }));

export const schemaLiens = z.record(z.string(), z.string());
