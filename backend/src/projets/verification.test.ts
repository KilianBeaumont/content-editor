import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReponseCreationProjet, SaisieAutorisation, SaisieProjet, VerificationExport } from "@editeur/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { corpsAvecFichier, preparerEnvironnementTest, type EnvironnementTest } from "../test-outils.ts";

const AUTORISATION: SaisieAutorisation = {
  obtenue: true,
  date: "2026-11-01",
  lecture: true,
  traductionAnglaise: true,
  monetisation: true,
  plateformes: ["youtube", "spotify", "deezer", "apple-podcasts", "tiktok", "instagram"],
};

const RECIT: SaisieProjet = {
  chaine: "recits",
  categorie: "recit",
  titre: { fr: "Le dernier dragon", en: "The Last Dragon" },
  datePublicationPrevue: "2026-11-06",
  anglais: true,
  sorties: ["youtube", "youtube-piste-en", "podcast-fr", "podcast-en", "formats-courts"],
  nombreFormatsCourts: 2,
  consignes: { intention: "", dureeViseeMinutes: null, aGarder: "", aEviter: "" },
  fichiers: [],
  auteur: { id: "leon", nom: "", source: "", estUtilisateur: false },
  autorisation: AUTORISATION,
  artistes: [],
  assetsBibliotheque: [],
  futurRoman: false,
};

