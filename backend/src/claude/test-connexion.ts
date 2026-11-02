import { tmpdir } from "node:os";
import type { LimitesClaude, ResultatTestClaude } from "@editeur/shared";
import { z } from "zod";
import { codeErreur } from "../erreurs.ts";
import { executer, type ResultatProcessus } from "../processus.ts";
import { environnementClaude } from "./environnement.ts";

const CONSIGNE_TEST = "Réponds uniquement par le mot OK.";
const DELAI_MS = 120_000;
const MOTIF_LIMITE = /limit|quota/i;

const schemaInit = z.object({
  type: z.literal("system"),
  subtype: z.literal("init"),
  apiKeySource: z.string().optional(),
  model: z.string().optional(),
});

const schemaLimites = z.object({
  type: z.literal("rate_limit_event"),
  rate_limit_info: z.object({
    status: z.string(),
    unifiedWindows: z
      .record(z.string(), z.object({ utilization: z.number(), resetsAt: z.number(), status: z.string() }))
      .optional(),
  }),
});

const schemaResultat = z.object({
  type: z.literal("result"),
  is_error: z.boolean(),
  result: z.string().optional(),
});

function lireEvenements(sortie: string): unknown[] {
  const evenements: unknown[] = [];
  for (const ligne of sortie.split(/\r?\n/)) {
    if (ligne.trim() === "") continue;
    try {
      evenements.push(JSON.parse(ligne));
    } catch {
      continue;
    }
  }
  return evenements;
}

function trouver<T>(evenements: unknown[], schema: z.ZodType<T>): T | null {
  for (const evenement of evenements) {
    const resultat = schema.safeParse(evenement);
    if (resultat.success) return resultat.data;
  }
  return null;
}

function premiereLigne(texte: string): string | null {
  return texte.split(/\r?\n/).find((ligne) => ligne.trim() !== "")?.trim() ?? null;
}

export function analyserSortieClaude(processus: ResultatProcessus, dureeMs: number): ResultatTestClaude {
  const evenements = lireEvenements(processus.sortie);
  const init = trouver(evenements, schemaInit);
  const evenementLimites = trouver(evenements, schemaLimites);
  const resultat = trouver(evenements, schemaResultat);

  const limites: LimitesClaude | null = evenementLimites && {
    statut: evenementLimites.rate_limit_info.status,
    fenetres: Object.entries(evenementLimites.rate_limit_info.unifiedWindows ?? {}).map(([nom, fenetre]) => ({
      nom,
      utilisation: fenetre.utilization,
      statut: fenetre.status,
      reinitialisation: new Date(fenetre.resetsAt * 1000).toISOString(),
    })),
  };

  const ok = processus.code === 0 && resultat !== null && !resultat.is_error;
  let erreur: string | null = null;
  if (!ok) {
    erreur = processus.delaiDepasse
      ? "Claude n'a pas répondu à temps."
      : ((resultat?.is_error ? resultat.result : null) ??
        premiereLigne(processus.erreurs) ??
        `Claude s'est arrêté (code ${processus.code ?? "inconnu"}).`);
  }

  const sourceCle = init?.apiKeySource ?? null;
  return {
    ok,
    abonnement: sourceCle === null ? null : sourceCle === "none",
    sourceCle,
    modele: init?.model ?? null,
    reponse: ok ? (resultat?.result ?? null) : null,
    limites,
    limiteAtteinte: (limites !== null && limites.statut !== "allowed") || (erreur !== null && MOTIF_LIMITE.test(erreur)),
    dureeMs,
    erreur,
  };
}

export async function testerConnexionClaude(commande: string, modele: string | null): Promise<ResultatTestClaude> {
  const args = ["-p", CONSIGNE_TEST, "--output-format", "stream-json", "--verbose"];
  if (modele !== null) {
    args.push("--model", modele);
  }
  const debut = Date.now();
  try {
    const processus = await executer(commande, args, {
      delaiMs: DELAI_MS,
      env: environnementClaude(process.env),
      cwd: tmpdir(),
    });
    return analyserSortieClaude(processus, Date.now() - debut);
  } catch (erreur) {
    const message =
      codeErreur(erreur) === "ENOENT"
        ? `Commande introuvable : ${commande}`
        : `Impossible de lancer ${commande} : ${erreur instanceof Error ? erreur.message : String(erreur)}`;
    return {
      ok: false,
      abonnement: null,
      sourceCle: null,
      modele: null,
      reponse: null,
      limites: null,
      limiteAtteinte: false,
      dureeMs: Date.now() - debut,
      erreur: message,
    };
  }
}
