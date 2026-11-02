import { describe, expect, it } from "vitest";
import { environnementClaude } from "./environnement.ts";

describe("environnementClaude", () => {
  it("retire les clés API et les variables de la session Claude Code en cours", () => {
    const resultat = environnementClaude({
      PATH: "C:\\Windows",
      Path: "C:\\Windows",
      HOME: "/Users/kilian",
      ANTHROPIC_API_KEY: "sk-secret",
      ANTHROPIC_AUTH_TOKEN: "jeton",
      ANTHROPIC_BASE_URL: "https://ailleurs",
      CLAUDECODE: "1",
      CLAUDE_CODE_ENTRYPOINT: "cli",
      CLAUDE_CODE_USE_BEDROCK: "1",
      CLAUDE_CODE_SESSION_ID: "abc",
      anthropic_api_key: "minuscules",
    });

    expect(resultat).toEqual({ PATH: "C:\\Windows", Path: "C:\\Windows", HOME: "/Users/kilian" });
  });

  it("garde le dossier de configuration de Claude, qui contient la connexion", () => {
    expect(environnementClaude({ CLAUDE_CONFIG_DIR: "D:/claude" })).toEqual({ CLAUDE_CONFIG_DIR: "D:/claude" });
  });
});
