import { z } from "zod";

export const MOTIF_LIMITE = /limit|quota/i;

export const schemaInit = z.object({
  type: z.literal("system"),
  subtype: z.literal("init"),
  session_id: z.string().optional(),
  apiKeySource: z.string().optional(),
  model: z.string().optional(),
});

export const schemaLimites = z.object({
  type: z.literal("rate_limit_event"),
  rate_limit_info: z.object({
    status: z.string(),
    resetsAt: z.number().optional(),
    unifiedWindows: z
      .record(z.string(), z.object({ utilization: z.number(), resetsAt: z.number(), status: z.string() }))
      .optional(),
  }),
});

export const schemaResultat = z.object({
  type: z.literal("result"),
  subtype: z.string().optional(),
  is_error: z.boolean(),
  result: z.string().optional(),
  session_id: z.string().optional(),
  structured_output: z.unknown().optional(),
  total_cost_usd: z.number().optional(),
});

export const schemaAssistant = z.object({
  type: z.literal("assistant"),
  message: z.object({
    content: z.array(
      z.object({
        type: z.string(),
        name: z.string().optional(),
        input: z.record(z.string(), z.unknown()).optional(),
      }),
    ),
  }),
});

export function lireEvenement(ligne: string): unknown {
  if (ligne.trim() === "") return null;
  try {
    return JSON.parse(ligne);
  } catch {
    return null;
  }
}

export function lireEvenements(sortie: string): unknown[] {
  return sortie
    .split(/\r?\n/)
    .map(lireEvenement)
    .filter((evenement) => evenement !== null);
}

export function trouver<T>(evenements: unknown[], schema: z.ZodType<T>): T | null {
  for (const evenement of evenements) {
    const resultat = schema.safeParse(evenement);
    if (resultat.success) return resultat.data;
  }
  return null;
}
