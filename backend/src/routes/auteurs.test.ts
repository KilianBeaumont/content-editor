import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Auteur, ReponseListeAuteurs, SaisieAuteur } from "@editeur/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { preparerEnvironnementTest, type EnvironnementTest } from "../test-outils.ts";

const SAISIE: SaisieAuteur = {
  nom: "Léon Vasseur",
  liens: { reddit: "https://www.reddit.com/user/leon" },
  contact: "leon@exemple.fr",
};

describe("routes des auteurs", () => {
  let env: EnvironnementTest;

  beforeEach(async () => {
    env = await preparerEnvironnementTest();
  });

  afterEach(async () => {
    await env.nettoyer();
  });

  const dossierAuteurs = () => join(env.contexte.config.creations, "auteurs");

  async function creer(saisie: SaisieAuteur = SAISIE): Promise<Auteur> {
    const reponse = await env.app.inject({ method: "POST", url: "/api/auteurs", payload: saisie });
    expect(reponse.statusCode).toBe(201);
    return reponse.json<Auteur>();
  }

  async function ajouterRecit(id: string, recit: string) {
    const chemin = join(dossierAuteurs(), id, "fiche.json");
    const fiche = JSON.parse(await readFile(chemin, "utf8")) as Auteur["fiche"];
    await writeFile(chemin, JSON.stringify({ ...fiche, recits: [...fiche.recits, recit] }), "utf8");
  }

  it("crée une fiche dans un dossier au nom sans accents", async () => {
    const auteur = await creer();

    expect(auteur).toEqual({ id: "leon-vasseur", fiche: { ...SAISIE, recits: [] } });
    const fiche: unknown = JSON.parse(await readFile(join(dossierAuteurs(), "leon-vasseur", "fiche.json"), "utf8"));
    expect(fiche).toEqual(auteur.fiche);
  });

  it("refuse un doublon et un nom vide", async () => {
    await creer();
    const doublon = await env.app.inject({ method: "POST", url: "/api/auteurs", payload: { ...SAISIE, nom: "LÉON VASSEUR" } });
    expect(doublon.statusCode).toBe(409);
    const vide = await env.app.inject({ method: "POST", url: "/api/auteurs", payload: { ...SAISIE, nom: " !? " } });
    expect(vide.statusCode).toBe(400);
  });

  it("modifie la fiche sans perdre la liste des récits", async () => {
    await creer();
    await ajouterRecit("leon-vasseur", "2026-11-06_le-dernier-dragon");

    const reponse = await env.app.inject({
      method: "PUT",
      url: "/api/auteurs/leon-vasseur",
      payload: { ...SAISIE, nom: "Léon V.", liens: {} },
    });

    expect(reponse.json<Auteur>()).toEqual({
      id: "leon-vasseur",
      fiche: { ...SAISIE, nom: "Léon V.", liens: {}, recits: ["2026-11-06_le-dernier-dragon"] },
    });
  });

  it("liste les fiches triées et signale celles qui sont illisibles", async () => {
    await creer();
    await creer({ ...SAISIE, nom: "Anna" });
    await mkdir(join(dossierAuteurs(), "sans-fiche"));

    const liste = (await env.app.inject({ method: "GET", url: "/api/auteurs" })).json<ReponseListeAuteurs>();

    expect(liste.auteurs.map((auteur) => auteur.id)).toEqual(["anna", "leon-vasseur"]);
    expect(liste.illisibles).toEqual([{ id: "sans-fiche", erreur: "fiche.json manquant." }]);
  });

  it("refuse de supprimer un auteur qui a des récits", async () => {
    await creer();
    await ajouterRecit("leon-vasseur", "2026-11-06_le-dernier-dragon");

    const reponse = await env.app.inject({ method: "DELETE", url: "/api/auteurs/leon-vasseur" });
    expect(reponse.statusCode).toBe(409);
    await expect(access(join(dossierAuteurs(), "leon-vasseur", "fiche.json"))).resolves.toBeUndefined();
  });

  it("met à la corbeille un auteur sans récit", async () => {
    await creer();
    const reponse = await env.app.inject({ method: "DELETE", url: "/api/auteurs/leon-vasseur" });

    const { corbeille } = reponse.json<{ corbeille: string }>();
    expect(corbeille).toMatch(/^corbeille\/auteurs\/leon-vasseur_/);
    await expect(access(join(env.contexte.config.creations, corbeille, "fiche.json"))).resolves.toBeUndefined();
    expect(await readdir(dossierAuteurs())).toEqual([]);
  });

  it("répond 404 pour un auteur inconnu ou un identifiant invalide", async () => {
    expect((await env.app.inject({ method: "GET", url: "/api/auteurs/inconnu" })).statusCode).toBe(404);
    expect((await env.app.inject({ method: "GET", url: "/api/auteurs/..%2F..%2Fdepot" })).statusCode).toBe(404);
  });
});
