import { basename } from "node:path";
import { codeErreur } from "../erreurs.ts";
import { lancer } from "../processus.ts";
import { environnementClaude } from "./environnement.ts";
import { lireEvenement, MOTIF_LIMITE, schemaAssistant, schemaInit, schemaLimites, schemaResultat } from "./evenements.ts";

export const OUTILS_LECTURE = ["Read", "Glob", "Grep"];
const DELAI_MAX_MS = 20 * 60 * 1000;
const MOTIF_SESSION_INTROUVABLE = /no conversation found/i;

export class LimiteClaudeError extends Error {}
export class SessionIntrouvableError extends Error {}

export interface OptionsAppelClaude {
  commande: string;
  modele: string | null;
  dossier: string;
  consignes: string;
  prompt: string;
  schema: Record<string, unknown>;
  session: { id: string; reprise: boolean };
  signal: AbortSignal;
  surEtape: (etape: string) => void;
}

export interface ResultatAppelClaude {
  sortie: unknown;
  session: string;
}

export function argumentsClaude(options: Omit<OptionsAppelClaude, "commande" | "signal" | "surEtape">): string[] {
  const args = [
    "-p",
    options.prompt,
    "--output-format",
    "stream-json",
    "--verbose",
    "--json-schema",
    JSON.stringify(options.schema),
    "--append-system-prompt-file",
    options.consignes,
    "--tools",
    OUTILS_LECTURE.join(","),
    "--allowedTools",
    OUTILS_LECTURE.join(","),
    "--strict-mcp-config",
    "--disable-slash-commands",
    options.session.reprise ? "--resume" : "--session-id",
    options.session.id,
  ];
  if (options.modele !== null) args.push("--model", options.modele);
  return args;
}

function heure(secondes: number | undefined): string {
  if (secondes === undefined) return "plus tard";
  return `à ${new Date(secondes * 1000).toLocaleString("fr-FR", { weekday: "long", hour: "2-digit", minute: "2-digit" })}`;
}

export class LecteurFluxClaude {
  session: string | null = null;
  sourceCle: string | null = null;
  limiteAtteinte: string | null = null;
  resultat: { erreur: boolean; texte: string | null; sortie: unknown } | null = null;

  lire(ligne: string): string | null {
    const evenement = lireEvenement(ligne);
    if (evenement === null) return null;

    const init = schemaInit.safeParse(evenement);
    if (init.success) {
      this.session = init.data.session_id ?? this.session;
      this.sourceCle = init.data.apiKeySource ?? null;
      return "Claude démarre";
    }

    const limites = schemaLimites.safeParse(evenement);
    if (limites.success) {
      const info = limites.data.rate_limit_info;
      if (info.status === "rejected") {
        this.limiteAtteinte = `Limite d'usage Claude atteinte : réessaie ${heure(info.resetsAt)} avec « Relancer ».`;
      }
      return null;
    }

    const resultat = schemaResultat.safeParse(evenement);
    if (resultat.success) {
      this.session = resultat.data.session_id ?? this.session;
      this.resultat = { erreur: resultat.data.is_error, texte: resultat.data.result ?? null, sortie: resultat.data.structured_output };
      return null;
    }

    const assistant = schemaAssistant.safeParse(evenement);
    if (!assistant.success) return null;
    let etape: string | null = null;
    for (const contenu of assistant.data.message.content) {
      if (contenu.type === "thinking") etape = "Claude réfléchit";
      if (contenu.type !== "tool_use") continue;
      const chemin = contenu.input?.file_path;
      if (contenu.name === "Read") etape = typeof chemin === "string" ? `Claude lit ${basename(chemin)}` : "Claude lit un fichier";
      else if (contenu.name === "Glob" || contenu.name === "Grep") etape = "Claude cherche dans les fichiers du projet";
      else if (contenu.name === "StructuredOutput") etape = "Claude écrit sa réponse";
    }
    return etape;
  }

  erreur(code: number | null, dernieresErreurs: string[]): Error | null {
    if (this.sourceCle !== null && this.sourceCle !== "none") {
      return new Error(`Claude utilise une clé API (${this.sourceCle}) au lieu de l'abonnement : appel arrêté. Reconnecte Claude Code avec ton abonnement.`);
    }
    const texte = (this.resultat?.erreur ? this.resultat.texte : null) ?? dernieresErreurs.join("\n").trim();
    if (this.limiteAtteinte !== null) return new LimiteClaudeError(this.limiteAtteinte);
    if (MOTIF_SESSION_INTROUVABLE.test(texte)) return new SessionIntrouvableError(texte);
    if (this.resultat === null || this.resultat.erreur || code !== 0) {
      if (MOTIF_LIMITE.test(texte)) return new LimiteClaudeError(`Limite d'usage Claude atteinte : ${texte}`);
      return new Error(texte === "" ? `Claude s'est arrêté (code ${code ?? "inconnu"}).` : `Claude a échoué : ${texte}`);
    }
    if (this.resultat.sortie === undefined || this.resultat.sortie === null) {
      return new Error("Claude n'a pas renvoyé de réponse structurée.");
    }
    return null;
  }
}

export async function appelerClaude(options: OptionsAppelClaude): Promise<ResultatAppelClaude> {
  const lecteur = new LecteurFluxClaude();
  const arret = new AbortController();
  const delai = AbortSignal.timeout(DELAI_MAX_MS);
  const signal = AbortSignal.any([options.signal, delai, arret.signal]);
  let resultat;
  try {
    resultat = await lancer(options.commande, argumentsClaude(options), {
      cwd: options.dossier,
      env: environnementClaude(process.env),
      signal,
      surLigne: (ligne, flux) => {
        if (flux !== "sortie") return;
        const etape = lecteur.lire(ligne);
        if (lecteur.sourceCle !== null && lecteur.sourceCle !== "none") arret.abort();
        if (etape !== null) options.surEtape(etape);
      },
    });
  } catch (erreur) {
    if (codeErreur(erreur) === "ENOENT") {
      throw new Error(`Commande introuvable : ${options.commande}. Vérifie le chemin de claude dans Paramètres.`, { cause: erreur });
    }
    throw erreur;
  }
  if (options.signal.aborted) throw new Error("Appel à Claude annulé.");
  if (delai.aborted) throw new Error("Claude n'a pas répondu en 20 minutes : appel arrêté.");
  const erreur = lecteur.erreur(resultat.code, resultat.dernieresErreurs);
  if (erreur !== null) throw erreur;
  return { sortie: lecteur.resultat?.sortie, session: lecteur.session ?? options.session.id };
}
