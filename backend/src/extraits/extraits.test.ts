import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PlanMontage, Projet, PropositionsExtraits, ReponseCreationProjet, ReponseExtraits, SaisieProjet } from "@editeur/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { preparerEnvironnementTest, type EnvironnementTest } from "../test-outils.ts";

const VLOG: SaisieProjet = {
  chaine: "creation",
  categorie: "vlog",
  titre: { fr: "Mon vlog", en: null },
  datePublicationPrevue: "2026-11-25",
  anglais: false,
  sorties: ["youtube", "formats-courts"],
  nombreFormatsCourts: 2,
  consignes: { intention: "", dureeViseeMinutes: null, aGarder: "", aEviter: "" },
  fichiers: [{ chemin: "rush.mp4", destination: "rushes", note: "" }],
  auteur: null,
  autorisation: null,
  artistes: [],
  assetsBibliotheque: [],
  futurRoman: false,
  vocabulaire: "café, carnet",
};

const PROPOSITIONS: PropositionsExtraits = {
  version: "v1",
  creeLe: "2026-11-03T10:00:00.000Z",
  candidats: [
    {
      numero: 1,
      titre: "Le carnet de poche",
      accroche: "Le premier truc que je vous conseille",
      justification: "Un conseil concret, compris sans contexte.",
      notes: { accroche: 8, autonomie: 9, emotion: 6, densite: 8, chute: 7 },
      passages: [{ source: "rushes/rush.mp4", debut: 14.65, fin: 27.4, citation: "Le premier truc…", cadrage: { mode: "recadre", debut: { x: 0.4, y: 0.5, zoom: 1.2 }, fin: null } }],
      noteGlobale: 7.6,
      duree: 12.8,
      recalages: [{ debut: 0, fin: 0.1 }],
      projet: null,
    },
  ],
};

describe("extraits d'une vidéo longue", () => {
  let env: EnvironnementTest;
  let creations: string;
  let dossier: string;
  const id = "2026-11-25_mon-vlog";

  beforeEach(async () => {
    env = await preparerEnvironnementTest();
    creations = env.contexte.config.creations;
    await writeFile(join(creations, "inbox", "rush.mp4"), "vidéo du rush");
    const reponse = await env.app.inject({ method: "POST", url: "/api/projets", payload: VLOG });
    dossier = join(creations, reponse.json<ReponseCreationProjet>().projet.chemin);
    await mkdir(join(dossier, "travail/transcriptions/rushes"), { recursive: true });
    await writeFile(join(dossier, "travail/transcriptions/rushes/rush.mp4.json"), "{}");
  });

  afterEach(async () => {
    await env.nettoyer();
  });

  it("refuse de proposer des extraits sans version validée", async () => {
    const reponse = await env.app.inject({ method: "POST", url: `/api/projets/${id}/extraits/proposer`, payload: {} });
    expect(reponse.json()).toEqual({ erreur: "Valide d'abord une version de la vidéo longue (onglet Aperçu)." });
    expect((await env.app.inject({ method: "GET", url: `/api/projets/${id}/extraits` })).json<ReponseExtraits>()).toEqual({ propositions: null, enfants: [], nombreDemande: 2 });
  });

  it("crée un format court lié, avec les rushes partagés et un premier plan", async () => {
    await mkdir(join(dossier, "travail/extraits"), { recursive: true });
    await writeFile(join(dossier, "travail/extraits/propositions.json"), JSON.stringify(PROPOSITIONS));

    const reponse = await env.app.inject({ method: "POST", url: `/api/projets/${id}/extraits/creer`, payload: { numero: 1, titre: "Le carnet de poche" } });
    expect(reponse.json<{ erreur?: string }>().erreur).toBeUndefined();
    expect(reponse.statusCode).toBe(200);
    const enfant = reponse.json<Projet>();
    expect(enfant).toMatchObject({ id: "2026-11-25_le-carnet-de-poche", chemin: "chaine-creation/2026-11-25_le-carnet-de-poche" });
    expect(enfant.metadata).toMatchObject({ categorie: "court", parent: id, sorties: ["formats-courts"], vocabulaire: "café, carnet" });
    expect(enfant.metadata.fichiers).toEqual([{ chemin: "rushes/rush.mp4", origine: `chaine-creation/${id}/rushes/rush.mp4`, note: `Lié au projet ${id}` }]);

    const dossierEnfant = join(creations, enfant.chemin);
    expect(await readFile(join(dossierEnfant, "rushes/rush.mp4"), "utf8")).toBe("vidéo du rush");
    expect((await stat(join(dossierEnfant, "rushes/rush.mp4"))).ino).toBe((await stat(join(dossier, "rushes/rush.mp4"))).ino);
    expect(await readFile(join(dossierEnfant, "travail/transcriptions/rushes/rush.mp4.json"), "utf8")).toBe("{}");

    const plan = JSON.parse(await readFile(join(dossierEnfant, "versions/v1/plan.json"), "utf8")) as PlanMontage;
    expect(plan).toMatchObject({ version: "v1", statut: "propose", sousTitres: true, hook: { segment: "s1", explication: "Le premier truc que je vous conseille" } });
    expect(plan.segments).toEqual([
      expect.objectContaining({ id: "s1", source: "rushes/rush.mp4", debut: 14.65, fin: 27.4, cadrage: { mode: "recadre", debut: { x: 0.4, y: 0.5, zoom: 1.2 }, fin: null } }),
    ]);

    const liste = (await env.app.inject({ method: "GET", url: `/api/projets/${id}/extraits` })).json<ReponseExtraits>();
    expect(liste.enfants).toEqual([{ id: "2026-11-25_le-carnet-de-poche", titre: "Le carnet de poche" }]);
    expect(liste.propositions?.candidats[0]?.projet).toBe("2026-11-25_le-carnet-de-poche");
    expect((await env.app.inject({ method: "POST", url: `/api/projets/${id}/extraits/creer`, payload: { numero: 1, titre: "Autre" } })).statusCode).toBe(409);
    expect((await env.app.inject({ method: "POST", url: `/api/projets/${id}/extraits/creer`, payload: { numero: 9, titre: "Autre" } })).statusCode).toBe(404);
  });
});
