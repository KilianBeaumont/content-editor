import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CATEGORIES, PARAMETRES_PAR_DEFAUT } from "@editeur/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initialiserCreations } from "./initialisation.ts";

describe("initialiserCreations", () => {
  let parent: string;
  let racine: string;

  beforeEach(async () => {
    parent = await mkdtemp(join(tmpdir(), "editeur-creations-"));
    racine = join(parent, "creations");
  });

  afterEach(async () => {
    await rm(parent, { recursive: true, force: true });
  });

  it("crée toute l'arborescence dans un dossier absent", async () => {
    const { crees } = await initialiserCreations(racine);

    const attendus = [
      "inbox",
      "artistes",
      "auteurs",
      "corbeille",
      "chaine-creation",
      "chaine-recits",
      "bibliotheque/commun/identite",
      "bibliotheque/recits/ambiances-sonores",
      "bibliotheque/creation/modeles-miniatures",
      "bibliotheque/catalogue.json",
      "parametres.json",
      ...CATEGORIES.flatMap((categorie) => [
        `guides/${categorie}/style.md`,
        `guides/${categorie}/hooks.md`,
        `guides/${categorie}/inspiration/videos`,
        `guides/${categorie}/inspiration/analyses`,
      ]),
    ];
    for (const chemin of attendus) {
      await expect(access(join(racine, chemin))).resolves.toBeUndefined();
    }
    expect(crees.length).toBeGreaterThan(attendus.length);
  });

  it("écrit des fichiers par défaut valides", async () => {
    await initialiserCreations(racine);

    const parametres: unknown = JSON.parse(await readFile(join(racine, "parametres.json"), "utf8"));
    expect(parametres).toEqual(PARAMETRES_PAR_DEFAUT);
    const catalogue: unknown = JSON.parse(await readFile(join(racine, "bibliotheque/catalogue.json"), "utf8"));
    expect(catalogue).toEqual({ assets: [] });
    expect(await readFile(join(racine, "guides/recit/style.md"), "utf8")).toContain("# Style : récit");
    expect(await readFile(join(racine, "guides/recit/style.md"), "utf8")).toContain("Montée de tension");
  });

  it("ne crée rien et n'écrase rien au second passage", async () => {
    await initialiserCreations(racine);
    const styleModifie = "# Mon style de vlog\n";
    await writeFile(join(racine, "guides/vlog/style.md"), styleModifie, "utf8");
    await writeFile(join(racine, "parametres.json"), "{}", "utf8");

    const { crees } = await initialiserCreations(racine);

    expect(crees).toEqual([]);
    expect(await readFile(join(racine, "guides/vlog/style.md"), "utf8")).toBe(styleModifie);
    expect(await readFile(join(racine, "parametres.json"), "utf8")).toBe("{}");
  });

  it("recrée seulement ce qui manque", async () => {
    await initialiserCreations(racine);
    await rm(join(racine, "corbeille"), { recursive: true });
    await rm(join(racine, "guides/podcast/hooks.md"));

    const { crees } = await initialiserCreations(racine);

    expect(crees.sort()).toEqual(["corbeille/", "guides/podcast/hooks.md"]);
  });
});