describe("vérification avant export", () => {
  let env: EnvironnementTest;

  beforeEach(async () => {
    env = await preparerEnvironnementTest();
    await env.app.inject({ method: "POST", url: "/api/auteurs", payload: { nom: "Léon", liens: {}, contact: "" } });
  });

  afterEach(async () => {
    await env.nettoyer();
  });

  async function creerArtiste(nom: string, accord: { monetisation: boolean; reutilisationAutorisee: boolean }, preuve = true) {
    const { id } = (
      await env.app.inject({ method: "POST", url: "/api/artistes", payload: { nom, liens: {}, contact: "", accord: { date: "2026-11-01", ...accord } } })
    ).json<{ id: string }>();
    if (preuve) {
      await env.app.inject({ method: "POST", url: `/api/artistes/${id}/preuve`, ...corpsAvecFichier("accord.png", "ok") });
    }
    return id;
  }

  async function creer(saisie: SaisieProjet, preuve = true): Promise<string> {
    const reponse = await env.app.inject({ method: "POST", url: "/api/projets", payload: saisie });
    expect(reponse.statusCode).toBe(201);
    const { projet } = reponse.json<ReponseCreationProjet>();
    if (preuve && projet.metadata.autorisation !== null) {
      await env.app.inject({ method: "POST", url: `/api/projets/${projet.id}/autorisation/preuve`, ...corpsAvecFichier("accord.png", "ok") });
    }
    return projet.id;
  }

  async function verifier(id: string): Promise<VerificationExport> {
    return (await env.app.inject({ method: "GET", url: `/api/projets/${id}/verification` })).json<VerificationExport>();
  }

  const messages = (verification: VerificationExport) => verification.problemes.map(({ niveau, message }) => `${niveau} : ${message}`);

  it("autorise l'export d'un récit en règle avec un artiste en règle", async () => {
    const artiste = await creerArtiste("Aurore", { monetisation: true, reutilisationAutorisee: false });
    const id = await creer({ ...RECIT, artistes: [artiste] });
    expect(await verifier(id)).toEqual({ exportable: true, sortiesBloquees: [], problemes: [] });
  });

  it("autorise l'export d'un vlog sans auteur ni artiste", async () => {
    const id = await creer({ ...RECIT, chaine: "creation", categorie: "vlog", anglais: false, sorties: ["youtube"], auteur: null, autorisation: null });
    expect(await verifier(id)).toEqual({ exportable: true, sortiesBloquees: [], problemes: [] });
  });

  it("bloque tout si l'autorisation n'est pas obtenue", async () => {
    const verification = await verifier(await creer({ ...RECIT, autorisation: { ...AUTORISATION, obtenue: false } }));
    expect(verification.exportable).toBe(false);
    expect(verification.sortiesBloquees).toEqual(RECIT.sorties);
    expect(messages(verification)).toEqual(["blocage : Autorisation de Léon non obtenue."]);
  });

  it("bloque tout sans preuve, ou si la preuve a disparu", async () => {
    const sansPreuve = await creer(RECIT, false);
    expect(messages(await verifier(sansPreuve))).toEqual(["blocage : Preuve de l'autorisation de Léon manquante."]);

    const avecPreuve = await creer({ ...RECIT, titre: { fr: "Autre récit", en: "Other" } });
    await rm(join(env.contexte.config.creations, "chaine-recits", avecPreuve, "autorisation", "accord.png"));
    expect(messages(await verifier(avecPreuve))).toEqual(["blocage : Fichier de preuve introuvable : autorisation/accord.png"]);
  });

  it("bloque seulement les sorties anglaises sans accord de traduction", async () => {
    const verification = await verifier(await creer({ ...RECIT, autorisation: { ...AUTORISATION, traductionAnglaise: false } }));
    expect(verification.exportable).toBe(false);
    expect(verification.sortiesBloquees).toEqual(["youtube-piste-en", "podcast-en"]);
    expect(verification.problemes).toEqual([
      { niveau: "blocage", message: "Léon n'a pas autorisé la traduction anglaise.", sorties: ["youtube-piste-en", "podcast-en"] },
    ]);
  });

  it("bloque une sortie sans plateforme autorisée et avertit pour une plateforme manquante", async () => {
    const verification = await verifier(await creer({ ...RECIT, autorisation: { ...AUTORISATION, plateformes: ["youtube", "tiktok"] } }));
    expect(verification.sortiesBloquees).toEqual(["podcast-fr", "podcast-en"]);
    expect(messages(verification)).toEqual([
      "blocage : Podcast FR : aucune plateforme autorisée par Léon (Spotify, Deezer, Apple Podcasts).",
      "blocage : Podcast EN : aucune plateforme autorisée par Léon (Spotify, Deezer, Apple Podcasts).",
      "avertissement : Formats courts : publication non autorisée sur Instagram.",
    ]);
  });

  it("ne fait qu'avertir quand la monétisation n'est pas accordée", async () => {
    const artiste = await creerArtiste("Aurore", { monetisation: false, reutilisationAutorisee: false });
    const verification = await verifier(await creer({ ...RECIT, artistes: [artiste], autorisation: { ...AUTORISATION, monetisation: false } }));
    expect(verification.exportable).toBe(true);
    expect(messages(verification)).toEqual([
      "avertissement : Léon n'a pas accepté la monétisation : la vidéo ne doit pas être monétisée.",
      "avertissement : Aurore n'a pas accepté la monétisation : la vidéo ne doit pas être monétisée.",
    ]);
  });

  it("bloque un artiste sans preuve d'accord et un dossier d'artiste sans fiche", async () => {
    const artiste = await creerArtiste("Aurore", { monetisation: true, reutilisationAutorisee: false }, false);
    const id = await creer({ ...RECIT, artistes: [artiste] });
    const assets = join(env.contexte.config.creations, "chaine-recits", id, "assets");
    await mkdir(join(assets, "inconnue"));
    await writeFile(join(assets, "inconnue", "dessin.png"), "x");
    await mkdir(join(assets, "vide"));

    expect(messages(await verifier(id))).toEqual([
      "blocage : Accord incomplet pour Aurore : Preuve de l'accord manquante.",
      "blocage : assets/inconnue/ : aucune fiche d'artiste à ce nom. Les sous-dossiers d'assets/ sont réservés aux visuels d'artistes.",
    ]);
  });

  it("bloque un visuel d'artiste de la bibliothèque dont la réutilisation n'est pas autorisée", async () => {
    const artiste = await creerArtiste("Aurore", { monetisation: true, reutilisationAutorisee: false });
    const { chemin } = (
      await env.app.inject({ method: "POST", url: "/api/bibliotheque/fichiers/recits/image", ...corpsAvecFichier("blason.png", "x") })
    ).json<{ chemin: string }>();
    await env.app.inject({
      method: "POST",
      url: "/api/bibliotheque/assets",
      payload: { chemin, description: "", etiquettes: [], langue: null, source: "artiste", artiste, licence: "" },
    });

    const verification = await verifier(await creer({ ...RECIT, assetsBibliotheque: ["blason"] }));
    expect(messages(verification)).toEqual(["blocage : Asset blason.png : Aurore n'autorise pas la réutilisation de ses visuels."]);
  });

  it("avertit quand une histoire personnelle n'a pas de signature", async () => {
    const id = await creer({ ...RECIT, auteur: { id: null, nom: "", source: "", estUtilisateur: true }, autorisation: null });
    const verification = await verifier(id);
    expect(verification.exportable).toBe(true);
    expect(messages(verification)).toEqual([
      "avertissement : Signature manquante : la vidéo doit commencer par « Une histoire originale de … ».",
    ]);
  });
});
