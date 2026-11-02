import { describe, expect, it } from "vitest";
import { diagnostiquerBinaire } from "./diagnostic.ts";

describe("diagnostiquerBinaire", () => {
  it("signale un programme introuvable", async () => {
    const resultat = await diagnostiquerBinaire("ffmpeg", "programme-qui-n-existe-pas-1234");
    expect(resultat).toMatchObject({ trouve: false, version: null });
    expect(resultat.erreur).toMatch(/Introuvable/);
  });

  it("lit la version d'un programme qui répond", async () => {
    const resultat = await diagnostiquerBinaire("claude", process.execPath);
    expect(resultat).toMatchObject({ trouve: true, version: process.version, erreur: null });
  });

  it("signale un programme qui refuse l'option de version", async () => {
    const resultat = await diagnostiquerBinaire("ffmpeg", process.execPath);
    expect(resultat.trouve).toBe(true);
    expect(resultat.version).toBeNull();
    expect(resultat.erreur).not.toBeNull();
  });
});
