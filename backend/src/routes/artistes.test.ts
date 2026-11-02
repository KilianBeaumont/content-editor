import { access, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { TAILLE_MAX_PREUVE, type Artiste, type ReponseListeArtistes, type SaisieArtiste } from "@editeur/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { corpsAvecFichier, preparerEnvironnementTest, type EnvironnementTest } from "../test-outils.ts";

const SAISIE: SaisieArtiste = {
  nom: "Élise Moreau",
  liens: { instagram: "https://instagram.com/elise", site: "https://elise.art" },
  contact: "elise@exemple.fr",
  accord: { date: "2026-11-01", monetisation: true, reutilisationAutorisee: false },
};

describe("routes des artistes", () => {
  let env: EnvironnementTest;

  beforeEach(async () => {
    env = await preparerEnvironnementTest();
  });

  afterEach(async () => {
    await env.nettoyer();
  });

  const dossierArtistes = () => join(env.contexte.config.creations, "artistes");

  async function creer(saisie: SaisieArtiste = SAISIE): Promise<Artiste> {
    const reponse = await env.app.inject({ method: "POST", url: "/api/artistes", payload: saisie });
    expect(reponse.statusCode).toBe(201);
    return reponse.json<Artiste>();
  }

  async function envoyerPreuve(id: string, nomFichier: string, contenu: Buffer | string = "contenu de la preuve") {
    return env.app.inject({ method: "POST", url: `/api/artistes/${id}/preuve`, ...corpsAvecFichier(nomFichier, contenu) });
  }

  it("crée une fiche dans un dossier au nom sans accents", async () => {
    const artiste = await creer();

    expect(artiste.id).toBe("elise-moreau");
    expect(artiste.fiche).toEqual({ ...SAISIE, accord: { ...SAISIE.accord, preuve: null }, videos: [] });
    expect(artiste.statut).toEqual({ valide: false, problemes: ["Preuve de l'accord manquante."] });
    await expect(access(join(dossierArtistes(), "elise-moreau", "accord"))).resolves.toBeUndefined();
    const fiche: unknown = JSON.parse(await readFile(join(dossierArtistes(), "elise-moreau", "fiche.json"), "utf8"));
    expect(fiche).toEqual(artiste.fiche);
  });

  it("refuse un doublon", async () => {
    await creer();
    const reponse = await env.app.inject({ method: "POST", url: "/api/artistes", payload: { ...SAISIE, nom: "ELISE moreau" } });
    expect(reponse.statusCode).toBe(409);
  });

  it("refuse un lien qui n'est pas une adresse web", async () => {
    const reponse = await env.app.inject({
      method: "POST",
      url: "/api/artistes",
      payload: { ...SAISIE, liens: { site: "javascript:alert(1)" } },
    });
    expect(reponse.statusCode).toBe(400);
  });

  it("enregistre la preuve et valide l'accord", async () => {
    await creer();
    const reponse = await envoyerPreuve("elise-moreau", "Capture d'écran 2026.PNG");

    expect(reponse.statusCode).toBe(200);
    const artiste = reponse.json<Artiste>();
    expect(artiste.fiche.accord.preuve).toBe("accord/capture-d-ecran-2026.png");
    expect(artiste.statut).toEqual({ valide: true, problemes: [] });

    const fichier = await env.app.inject({ method: "GET", url: "/api/fichiers/artistes/elise-moreau/accord/capture-d-ecran-2026.png" });
    expect(fichier.statusCode).toBe(200);
    expect(fichier.body).toBe("contenu de la preuve");

    const partiel = await env.app.inject({
      method: "GET",
      url: "/api/fichiers/artistes/elise-moreau/accord/capture-d-ecran-2026.png",
      headers: { range: "bytes=0-6" },
    });
    expect(partiel.statusCode).toBe(206);
    expect(partiel.body).toBe("contenu");
  });

  it("garde les anciennes preuves quand on en envoie une nouvelle", async () => {
    await creer();
    await envoyerPreuve("elise-moreau", "accord.pdf", "première");
    const reponse = await envoyerPreuve("elise-moreau", "accord.pdf", "seconde");

    expect(reponse.json<Artiste>().fiche.accord.preuve).toBe("accord/accord-2.pdf");
    expect((await readdir(join(dossierArtistes(), "elise-moreau", "accord"))).sort()).toEqual(["accord-2.pdf", "accord.pdf"]);
  });

  it("refuse un format de preuve non prévu", async () => {
    await creer();
    const reponse = await envoyerPreuve("elise-moreau", "programme.exe");
    expect(reponse.statusCode).toBe(400);
    expect(await readdir(join(dossierArtistes(), "elise-moreau", "accord"))).toEqual([]);
  });

  it("refuse une preuve trop volumineuse au lieu de l'enregistrer tronquée", async () => {
    await creer();
    const reponse = await envoyerPreuve("elise-moreau", "accord.pdf", Buffer.alloc(TAILLE_MAX_PREUVE + 1024));
    expect(reponse.statusCode).toBe(413);
    expect(reponse.json()).toEqual({ erreur: "Fichier trop volumineux." });
    expect(await readdir(join(dossierArtistes(), "elise-moreau", "accord"))).toEqual([]);
  });

  it("signale une preuve supprimée à la main", async () => {
    await creer();
    await envoyerPreuve("elise-moreau", "accord.png");
    await rm(join(dossierArtistes(), "elise-moreau", "accord", "accord.png"));

    const artiste = (await env.app.inject({ method: "GET", url: "/api/artistes/elise-moreau" })).json<Artiste>();
    expect(artiste.statut).toEqual({ valide: false, problemes: ["Fichier de preuve introuvable : accord/accord.png"] });
  });

  it("modifie la fiche sans perdre la preuve ni l'historique des vidéos", async () => {
    await creer();
    await envoyerPreuve("elise-moreau", "accord.png");
    const chemin = join(dossierArtistes(), "elise-moreau", "fiche.json");
    const fiche = JSON.parse(await readFile(chemin, "utf8")) as Artiste["fiche"];
    await writeFile(chemin, JSON.stringify({ ...fiche, videos: ["2026-11-06_le-dernier-dragon"] }), "utf8");

    const reponse = await env.app.inject({
      method: "PUT",
      url: "/api/artistes/elise-moreau",
      payload: { ...SAISIE, nom: "Élise M.", accord: { ...SAISIE.accord, reutilisationAutorisee: true } },
    });

    const artiste = reponse.json<Artiste>();
    expect(artiste.id).toBe("elise-moreau");
    expect(artiste.fiche.nom).toBe("Élise M.");
    expect(artiste.fiche.accord).toEqual({ ...SAISIE.accord, reutilisationAutorisee: true, preuve: "accord/accord.png" });
    expect(artiste.fiche.videos).toEqual(["2026-11-06_le-dernier-dragon"]);
  });

  it("liste les fiches et signale celles qui sont illisibles", async () => {
    await creer();
    await creer({ ...SAISIE, nom: "Aurore" });
    await mkdir(join(dossierArtistes(), "fiche-abimee"));
    await writeFile(join(dossierArtistes(), "fiche-abimee", "fiche.json"), "{ abîmé", "utf8");
    await mkdir(join(dossierArtistes(), "Nom Avec Espaces"));

    const liste = (await env.app.inject({ method: "GET", url: "/api/artistes" })).json<ReponseListeArtistes>();

    expect(liste.artistes.map((artiste) => artiste.id)).toEqual(["aurore", "elise-moreau"]);
    expect(liste.illisibles.map((illisible) => illisible.id).sort()).toEqual(["Nom Avec Espaces", "fiche-abimee"]);
  });

  it("refuse de supprimer un artiste qui a participé à une vidéo", async () => {
    await creer();
    const chemin = join(dossierArtistes(), "elise-moreau", "fiche.json");
    const fiche = JSON.parse(await readFile(chemin, "utf8")) as Artiste["fiche"];
    await writeFile(chemin, JSON.stringify({ ...fiche, videos: ["2026-11-06_le-dernier-dragon"] }), "utf8");

    const reponse = await env.app.inject({ method: "DELETE", url: "/api/artistes/elise-moreau" });
    expect(reponse.statusCode).toBe(409);
    await expect(access(chemin)).resolves.toBeUndefined();
  });

  it("met à la corbeille un artiste sans vidéo", async () => {
    await creer();
    const reponse = await env.app.inject({ method: "DELETE", url: "/api/artistes/elise-moreau" });

    expect(reponse.statusCode).toBe(200);
    const { corbeille } = reponse.json<{ corbeille: string }>();
    expect(corbeille).toMatch(/^corbeille\/artistes\/elise-moreau_/);
    await expect(access(join(env.contexte.config.creations, corbeille, "fiche.json"))).resolves.toBeUndefined();
    expect(await readdir(dossierArtistes())).toEqual([]);
  });

  it("refuse les identifiants et chemins qui sortiraient des dossiers prévus", async () => {
    expect((await env.app.inject({ method: "GET", url: "/api/artistes/..%2F..%2Fdepot" })).statusCode).toBe(404);
    const remontee = await env.app.inject({ method: "GET", url: "/api/fichiers/artistes%2F..%2F..%2Fdepot%2Fconfig.local.json" });
    expect(remontee.statusCode).toBe(400);
    expect(remontee.json()).toEqual({ erreur: "Chemin interdit : artistes/../../depot/config.local.json" });
    expect((await env.app.inject({ method: "GET", url: "/api/fichiers/%2e%2e/depot/config.local.json" })).statusCode).toBe(404);
    expect((await env.app.inject({ method: "GET", url: "/api/fichiers/artistes/inconnu.png" })).statusCode).toBe(404);
  });
});
