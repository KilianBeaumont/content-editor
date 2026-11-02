import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { DetailProjet, ReponseFichiersProjet, ReponseListeProjets, SaisieProjet } from "@editeur/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { preparerEnvironnementTest, type EnvironnementTest } from "../test-outils.ts";

const VLOG: SaisieProjet = {
  chaine: "creation",
  categorie: "vlog",
  titre: { fr: "Première carte", en: null },
  datePublicationPrevue: "2026-11-15",
  anglais: false,
  sorties: ["youtube"],
  nombreFormatsCourts: null,
  consignes: { intention: "", dureeViseeMinutes: null, aGarder: "", aEviter: "" },
  fichiers: [{ chemin: "C0001.MP4", destination: "rushes", note: "" }],
  auteur: null,
  autorisation: null,
  artistes: [],
  assetsBibliotheque: [],
};

describe("liste et détail des projets", () => {
  let env: EnvironnementTest;

  beforeEach(async () => {
    env = await preparerEnvironnementTest();
  });

  afterEach(async () => {
    await env.nettoyer();
  });

  const creations = () => env.contexte.config.creations;

  async function creer(saisie: SaisieProjet): Promise<string> {
    for (const { chemin } of saisie.fichiers) await writeFile(join(creations(), "inbox", chemin), "x");
    const reponse = await env.app.inject({ method: "POST", url: "/api/projets", payload: saisie });
    expect(reponse.statusCode).toBe(201);
    return reponse.json<{ projet: { chemin: string } }>().projet.chemin;
  }

  async function etape(id: string) {
    return (await env.app.inject({ method: "GET", url: `/api/projets/${id}` })).json<DetailProjet>().etape;
  }

  it("liste les projets des deux chaînes par date de publication et signale les dossiers illisibles", async () => {
    await creer(VLOG);
    await creer({
      ...VLOG,
      chaine: "recits",
      categorie: "micro-histoire",
      titre: { fr: "La lanterne", en: null },
      datePublicationPrevue: "2026-11-10",
      sorties: ["formats-courts"],
      nombreFormatsCourts: 1,
      fichiers: [],
      auteur: { id: null, nom: "Kilian", source: "", estUtilisateur: true },
    });
    await mkdir(join(creations(), "chaine-creation", "Dossier perso"));
    await mkdir(join(creations(), "chaine-creation", "2026-12-01_sans-metadata"));

    const liste = (await env.app.inject({ method: "GET", url: "/api/projets" })).json<ReponseListeProjets>();
    expect(liste.projets.map(({ id, chaine, etape, nombreFichiers }) => ({ id, chaine, etape, nombreFichiers }))).toEqual([
      { id: "2026-11-10_la-lanterne", chaine: "recits", etape: "fichiers", nombreFichiers: 0 },
      { id: "2026-11-15_premiere-carte", chaine: "creation", etape: "fichiers", nombreFichiers: 1 },
    ]);
    expect(liste.illisibles.map(({ chemin }) => chemin).sort()).toEqual([
      "chaine-creation/2026-12-01_sans-metadata",
      "chaine-creation/Dossier perso",
    ]);
  });

  it("déduit l'étape du projet de ce qu'il contient", async () => {
    const chemin = await creer(VLOG);
    const id = "2026-11-15_premiere-carte";
    const dossier = join(creations(), chemin);
    expect(await etape(id)).toBe("fichiers");

    await writeFile(join(dossier, "travail", "transcription-C0001.json"), "{}");
    expect(await etape(id)).toBe("analyse");

    await mkdir(join(dossier, "versions", "v1"));
    await writeFile(join(dossier, "versions", "v1", "plan.json"), "{}");
    expect(await etape(id)).toBe("plan");

    await writeFile(join(dossier, "versions", "v1", "apercu.mp4"), "x");
    expect(await etape(id)).toBe("apercu");

    const fichierMetadata = join(dossier, "metadata.json");
    const metadata = JSON.parse(await readFile(fichierMetadata, "utf8")) as Record<string, unknown>;
    await writeFile(fichierMetadata, JSON.stringify({ ...metadata, versionValidee: "v1" }));
    expect(await etape(id)).toBe("valide");

    await writeFile(join(dossier, "exports", "youtube", "premiere-carte.mp4"), "x");
    expect(await etape(id)).toBe("exporte");
  });

  it("liste les fichiers du projet sans metadata.json", async () => {
    await creer(VLOG);
    const reponse = (await env.app.inject({ method: "GET", url: "/api/projets/2026-11-15_premiere-carte/fichiers" })).json<ReponseFichiersProjet>();
    expect(reponse.fichiers.map(({ chemin, genre }) => ({ chemin, genre }))).toEqual([{ chemin: "rushes/C0001.MP4", genre: "video" }]);
  });

  it("répond 404 pour un projet inconnu", async () => {
    expect((await env.app.inject({ method: "GET", url: "/api/projets/2026-01-01_inconnu" })).statusCode).toBe(404);
    expect((await env.app.inject({ method: "GET", url: "/api/projets/..%2F..%2Fparametres" })).statusCode).toBe(404);
  });
});
