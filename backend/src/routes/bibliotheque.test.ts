import { access, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ElementBibliotheque, NouvelAsset, ReponseBibliotheque, ReponseTeleversementAsset } from "@editeur/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { corpsAvecFichier, preparerEnvironnementTest, type EnvironnementTest } from "../test-outils.ts";

const SAISIE: Omit<NouvelAsset, "chemin"> = {
  description: "Musique d'ouverture des récits",
  etiquettes: ["generique", "epique"],
  langue: null,
  source: "externe",
  artiste: null,
  licence: "CC BY 4.0, créditer « Auteur » dans la description",
};

describe("routes de la bibliothèque", () => {
  let env: EnvironnementTest;

  beforeEach(async () => {
    env = await preparerEnvironnementTest();
  });

  afterEach(async () => {
    await env.nettoyer();
  });

  const bibliotheque = () => join(env.contexte.config.creations, "bibliotheque");
  const lireCatalogue = async (): Promise<unknown> => JSON.parse(await readFile(join(bibliotheque(), "catalogue.json"), "utf8"));

  async function televerser(chaine: string, type: string, nomFichier: string, contenu = "données") {
    return env.app.inject({
      method: "POST",
      url: `/api/bibliotheque/fichiers/${chaine}/${type}`,
      ...corpsAvecFichier(nomFichier, contenu),
    });
  }

  async function cheminTeleverse(chaine: string, type: string, nomFichier: string, contenu?: string): Promise<string> {
    const reponse = await televerser(chaine, type, nomFichier, contenu);
    expect(reponse.statusCode).toBe(200);
    return reponse.json<ReponseTeleversementAsset>().chemin;
  }

  async function ajouter(chemin: string, saisie = SAISIE) {
    return env.app.inject({ method: "POST", url: "/api/bibliotheque/assets", payload: { ...saisie, chemin } });
  }

  async function lister(): Promise<ReponseBibliotheque> {
    return (await env.app.inject({ method: "GET", url: "/api/bibliotheque" })).json<ReponseBibliotheque>();
  }

  it("range le fichier envoyé selon la chaîne et le type, puis l'ajoute au catalogue", async () => {
    const chemin = await cheminTeleverse("recits", "musique", "Ouverture Épique.MP3");
    expect(chemin).toBe("recits/musiques/ouverture-epique.mp3");
    expect(await readFile(join(bibliotheque(), "recits", "musiques", "ouverture-epique.mp3"), "utf8")).toBe("données");

    const ajout = await ajouter(chemin, { ...SAISIE, etiquettes: ["Générique", "generique", "épique"] });
    expect(ajout.statusCode).toBe(201);
    const { asset, statut } = ajout.json<ElementBibliotheque>();
    expect(asset).toEqual({
      id: "ouverture-epique",
      type: "musique",
      chaine: "recits",
      chemin,
      ...SAISIE,
      etiquettes: ["générique", "generique", "épique"],
      utilisations: [],
    });
    expect(statut).toEqual({ valide: true, problemes: [] });
    expect(await lireCatalogue()).toEqual({ assets: [asset] });
  });

  it("crée un dossier par type pour chaque chaîne", async () => {
    expect((await readdir(join(bibliotheque(), "commun"))).sort()).toEqual([
      "ambiances",
      "images",
      "musiques",
      "polices",
      "sons",
      "videos",
      "voix",
    ]);
  });

  it("refuse un type inconnu et un format qui ne correspond pas au type", async () => {
    expect((await televerser("recits", "inconnu", "a.mp3")).statusCode).toBe(400);
    expect((await televerser("recits", "musique", "image.png")).statusCode).toBe(400);
    expect((await televerser("recits", "police", "script.exe")).statusCode).toBe(400);
    expect(await readdir(join(bibliotheque(), "recits", "musiques"))).toEqual([]);
  });

  it("exige la langue d'une voix et l'ignore pour une musique", async () => {
    const voix = await cheminTeleverse("recits", "voix", "outro.wav");
    expect((await ajouter(voix, { ...SAISIE, langue: null })).statusCode).toBe(400);
    expect((await ajouter(voix, { ...SAISIE, langue: "en" })).json<ElementBibliotheque>().asset.langue).toBe("en");

    const musique = await cheminTeleverse("recits", "musique", "theme.mp3");
    expect((await ajouter(musique, { ...SAISIE, langue: "fr" })).json<ElementBibliotheque>().asset.langue).toBeNull();
  });

  it("refuse d'ajouter un fichier absent, déjà catalogué, mal rangé ou hors des dossiers prévus", async () => {
    expect((await ajouter("recits/musiques/absent.mp3")).statusCode).toBe(400);
    expect((await ajouter("recits/../../artistes")).statusCode).toBe(400);
    expect((await ajouter("commun/sons/..")).statusCode).toBe(400);
    await writeFile(join(bibliotheque(), "commun", "polices", "mauvais.mp3"), "x");
    expect((await ajouter("commun/polices/mauvais.mp3")).statusCode).toBe(400);

    const chemin = await cheminTeleverse("commun", "son", "clic.wav");
    expect((await ajouter(chemin)).statusCode).toBe(201);
    expect((await ajouter(chemin)).statusCode).toBe(409);
  });

  it("exige l'artiste et signale un accord qui ne permet pas la réutilisation", async () => {
    const chemin = await cheminTeleverse("recits", "image", "blason.png");
    expect((await ajouter(chemin, { ...SAISIE, source: "artiste", artiste: null })).statusCode).toBe(400);

    await env.app.inject({
      method: "POST",
      url: "/api/artistes",
      payload: { nom: "Aurore", liens: {}, contact: "", accord: { date: "2026-11-01", monetisation: true, reutilisationAutorisee: false } },
    });
    const { statut } = (await ajouter(chemin, { ...SAISIE, source: "artiste", artiste: "aurore" })).json<ElementBibliotheque>();
    expect(statut.problemes).toEqual(["Accord incomplet pour Aurore.", "Aurore n'autorise pas la réutilisation de ses visuels."]);
  });

  it("garde l'artiste seulement quand la source est un artiste", async () => {
    const chemin = await cheminTeleverse("creation", "image", "logo.svg");
    const { asset } = (await ajouter(chemin, { ...SAISIE, source: "utilisateur", artiste: "aurore" })).json<ElementBibliotheque>();
    expect(asset.artiste).toBeNull();
  });

  it("signale les entrées invalides et les fichiers manquants sans les perdre", async () => {
    const chemin = await cheminTeleverse("commun", "son", "clic.wav");
    const valide = {
      id: "logo-recits",
      type: "image",
      chaine: "recits",
      chemin: "recits/images/logo.png",
      description: "Logo de la chaîne Récits",
      source: "utilisateur",
      utilisations: ["2026-11-06_le-dernier-dragon"],
    };
    const invalide = { id: "Mauvais Id", type: "inconnu" };
    await writeFile(join(bibliotheque(), "catalogue.json"), JSON.stringify({ assets: [valide, invalide, "texte"] }), "utf8");

    const liste = await lister();
    expect(liste.elements).toHaveLength(1);
    expect(liste.elements[0]?.asset).toEqual({ ...valide, etiquettes: [], langue: null, artiste: null, licence: "" });
    expect(liste.elements[0]?.statut.problemes).toEqual(["Fichier introuvable : bibliotheque/recits/images/logo.png"]);
    expect(liste.invalides.map(({ position, id }) => ({ position, id }))).toEqual([
      { position: 1, id: "Mauvais Id" },
      { position: 2, id: null },
    ]);
    expect(liste.nonCatalogues).toEqual([chemin]);

    expect((await ajouter(chemin)).statusCode).toBe(201);
    const catalogue = (await lireCatalogue()) as { assets: unknown[] };
    expect(catalogue.assets.slice(0, 3)).toEqual([valide, invalide, "texte"]);
    expect(catalogue.assets).toHaveLength(4);
  });

  it("modifie la description sans toucher à l'emplacement ni aux utilisations", async () => {
    const chemin = await cheminTeleverse("recits", "video", "fin.mp4");
    await ajouter(chemin);

    const reponse = await env.app.inject({
      method: "PUT",
      url: "/api/bibliotheque/assets/fin",
      payload: { ...SAISIE, description: "Générique de fin", etiquettes: ["generique"], langue: "fr" },
    });

    expect(reponse.statusCode).toBe(200);
    expect(reponse.json<ElementBibliotheque>().asset).toEqual({
      id: "fin",
      type: "video",
      chaine: "recits",
      chemin,
      ...SAISIE,
      description: "Générique de fin",
      etiquettes: ["generique"],
      langue: "fr",
      utilisations: [],
    });
  });

  it("donne un identifiant unique quand deux fichiers ont le même nom", async () => {
    const premier = await cheminTeleverse("creation", "musique", "theme.mp3");
    const second = await cheminTeleverse("recits", "musique", "theme.mp3");
    expect((await ajouter(premier)).json<ElementBibliotheque>().asset.id).toBe("theme");
    expect((await ajouter(second)).json<ElementBibliotheque>().asset.id).toBe("theme-2");
  });

  it("met le fichier à la corbeille et le retire du catalogue, sauf s'il a servi", async () => {
    const chemin = await cheminTeleverse("commun", "son", "clic.wav");
    await ajouter(chemin);

    const reponse = await env.app.inject({ method: "DELETE", url: "/api/bibliotheque/assets/clic" });
    expect(reponse.statusCode).toBe(200);
    const { corbeille } = reponse.json<{ corbeille: string }>();
    expect(corbeille).toMatch(/^corbeille\/bibliotheque\/clic\.wav_/);
    await expect(access(join(env.contexte.config.creations, corbeille))).resolves.toBeUndefined();
    expect(await lireCatalogue()).toEqual({ assets: [] });

    await ajouter(await cheminTeleverse("commun", "son", "bip.wav"));
    const catalogue = (await lireCatalogue()) as { assets: Record<string, unknown>[] };
    await writeFile(
      join(bibliotheque(), "catalogue.json"),
      JSON.stringify({ assets: catalogue.assets.map((asset) => ({ ...asset, utilisations: ["2026-11-06_le-dernier-dragon"] })) }),
      "utf8",
    );
    expect((await env.app.inject({ method: "DELETE", url: "/api/bibliotheque/assets/bip" })).statusCode).toBe(409);
  });

  it("répond 404 pour un asset inconnu et signale un catalogue abîmé", async () => {
    expect((await env.app.inject({ method: "GET", url: "/api/bibliotheque/assets/inconnu" })).statusCode).toBe(404);
    await writeFile(join(bibliotheque(), "catalogue.json"), "{ abîmé", "utf8");
    const reponse = await env.app.inject({ method: "GET", url: "/api/bibliotheque" });
    expect(reponse.statusCode).toBe(500);
    expect(reponse.json<{ erreur: string }>().erreur).toMatch(/^catalogue\.json n'est pas un JSON valide/);
  });

  it("sert un extrait de fichier pour la lecture en continu", async () => {
    const chemin = await cheminTeleverse("recits", "musique", "theme.mp3", "0123456789");
    const partiel = await env.app.inject({
      method: "GET",
      url: `/api/fichiers/bibliotheque/${chemin}`,
      headers: { range: "bytes=2-5" },
    });
    expect(partiel.statusCode).toBe(206);
    expect(partiel.body).toBe("2345");
    expect(partiel.headers["content-range"]).toBe("bytes 2-5/10");
  });
});
