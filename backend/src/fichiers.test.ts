import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CheminInterditError, cheminSur, ecrireJsonAtomique } from "./fichiers.ts";

describe("cheminSur", () => {
  const racine = resolve(tmpdir(), "creations-test");

  it("accepte un chemin dans la racine", () => {
    expect(cheminSur(racine, "inbox/rush 01.mp4")).toBe(join(racine, "inbox", "rush 01.mp4"));
  });

  it("accepte un chemin qui remonte sans sortir", () => {
    expect(cheminSur(racine, "inbox/../guides")).toBe(join(racine, "guides"));
  });

  it.each([
    "../ailleurs",
    "inbox/../../ailleurs",
    "..",
    "/etc/passwd",
    "C:\\Windows",
    "C:/Windows",
    "..\\ailleurs",
    "\\\\serveur\\partage",
    "inbox/\0.mp4",
  ])(
    "refuse %s",
    (chemin) => {
      expect(() => cheminSur(racine, chemin)).toThrow(CheminInterditError);
    },
  );
});

describe("ecrireJsonAtomique", () => {
  let dossier: string;

  beforeEach(async () => {
    dossier = await mkdtemp(join(tmpdir(), "editeur-fichiers-"));
  });

  afterEach(async () => {
    await rm(dossier, { recursive: true, force: true });
  });

  it("écrit puis remplace un fichier sans laisser de fichier temporaire", async () => {
    const chemin = join(dossier, "donnees.json");
    await ecrireJsonAtomique(chemin, { version: 1 });
    await ecrireJsonAtomique(chemin, { version: 2, titre: "Été" });

    expect(JSON.parse(await readFile(chemin, "utf8"))).toEqual({ version: 2, titre: "Été" });
    expect(await readdir(dossier)).toEqual(["donnees.json"]);
  });

  it("échoue proprement si le dossier n'existe pas", async () => {
    await expect(ecrireJsonAtomique(join(dossier, "absent", "x.json"), {})).rejects.toThrow();
    expect(await readdir(dossier)).toEqual([]);
  });
});
