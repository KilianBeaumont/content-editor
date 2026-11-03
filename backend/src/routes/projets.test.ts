import { access, mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Artiste, Auteur, MetadataProjet, Projet, ReponseCreationProjet, SaisieProjet } from "@editeur/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { creerProjet } from "../projets/projets.ts";
import { corpsAvecFichier, preparerEnvironnementTest, type EnvironnementTest } from "../test-outils.ts";

const VLOG: SaisieProjet = {
  chaine: "creation",
  categorie: "vlog",
  titre: { fr: "Première carte", en: null },
  datePublicationPrevue: "2026-11-08",
  anglais: false,
  sorties: ["youtube", "formats-courts"],
  nombreFormatsCourts: 3,
  consignes: { intention: "Montrer la carte de l'esquisse à la couleur", dureeViseeMinutes: 8, aGarder: "", aEviter: "" },
  fichiers: [
    { chemin: "C0001.MP4", destination: "rushes", note: "bonne prise vers 3:20" },
    { chemin: "carte.png", destination: "assets", note: "" },
  ],
  auteur: null,
  autorisation: null,
  artistes: [],
  assetsBibliotheque: [],
  futurRoman: false,
  vocabulaire: "",
};

const RECIT: SaisieProjet = {
  chaine: "recits",
  categorie: "recit",
  titre: { fr: "Le dernier dragon", en: "The Last Dragon" },
  datePublicationPrevue: "2026-11-06",
  anglais: true,
  sorties: ["youtube", "youtube-piste-en", "podcast-fr", "podcast-en"],
  nombreFormatsCourts: null,
  consignes: { intention: "", dureeViseeMinutes: null, aGarder: "", aEviter: "" },
  fichiers: [
    { chemin: "voix fr.wav", destination: "voix/fr", note: "" },
    { chemin: "voix en.wav", destination: "voix/en", note: "" },
    { chemin: "dragon.png", destination: "assets/aurore", note: "illustration principale" },
  ],
  auteur: { id: "leon-vasseur", nom: "", source: "https://www.reddit.com/r/fantasy/1", estUtilisateur: false },
  autorisation: {
    obtenue: true,
    date: "2026-11-01",
    lecture: true,
    traductionAnglaise: true,
    monetisation: true,
    plateformes: ["youtube", "spotify"],
  },
  artistes: ["aurore"],
  assetsBibliotheque: ["generique"],
  futurRoman: false,
  vocabulaire: "",
};

