import { describe, expect, it } from "vitest";
import { argumentsClaude, LecteurFluxClaude, LimiteClaudeError, SessionIntrouvableError } from "./appel.ts";

const OPTIONS = {
  modele: null,
  dossier: "/projet",
  consignes: "/depot/.claude/skills/proposer-plan/SKILL.md",
  prompt: "Propose le plan.",
  schema: { type: "object" },
  session: { id: "1111", reprise: false },
};

const ligne = (evenement: unknown) => JSON.stringify(evenement);

describe("argumentsClaude", () => {
  it("limite Claude à la lecture, sans MCP ni skills, avec une session nommée", () => {
    const args = argumentsClaude(OPTIONS);
    expect(args.slice(0, 2)).toEqual(["-p", "Propose le plan."]);
    expect(args).toContain("--strict-mcp-config");
    expect(args).toContain("--disable-slash-commands");
    expect(args[args.indexOf("--tools") + 1]).toBe("Read,Glob,Grep");
    expect(args[args.indexOf("--json-schema") + 1]).toBe('{"type":"object"}');
    expect(args[args.indexOf("--append-system-prompt-file") + 1]).toBe(OPTIONS.consignes);
    expect(args.slice(-2)).toEqual(["--session-id", "1111"]);
    expect(args).not.toContain("--bare");
  });

  it("reprend une session existante et choisit le modèle", () => {
    const args = argumentsClaude({ ...OPTIONS, modele: "opus", session: { id: "2222", reprise: true } });
    expect(args.slice(-4)).toEqual(["--resume", "2222", "--model", "opus"]);
  });
});

describe("LecteurFluxClaude", () => {
  it("traduit les événements en étapes lisibles et garde la réponse structurée", () => {
    const lecteur = new LecteurFluxClaude();
    const etapes = [
      ligne({ type: "system", subtype: "init", session_id: "abc", apiKeySource: "none" }),
      "pas du JSON",
      ligne({ type: "system", subtype: "thinking_tokens", estimated_tokens: 50 }),
      ligne({ type: "assistant", message: { content: [{ type: "thinking" }] } }),
      ligne({ type: "assistant", message: { content: [{ type: "tool_use", name: "Read", input: { file_path: "C:\\projet\\travail\\plan\\contexte.md" } }] } }),
      ligne({ type: "assistant", message: { content: [{ type: "tool_use", name: "Grep", input: { pattern: "x" } }] } }),
      ligne({ type: "rate_limit_event", rate_limit_info: { status: "allowed", resetsAt: 1793728800 } }),
      ligne({ type: "assistant", message: { content: [{ type: "tool_use", name: "StructuredOutput", input: { resume: "" } }] } }),
      ligne({ type: "result", subtype: "success", is_error: false, result: "", session_id: "abc", structured_output: { resume: "ok" } }),
    ].map((texte) => lecteur.lire(texte));

    expect(etapes).toEqual([
      "Claude démarre",
      null,
      null,
      "Claude réfléchit",
      "Claude lit contexte.md",
      "Claude cherche dans les fichiers du projet",
      null,
      "Claude écrit sa réponse",
      null,
    ]);
    expect(lecteur.erreur(0, [])).toBeNull();
    expect(lecteur.session).toBe("abc");
    expect(lecteur.resultat?.sortie).toEqual({ resume: "ok" });
  });

  it("refuse une clé API", () => {
    const lecteur = new LecteurFluxClaude();
    lecteur.lire(ligne({ type: "system", subtype: "init", apiKeySource: "ANTHROPIC_API_KEY" }));
    expect(lecteur.erreur(0, [])?.message).toMatch(/clé API/);
  });

  it("signale une limite d'usage atteinte avec l'heure de reprise", () => {
    const lecteur = new LecteurFluxClaude();
    lecteur.lire(ligne({ type: "rate_limit_event", rate_limit_info: { status: "rejected", resetsAt: 1793728800 } }));
    lecteur.lire(ligne({ type: "result", is_error: true, result: "Claude AI usage limit reached" }));
    const erreur = lecteur.erreur(1, []);
    expect(erreur).toBeInstanceOf(LimiteClaudeError);
    expect(erreur?.message).toMatch(/Limite d'usage Claude atteinte : réessaie à .* avec « Relancer »/);
  });

  it("reconnaît une session introuvable et une réponse sans plan", () => {
    const introuvable = new LecteurFluxClaude();
    expect(introuvable.erreur(1, ["No conversation found with session ID: 2222"])).toBeInstanceOf(SessionIntrouvableError);

    const sansPlan = new LecteurFluxClaude();
    sansPlan.lire(ligne({ type: "result", is_error: false, result: "Voici le plan" }));
    expect(sansPlan.erreur(0, [])?.message).toBe("Claude n'a pas renvoyé de réponse structurée.");

    const plante = new LecteurFluxClaude();
    expect(plante.erreur(1, ["Error: boom"])?.message).toBe("Claude a échoué : Error: boom");
    expect(new LecteurFluxClaude().erreur(1, [])?.message).toBe("Claude s'est arrêté (code 1).");
  });
});
