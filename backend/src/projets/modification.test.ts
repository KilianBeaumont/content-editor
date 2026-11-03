import { access, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  Artiste,
  Auteur,
  ElementBibliotheque,
  ModificationProjet,
  Projet,
  ReponseCreationProjet,
  ReponseModificationProjet,
  SaisieProjet,
  VerificationExport,
} from "@editeur/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { corpsAvecFichier, preparerEnvironnementTest, type EnvironnementTest } from "../test-outils.ts";

const RECIT: SaisieProjet = {
  chaine: "recits",
  categorie: "recit",
  titre: { fr: "Le dernier dragon", en: null },
  datePublicationPrevue: "2026-11-06",
  anglais: false,
  sorties: ["youtube", "podcast-fr"],
  nombreFormatsCourts: null,
  consignes: { intention: "", dureeViseeMinutes: null, aGarder: "", aEviter: "" },
  fichiers: [{ chemin: "narration.wav", destination: "voix/fr", note: "première prise" }],
  auteur: { id: "leon", nom: "", source: "", estUtilisateur: false },
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

function modification(saisie: SaisieProjet, changements: Partial<ModificationProjet> = {}): ModificationProjet {
  const { chaine, fichiers, ...reste } = saisie;
  return { ...reste, description: { fr: "", en: "" }, notes: {}, ...changements };
}

describe("modification, renommage et corbeille d'un projet", () => {
  let env: EnvironnementTest;

  beforeEach(async () => {
    env = await preparerEnvironnementTest();
    await env.app.inject({ method: "POST", url: "/api/auteurs", payload: { nom: "Léon", liens: {}, contact: "" } });
    for (const nom of ["Aurore", "Basile"]) {
      await env.app.inject({
        method: "POST",
        url: "/api/artistes",
        payload: { nom, liens: {}, contact: "", accord: { date: "2026-11-01", monetisation: true, reutilisationAutorisee: true } },
      });
    }
    const { chemin } = (
      await env.app.inject({ method: "POST", url: "/api/bibliotheque/fichiers/recits/video", ...corpsAvecFichier("generique.mp4", "x") })
    ).json<{ chemin: string }>();
    await env.app.inject({
      method: "POST",
      url: "/api/bibliotheque/assets",
      payload: { chemin, description: "", etiquettes: [], langue: null, source: "utilisateur", artiste: null, licence: "" },
    });
  });

  afterEach(async () => {
    await env.nettoyer();
  });

  const creations = () => env.contexte.config.creations;
  const inbox = () => join(creations(), "inbox");

  async function creer(saisie: SaisieProjet = RECIT): Promise<Projet> {
    for (const { chemin } of saisie.fichiers) await writeFile(join(inbox(), chemin), `contenu de ${chemin}`);
    const reponse = await env.app.inject({ method: "POST", url: "/api/projets", payload: saisie });
    expect(reponse.statusCode).toBe(201);
    return reponse.json<ReponseCreationProjet>().projet;
  }

  async function modifier(id: string, corps: ModificationProjet) {
    return env.app.inject({ method: "PUT", url: `/api/projets/${id}`, payload: corps });
  }

  const artiste = async (id: string) => (await env.app.inject({ method: "GET", url: `/api/artistes/${id}` })).json<Artiste>().fiche.videos;
  const auteur = async () => (await env.app.inject({ method: "GET", url: "/api/auteurs/leon" })).json<Auteur>().fiche.recits;
  const asset = async () =>
    (await env.app.inject({ method: "GET", url: "/api/bibliotheque/assets/generique" })).json<ElementBibliotheque>().asset.utilisations;

  it("modifie les consignes, la description et les notes sans renommer", async () => {
    const projet = await creer();
    await env.app.inject({ method: "POST", url: `/api/projets/${projet.id}/autorisation/preuve`, ...corpsAvecFichier("accord.png", "ok") });

    const reponse = await modifier(
      projet.id,
      modification(RECIT, {
        consignes: { intention: "Une montée lente", dureeViseeMinutes: 12, aGarder: "", aEviter: "" },
        description: { fr: "Un dragon veille.", en: "" },
        notes: { "voix/fr/narration.wav": "la meilleure prise" },
      }),
    );
    expect(reponse.statusCode).toBe(200);
    const { projet: modifie } = reponse.json<ReponseModificationProjet>();
    expect(modifie.id).toBe(projet.id);
    expect(modifie.metadata.consignes.intention).toBe("Une montée lente");
    expect(modifie.metadata.description.fr).toBe("Un dragon veille.");
    expect(modifie.metadata.fichiers[0]?.note).toBe("la meilleure prise");
    expect(modifie.metadata.autorisation?.preuve).toBe("autorisation/accord.png");
    expect(modifie.metadata.creeLe).toBe(projet.metadata.creeLe);
  });

  it("renomme le dossier quand le titre ou la date change et met à jour les fiches liées", async () => {
    const projet = await creer();
    const reponse = await modifier(projet.id, modification(RECIT, { titre: { fr: "Le dernier dragon d'Ashkar", en: null }, datePublicationPrevue: "2026-11-13" }));
    const { projet: renomme } = reponse.json<ReponseModificationProjet>();

    expect(renomme.id).toBe("2026-11-13_le-dernier-dragon-d-ashkar");
    expect(renomme.chemin).toBe("chaine-recits/2026-11-13_le-dernier-dragon-d-ashkar");
    expect(await readdir(join(creations(), "chaine-recits"))).toEqual(["2026-11-13_le-dernier-dragon-d-ashkar"]);
    await expect(access(join(creations(), renomme.chemin, "voix", "fr", "narration.wav"))).resolves.toBeUndefined();
    expect((await env.app.inject({ method: "GET", url: `/api/projets/${projet.id}` })).statusCode).toBe(404);
    expect(await artiste("aurore")).toEqual([renomme.id]);
    expect(await auteur()).toEqual([renomme.id]);
    expect(await asset()).toEqual([renomme.id]);
  });

  it("refuse un renommage vers un projet qui existe déjà", async () => {
    const premier = await creer();
    await creer({ ...RECIT, titre: { fr: "Autre récit", en: null }, fichiers: [] });
    const reponse = await modifier(premier.id, modification(RECIT, { titre: { fr: "Autre récit", en: null } }));
    expect(reponse.statusCode).toBe(409);
  });

  it("met à jour les fiches quand on change d'artistes, d'auteur ou d'assets", async () => {
    await env.app.inject({ method: "POST", url: "/api/auteurs", payload: { nom: "Mila", liens: {}, contact: "" } });
    const projet = await creer();
    await modifier(
      projet.id,
      modification(RECIT, { artistes: ["basile"], auteur: { id: "mila", nom: "", source: "", estUtilisateur: false }, assetsBibliotheque: [] }),
    );

    expect(await artiste("aurore")).toEqual([]);
    expect(await artiste("basile")).toEqual([projet.id]);
    await expect(access(join(creations(), projet.chemin, "assets", "basile"))).resolves.toBeUndefined();
    expect(await auteur()).toEqual([]);
    expect((await env.app.inject({ method: "GET", url: "/api/auteurs/mila" })).json<Auteur>().fiche.recits).toEqual([projet.id]);
    expect(await asset()).toEqual([]);
  });

  it("ajoute la version anglaise et crée ses dossiers", async () => {
    const projet = await creer();
    const reponse = await modifier(
      projet.id,
      modification(RECIT, { anglais: true, titre: { fr: RECIT.titre.fr, en: "The Last Dragon" }, sorties: ["youtube", "podcast-fr", "podcast-en"] }),
    );
    expect(reponse.json<ReponseModificationProjet>().projet.metadata.langues).toEqual(["fr", "en"]);
    await expect(access(join(creations(), projet.chemin, "voix", "en"))).resolves.toBeUndefined();
    await expect(access(join(creations(), projet.chemin, "exports", "podcast-en"))).resolves.toBeUndefined();
  });

  it("ajoute des fichiers de l'inbox à un projet existant", async () => {
    const projet = await creer();
    await writeFile(join(inbox(), "narration.wav"), "seconde prise");
    await writeFile(join(inbox(), "dragon.png"), "image");

    const refus = await env.app.inject({
      method: "POST",
      url: `/api/projets/${projet.id}/fichiers`,
      payload: { fichiers: [{ chemin: "dragon.png", destination: "rushes/../..", note: "" }] },
    });
    expect(refus.statusCode).toBe(400);

    const reponse = await env.app.inject({
      method: "POST",
      url: `/api/projets/${projet.id}/fichiers`,
      payload: {
        fichiers: [
          { chemin: "narration.wav", destination: "voix/fr", note: "seconde prise" },
          { chemin: "dragon.png", destination: "assets/aurore", note: "" },
        ],
      },
    });
    expect(reponse.statusCode).toBe(200);
    expect(reponse.json<Projet>().metadata.fichiers.map(({ chemin }) => chemin)).toEqual([
      "voix/fr/narration.wav",
      "voix/fr/narration (2).wav",
      "assets/aurore/dragon.png",
    ]);
    expect(await readFile(join(creations(), projet.chemin, "voix", "fr", "narration.wav"), "utf8")).toBe("contenu de narration.wav");
    expect(await readdir(inbox())).toEqual([]);
  });

  it("met le projet à la corbeille et retire ses liens des fiches", async () => {
    const projet = await creer();
    const reponse = await env.app.inject({ method: "DELETE", url: `/api/projets/${projet.id}` });
    expect(reponse.statusCode).toBe(200);
    const { corbeille } = reponse.json<{ corbeille: string }>();
    expect(corbeille).toMatch(/^corbeille\/projets\/2026-11-06_le-dernier-dragon_/);
    await expect(access(join(creations(), corbeille, "voix", "fr", "narration.wav"))).resolves.toBeUndefined();
    expect(await readdir(join(creations(), "chaine-recits"))).toEqual([]);
    expect(await artiste("aurore")).toEqual([]);
    expect(await auteur()).toEqual([]);
    expect(await asset()).toEqual([]);
  });

  it("garde « futur roman » seulement pour une histoire personnelle et avertit avant l'export", async () => {
    const projet = await creer({ ...RECIT, fichiers: [], artistes: [], assetsBibliotheque: [] });
    const refuse = await modifier(projet.id, modification(RECIT, { artistes: [], assetsBibliotheque: [], futurRoman: true }));
    expect(refuse.json<ReponseModificationProjet>().projet.metadata.futurRoman).toBe(false);

    const mienne = modification(RECIT, {
      artistes: [],
      assetsBibliotheque: [],
      auteur: { id: null, nom: "Kilian", source: "", estUtilisateur: true },
      autorisation: null,
      futurRoman: true,
    });
    expect((await modifier(projet.id, mienne)).json<ReponseModificationProjet>().projet.metadata.futurRoman).toBe(true);
    const verification = (await env.app.inject({ method: "GET", url: `/api/projets/${projet.id}/verification` })).json<VerificationExport>();
    expect(verification.exportable).toBe(true);
    expect(verification.problemes).toEqual([
      {
        niveau: "avertissement",
        message: "Histoire destinée à devenir un roman : n'en publier que des extraits, jamais l'histoire entière.",
        sorties: ["youtube", "podcast-fr"],
      },
    ]);
  });
});
