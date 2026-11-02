import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { creerApp } from "./app.ts";

describe("API", () => {
  it("répond sur /api/sante", async () => {
    const app = await creerApp();
    const reponse = await app.inject({ method: "GET", url: "/api/sante" });
    expect(reponse.statusCode).toBe(200);
    expect(reponse.json()).toEqual({ ok: true });
  });

  it("renvoie une erreur JSON pour une route inconnue", async () => {
    const app = await creerApp();
    const reponse = await app.inject({ method: "GET", url: "/api/inconnue" });
    expect(reponse.statusCode).toBe(404);
    expect(reponse.json()).toEqual({ erreur: "Introuvable" });
  });
});

describe("interface compilée", () => {
  let dossier: string;

  beforeAll(async () => {
    dossier = await mkdtemp(join(tmpdir(), "editeur-interface-"));
    await writeFile(join(dossier, "index.html"), "<!doctype html><title>Éditeur</title>");
  });

  afterAll(async () => {
    await rm(dossier, { recursive: true, force: true });
  });

  it("sert index.html à la racine", async () => {
    const app = await creerApp({ dossierInterface: dossier });
    const reponse = await app.inject({ method: "GET", url: "/" });
    expect(reponse.statusCode).toBe(200);
    expect(reponse.body).toContain("<title>Éditeur</title>");
  });

  it("sert index.html pour une page de l'interface", async () => {
    const app = await creerApp({ dossierInterface: dossier });
    const reponse = await app.inject({ method: "GET", url: "/projets/2026-11-06_le-dernier-dragon" });
    expect(reponse.statusCode).toBe(200);
    expect(reponse.body).toContain("<title>Éditeur</title>");
  });

  it("garde les erreurs JSON pour l'API", async () => {
    const app = await creerApp({ dossierInterface: dossier });
    const reponse = await app.inject({ method: "GET", url: "/api/inconnue" });
    expect(reponse.statusCode).toBe(404);
    expect(reponse.json()).toEqual({ erreur: "Introuvable" });
  });
});
