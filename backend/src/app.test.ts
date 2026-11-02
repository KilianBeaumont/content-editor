import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { preparerEnvironnementTest, type EnvironnementTest } from "./test-outils.ts";

describe("API", () => {
  let env: EnvironnementTest;

  beforeEach(async () => {
    env = await preparerEnvironnementTest();
  });

  afterEach(async () => {
    await env.nettoyer();
  });

  it("répond sur /api/sante", async () => {
    const reponse = await env.app.inject({ method: "GET", url: "/api/sante" });
    expect(reponse.statusCode).toBe(200);
    expect(reponse.json()).toEqual({ ok: true });
  });

  it("renvoie une erreur JSON pour une route inconnue", async () => {
    const reponse = await env.app.inject({ method: "GET", url: "/api/inconnue" });
    expect(reponse.statusCode).toBe(404);
    expect(reponse.json()).toEqual({ erreur: "Introuvable" });
  });

  it("renvoie une erreur 400 lisible pour un corps JSON mal formé", async () => {
    const reponse = await env.app.inject({
      method: "PUT",
      url: "/api/parametres",
      headers: { "content-type": "application/json" },
      payload: "{ pas du json",
    });
    expect(reponse.statusCode).toBe(400);
    expect(reponse.json()).toHaveProperty("erreur");
  });
});

describe("interface compilée", () => {
  let interfaceCompilee: string;
  let env: EnvironnementTest;

  beforeAll(async () => {
    interfaceCompilee = await mkdtemp(join(tmpdir(), "editeur-interface-"));
    await writeFile(join(interfaceCompilee, "index.html"), "<!doctype html><title>Éditeur</title>");
    env = await preparerEnvironnementTest(interfaceCompilee);
  });

  afterAll(async () => {
    await env.nettoyer();
    await rm(interfaceCompilee, { recursive: true, force: true });
  });

  it("sert index.html à la racine", async () => {
    const reponse = await env.app.inject({ method: "GET", url: "/" });
    expect(reponse.statusCode).toBe(200);
    expect(reponse.body).toContain("<title>Éditeur</title>");
  });

  it("sert index.html pour une page de l'interface", async () => {
    const reponse = await env.app.inject({ method: "GET", url: "/projets/2026-11-06_le-dernier-dragon" });
    expect(reponse.statusCode).toBe(200);
    expect(reponse.body).toContain("<title>Éditeur</title>");
  });

  it("garde les erreurs JSON pour l'API", async () => {
    const reponse = await env.app.inject({ method: "GET", url: "/api/inconnue" });
    expect(reponse.statusCode).toBe(404);
    expect(reponse.json()).toEqual({ erreur: "Introuvable" });
  });
});
