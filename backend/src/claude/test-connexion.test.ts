import { describe, expect, it } from "vitest";
import type { ResultatProcessus } from "../processus.ts";
import { analyserSortieClaude } from "./test-connexion.ts";

function sortie(...evenements: object[]): string {
  return evenements.map((evenement) => JSON.stringify(evenement)).join("\n");
}

function processus(contenu: Partial<ResultatProcessus>): ResultatProcessus {
  return { code: 0, sortie: "", erreurs: "", delaiDepasse: false, ...contenu };
}

const INIT_ABONNEMENT = { type: "system", subtype: "init", apiKeySource: "none", model: "claude-opus-5-5" };
const LIMITES = {
  type: "rate_limit_event",
  rate_limit_info: {
    status: "allowed",
    unifiedWindows: {
      five_hour: { utilization: 0.1, resetsAt: 1793651400, status: "allowed" },
      seven_day: { utilization: 0.12, resetsAt: 1793700000, status: "allowed" },
    },
  },
};
const SUCCES = { type: "result", subtype: "success", is_error: false, result: "OK" };

describe("analyserSortieClaude", () => {
  it("reconnaît une réponse obtenue avec l'abonnement", () => {
    const resultat = analyserSortieClaude(
      processus({ sortie: sortie(INIT_ABONNEMENT, { type: "assistant" }, LIMITES, SUCCES) }),
      1200,
    );

    expect(resultat).toMatchObject({
      ok: true,
      abonnement: true,
      sourceCle: "none",
      modele: "claude-opus-5-5",
      reponse: "OK",
      limiteAtteinte: false,
      erreur: null,
    });
    expect(resultat.limites?.fenetres).toEqual([
      { nom: "five_hour", utilisation: 0.1, statut: "allowed", reinitialisation: "2026-11-02T20:30:00.000Z" },
      { nom: "seven_day", utilisation: 0.12, statut: "allowed", reinitialisation: "2026-11-03T10:00:00.000Z" },
    ]);
  });

  it("signale l'utilisation d'une clé API", () => {
    const resultat = analyserSortieClaude(
      processus({ sortie: sortie({ ...INIT_ABONNEMENT, apiKeySource: "ANTHROPIC_API_KEY" }, SUCCES) }),
      900,
    );
    expect(resultat.ok).toBe(true);
    expect(resultat.abonnement).toBe(false);
    expect(resultat.sourceCle).toBe("ANTHROPIC_API_KEY");
  });

  it("détecte une limite d'usage atteinte", () => {
    const limiteAtteinte = { ...LIMITES, rate_limit_info: { ...LIMITES.rate_limit_info, status: "rejected" } };
    const resultat = analyserSortieClaude(
      processus({
        code: 1,
        sortie: sortie(INIT_ABONNEMENT, limiteAtteinte, { type: "result", is_error: true, result: "Usage limit reached" }),
      }),
      500,
    );
    expect(resultat).toMatchObject({ ok: false, limiteAtteinte: true, erreur: "Usage limit reached" });
  });

  it("remonte la première ligne d'erreur quand Claude ne produit rien", () => {
    const resultat = analyserSortieClaude(
      processus({ code: 1, erreurs: "\nInvalid API key · Please run /login\n" }),
      300,
    );
    expect(resultat).toMatchObject({ ok: false, abonnement: null, erreur: "Invalid API key · Please run /login" });
  });

  it("signale un délai dépassé", () => {
    const resultat = analyserSortieClaude(processus({ code: null, delaiDepasse: true }), 120000);
    expect(resultat.erreur).toBe("Claude n'a pas répondu à temps.");
  });

  it("ignore les lignes qui ne sont pas du JSON", () => {
    const resultat = analyserSortieClaude(
      processus({ sortie: `avertissement\n${sortie(INIT_ABONNEMENT, SUCCES)}\n` }),
      100,
    );
    expect(resultat.ok).toBe(true);
  });
});