describe("création de projet", () => {
  let env: EnvironnementTest;

  beforeEach(async () => {
    env = await preparerEnvironnementTest();
  });

  afterEach(async () => {
    await env.nettoyer();
  });

  const creations = () => env.contexte.config.creations;
  const inbox = () => join(creations(), "inbox");

  async function deposer(...noms: string[]) {
    for (const nom of noms) {
      await mkdir(join(inbox(), nom, ".."), { recursive: true });
      await writeFile(join(inbox(), nom), `contenu de ${nom}`);
    }
  }

  async function creer(saisie: SaisieProjet) {
    return env.app.inject({ method: "POST", url: "/api/projets", payload: saisie });
  }

  async function preparerRecit() {
    await deposer("voix fr.wav", "voix en.wav", "dragon.png");
    await env.app.inject({ method: "POST", url: "/api/auteurs", payload: { nom: "Léon Vasseur", liens: {}, contact: "" } });
    await env.app.inject({
      method: "POST",
      url: "/api/artistes",
      payload: { nom: "Aurore", liens: {}, contact: "", accord: { date: "2026-11-01", monetisation: true, reutilisationAutorisee: false } },
    });
    const chemin = (
      await env.app.inject({ method: "POST", url: "/api/bibliotheque/fichiers/recits/video", ...corpsAvecFichier("generique.mp4", "x") })
    ).json<{ chemin: string }>().chemin;
    await env.app.inject({
      method: "POST",
      url: "/api/bibliotheque/assets",
      payload: { chemin, description: "", etiquettes: [], langue: null, source: "utilisateur", artiste: null, licence: "" },
    });
  }

  it("crée un vlog, déplace les fichiers de l'inbox et écrit metadata.json", async () => {
    await deposer("C0001.MP4", "carte.png");
    const reponse = await creer(VLOG);
    expect(reponse.statusCode).toBe(201);
    const { projet, avertissements } = reponse.json<ReponseCreationProjet>();

    expect(projet.id).toBe("2026-11-08_premiere-carte");
    expect(projet.chemin).toBe("chaine-creation/2026-11-08_premiere-carte");
    expect(avertissements).toEqual([]);
    const dossier = join(creations(), projet.chemin);
    expect((await readdir(dossier)).sort()).toEqual(["assets", "exports", "metadata.json", "rushes", "travail", "versions"]);
    expect((await readdir(join(dossier, "exports"))).sort()).toEqual(["formats-courts", "youtube"]);
    expect(await readFile(join(dossier, "rushes", "C0001.MP4"), "utf8")).toBe("contenu de C0001.MP4");
    expect(await readdir(inbox())).toEqual([]);

    const metadata = JSON.parse(await readFile(join(dossier, "metadata.json"), "utf8")) as MetadataProjet;
    expect(metadata).toMatchObject({
      categorie: "vlog",
      chaine: "creation",
      titre: { fr: "Première carte", en: null },
      langues: ["fr"],
      sorties: ["youtube", "formats-courts"],
      nombreFormatsCourts: 3,
      auteur: null,
      autorisation: null,
      consignes: VLOG.consignes,
      fichiers: [
        { chemin: "rushes/C0001.MP4", origine: "inbox/C0001.MP4", note: "bonne prise vers 3:20" },
        { chemin: "assets/carte.png", origine: "inbox/carte.png", note: "" },
      ],
    });

    const lu = (await env.app.inject({ method: "GET", url: `/api/projets/${projet.id}` })).json<Projet>();
    expect(lu.metadata).toEqual(metadata);
  });

  it("crée un récit bilingue et met à jour l'auteur, l'artiste et la bibliothèque", async () => {
    await preparerRecit();
    const reponse = await creer(RECIT);
    expect(reponse.statusCode).toBe(201);
    const { projet } = reponse.json<ReponseCreationProjet>();
    const dossier = join(creations(), projet.chemin);

    expect(projet.chemin).toBe("chaine-recits/2026-11-06_le-dernier-dragon");
    expect((await readdir(join(dossier, "voix"))).sort()).toEqual(["en", "fr"]);
    await expect(access(join(dossier, "voix", "en", "voix en.wav"))).resolves.toBeUndefined();
    await expect(access(join(dossier, "assets", "aurore", "dragon.png"))).resolves.toBeUndefined();
    await expect(access(join(dossier, "autorisation"))).resolves.toBeUndefined();
    expect((await readdir(join(dossier, "exports"))).sort()).toEqual(["podcast-en", "podcast-fr", "youtube", "youtube-piste-en"]);
    expect(projet.metadata.auteur).toEqual({ ...RECIT.auteur, nom: "Léon Vasseur" });
    expect(projet.metadata.autorisation).toEqual({ ...RECIT.autorisation, preuve: null });
    expect(projet.metadata.langues).toEqual(["fr", "en"]);

    const auteur = (await env.app.inject({ method: "GET", url: "/api/auteurs/leon-vasseur" })).json<Auteur>();
    expect(auteur.fiche.recits).toEqual([projet.id]);
    const artiste = (await env.app.inject({ method: "GET", url: "/api/artistes/aurore" })).json<Artiste>();
    expect(artiste.fiche.videos).toEqual([projet.id]);
    const asset = (await env.app.inject({ method: "GET", url: "/api/bibliotheque/assets/generique" })).json<{ asset: { utilisations: string[] } }>();
    expect(asset.asset.utilisations).toEqual([projet.id]);

    const preuve = await env.app.inject({
      method: "POST",
      url: `/api/projets/${projet.id}/autorisation/preuve`,
      ...corpsAvecFichier("Message Léon.png", "capture"),
    });
    expect(preuve.statusCode).toBe(200);
    expect(preuve.json<Projet>().metadata.autorisation?.preuve).toBe("autorisation/message-leon.png");
    await expect(access(join(dossier, "autorisation", "message-leon.png"))).resolves.toBeUndefined();
  });

  it("refuse un projet du même nom, même sur l'autre chaîne", async () => {
    await deposer("C0001.MP4", "carte.png");
    expect((await creer(VLOG)).statusCode).toBe(201);
    await deposer("autre.mp4");
    const doublon = await creer({ ...VLOG, chaine: "recits", categorie: "micro-histoire", sorties: ["formats-courts"], fichiers: [], auteur: { id: null, nom: "", source: "", estUtilisateur: true } });
    expect(doublon.statusCode).toBe(409);
  });

  it("refuse les saisies incohérentes sans rien déplacer", async () => {
    await deposer("C0001.MP4", "carte.png");
    const cas: SaisieProjet[] = [
      { ...VLOG, categorie: "recit" },
      { ...VLOG, sorties: ["podcast-fr"] },
      { ...VLOG, fichiers: [{ chemin: "absent.mp4", destination: "rushes", note: "" }] },
      { ...VLOG, fichiers: [{ chemin: "C0001.MP4", destination: "voix/fr", note: "" }] },
      { ...VLOG, fichiers: [{ chemin: "../parametres.json", destination: "rushes", note: "" }] },
      { ...VLOG, nombreFormatsCourts: null },
      { ...RECIT, fichiers: [], artistes: [], assetsBibliotheque: [], auteur: null },
      { ...RECIT, fichiers: [], artistes: [], assetsBibliotheque: [], anglais: false, sorties: ["podcast-en"] },
    ];
    for (const saisie of cas) {
      expect((await creer(saisie)).statusCode).toBe(400);
    }
    expect((await readdir(inbox())).sort()).toEqual(["C0001.MP4", "carte.png"]);
    expect(await readdir(join(creations(), "chaine-creation"))).toEqual([]);
  });

  it("numérote deux fichiers du même nom venant de sous-dossiers différents", async () => {
    await deposer("carte A/C0001.MP4", "carte B/C0001.MP4");
    const { projet } = await creerProjet(creations(), {
      ...VLOG,
      fichiers: [
        { chemin: "carte A/C0001.MP4", destination: "rushes", note: "" },
        { chemin: "carte B/C0001.MP4", destination: "rushes", note: "" },
      ],
    });
    expect(projet.metadata.fichiers.map(({ chemin }) => chemin)).toEqual(["rushes/C0001.MP4", "rushes/C0001 (2).MP4"]);
    expect(await readFile(join(creations(), projet.chemin, "rushes", "C0001 (2).MP4"), "utf8")).toBe("contenu de carte B/C0001.MP4");
  });

  it("copie puis vérifie avant de supprimer l'original quand l'inbox est sur un autre disque", async () => {
    await deposer("C0001.MP4", "carte.png");
    const autreDisque = () => Promise.reject(Object.assign(new Error("cross-device link not permitted"), { code: "EXDEV" }));
    const { projet } = await creerProjet(creations(), VLOG, autreDisque);
    expect(await readFile(join(creations(), projet.chemin, "rushes", "C0001.MP4"), "utf8")).toBe("contenu de C0001.MP4");
    expect(await readdir(inbox())).toEqual([]);
  });

  it("remet tout dans l'inbox si un déplacement échoue au milieu", async () => {
    await deposer("C0001.MP4", "carte.png");
    const panne = async (source: string, cible: string) => {
      if (source.endsWith("carte.png")) throw Object.assign(new Error("disque plein"), { code: "ENOSPC" });
      await rename(source, cible);
    };
    await expect(creerProjet(creations(), VLOG, panne)).rejects.toThrow(
      /Impossible de déplacer carte\.png : disque plein\nRien n'a été créé/,
    );
    expect((await readdir(inbox())).sort()).toEqual(["C0001.MP4", "carte.png"]);
    expect(await readFile(join(inbox(), "C0001.MP4"), "utf8")).toBe("contenu de C0001.MP4");
    expect(await readdir(join(creations(), "chaine-creation"))).toEqual([]);
  });
});
