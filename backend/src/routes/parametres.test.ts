import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PARAMETRES_PAR_DEFAUT, type ConfigMachine, type Parametres } from "@editeur/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { preparerEnvironnementTest, type EnvironnementTest } from "../test-outils.ts";

describe("routes des paramètres", () => {
  let env: EnvironnementTest;

  beforeEach(async () => {
    env = await preparerEnvironnementTest();
  });

  afterEach(async () => {
    await env.nettoyer();
  });

  const fichierParametres = () => join(env.contexte.config.creations, "parametres.json");

  it("lit les paramètres par défaut", async () => {
    const reponse = await env.app.inject({ method: "GET", url: "/api/parametres" });
    expect(reponse.statusCode).toBe(200);
    expect(reponse.json()).toEqual(PARAMETRES_PAR_DEFAUT);
  });

  it("enregistre des paramètres valides", async () => {
    const parametres: Parametres = { ...PARAMETRES_PAR_DEFAUT, rendusSimultanes: 2, claude: { modele: "opus" } };
    const reponse = await env.app.inject({ method: "PUT", url: "/api/parametres", payload: parametres });

    expect(reponse.statusCode).toBe(200);
    expect(JSON.parse(await readFile(fichierParametres(), "utf8"))).toEqual(parametres);
  });

  it("refuse des paramètres invalides avec un message en français", async () => {
    const reponse = await env.app.inject({
      method: "PUT",
      url: "/api/parametres",
      payload: { ...PARAMETRES_PAR_DEFAUT, rendusSimultanes: 0 },
    });

    expect(reponse.statusCode).toBe(400);
    expect(reponse.json<{ erreur: string }>().erreur).toMatch(/rendusSimultanes/);
    expect(reponse.json<{ erreur: string }>().erreur).toMatch(/Trop petit/);
    expect(JSON.parse(await readFile(fichierParametres(), "utf8"))).toEqual(PARAMETRES_PAR_DEFAUT);
  });

  it("complète un fichier ancien avec les réglages ajoutés depuis", async () => {
    await writeFile(fichierParametres(), JSON.stringify({ version: 1, rendusSimultanes: 3 }), "utf8");
    const reponse = await env.app.inject({ method: "GET", url: "/api/parametres" });
    expect(reponse.json()).toEqual({ ...PARAMETRES_PAR_DEFAUT, rendusSimultanes: 3 });
  });

  it("signale un parametres.json abîmé sans l'écraser", async () => {
    await writeFile(fichierParametres(), "{ abîmé", "utf8");
    const reponse = await env.app.inject({ method: "GET", url: "/api/parametres" });
    expect(reponse.statusCode).toBe(500);
    expect(reponse.json<{ erreur: string }>().erreur).toMatch(/parametres\.json n'est pas un JSON valide/);
    expect(await readFile(fichierParametres(), "utf8")).toBe("{ abîmé");
  });

  it("change le dossier creations et l'initialise", async () => {
    const nouveau = join(env.dossier, "autres-creations");
    const config: ConfigMachine = { ...env.contexte.config, creations: nouveau };

    const reponse = await env.app.inject({ method: "PUT", url: "/api/config-machine", payload: config });

    expect(reponse.statusCode).toBe(200);
    expect(reponse.json<{ crees: string[] }>().crees).toContain("parametres.json");
    await expect(access(join(nouveau, "guides", "recit", "style.md"))).resolves.toBeUndefined();
    const fichierConfig: unknown = JSON.parse(
      await readFile(join(env.contexte.racineDepot, "config.local.json"), "utf8"),
    );
    expect(fichierConfig).toEqual(config);

    await writeFile(join(nouveau, "parametres.json"), JSON.stringify({ rendusSimultanes: 4 }), "utf8");
    const parametres = await env.app.inject({ method: "GET", url: "/api/parametres" });
    expect(parametres.json<Parametres>().rendusSimultanes).toBe(4);
  });

  it("refuse une configuration de machine incomplète", async () => {
    const reponse = await env.app.inject({
      method: "PUT",
      url: "/api/config-machine",
      payload: { creations: "", binaires: env.contexte.config.binaires },
    });
    expect(reponse.statusCode).toBe(400);
  });

  it("diagnostique chaque programme", async () => {
    env.contexte.config.binaires.whisper = "programme-qui-n-existe-pas-1234";
    const reponse = await env.app.inject({ method: "GET", url: "/api/diagnostic" });
    const { binaires } = reponse.json<{ binaires: Array<{ nom: string; trouve: boolean }> }>();
    expect(binaires.map((binaire) => binaire.nom)).toEqual(["ffmpeg", "ffprobe", "claude", "whisper"]);
    expect(binaires.find((binaire) => binaire.nom === "whisper")?.trouve).toBe(false);
  });
});
