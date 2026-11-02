import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CONFIG_PAR_DEFAUT, lireConfigMachine } from "./config.ts";
import { FichierInvalideError } from "./fichiers.ts";

describe("lireConfigMachine", () => {
  let depot: string;

  beforeEach(async () => {
    depot = await mkdtemp(join(tmpdir(), "editeur-depot-"));
  });

  afterEach(async () => {
    await rm(depot, { recursive: true, force: true });
  });

  async function ecrireConfig(contenu: string): Promise<void> {
    await writeFile(join(depot, "config.local.json"), contenu, "utf8");
  }

  it("utilise les valeurs par défaut sans fichier", async () => {
    const config = await lireConfigMachine(depot);
    expect(config.creations).toBe(join(dirname(depot), "creations"));
    expect(config.binaires).toEqual(CONFIG_PAR_DEFAUT.binaires);
  });

  it("résout un chemin relatif depuis la racine du dépôt", async () => {
    await ecrireConfig(JSON.stringify({ creations: "donnees/creations" }));
    expect((await lireConfigMachine(depot)).creations).toBe(join(depot, "donnees", "creations"));
  });

  it("garde un chemin absolu tel quel", async () => {
    const absolu = join(tmpdir(), "mes-creations");
    await ecrireConfig(JSON.stringify({ creations: absolu }));
    expect((await lireConfigMachine(depot)).creations).toBe(absolu);
  });

  it("complète les binaires absents avec les valeurs par défaut", async () => {
    await ecrireConfig(JSON.stringify({ binaires: { ffmpeg: "/opt/homebrew/bin/ffmpeg" } }));
    const config = await lireConfigMachine(depot);
    expect(config.binaires.ffmpeg).toBe("/opt/homebrew/bin/ffmpeg");
    expect(config.binaires.claude).toBe("claude");
  });

  it("accepte un fichier enregistré avec une marque d'encodage (BOM)", async () => {
    await ecrireConfig(`\uFEFF${JSON.stringify({ binaires: { claude: "C:/outils/claude.exe" } })}`);
    expect((await lireConfigMachine(depot)).binaires.claude).toBe("C:/outils/claude.exe");
  });

  it("signale un JSON mal formé", async () => {
    await ecrireConfig("{ creations: ");
    await expect(lireConfigMachine(depot)).rejects.toThrow(FichierInvalideError);
  });

  it("signale une valeur invalide en nommant le champ", async () => {
    await ecrireConfig(JSON.stringify({ binaires: { ffmpeg: "" } }));
    await expect(lireConfigMachine(depot)).rejects.toThrow(/binaires\.ffmpeg/);
  });
});
