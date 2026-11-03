import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { situer, type PlanMontage, type Projet, type ReponseCreationProjet, type RetoursVersion, type SaisieProjet, type Tache } from "@editeur/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { preparerEnvironnementTest, type EnvironnementTest } from "../test-outils.ts";
import { sectionRetours } from "./preparation.ts";
import { lireRetours, marquerTraites } from "./retours.ts";

const VLOG: SaisieProjet = {
  chaine: "creation",
  categorie: "vlog",
  titre: { fr: "Retours", en: null },
  datePublicationPrevue: "2026-11-23",
  anglais: false,
  sorties: ["youtube"],
  nombreFormatsCourts: null,
  consignes: { intention: "", dureeViseeMinutes: null, aGarder: "", aEviter: "" },
  fichiers: [{ chemin: "rush.mp4", destination: "rushes", note: "" }],
  auteur: null,
  autorisation: null,
  artistes: [],
  assetsBibliotheque: [],
  futurRoman: false,
  vocabulaire: "",
};

const segment = { source: "rushes/rush.mp4", role: "", citation: "", raison: "", decalageImage: 0, cadrage: null };
const PLAN: PlanMontage = {
  version: "v1",
  statut: "valide",
  creeLe: "2026-11-03T10:00:00.000Z",
  modifieLe: null,
  resume: "",
  hook: { segment: "s1", explication: "" },
  segments: [
    { ...segment, id: "s1", debut: 10, fin: 14 },
    { ...segment, id: "s2", debut: 40, fin: 50 },
  ],
  plansDeCoupe: [],
  musiques: [],
  sousTitres: false,
  pointsAVerifier: [],
  reponsesRetours: [],
};

describe("situer un instant de l'aperçu", () => {
  it("retrouve le segment et l'instant dans le rush", () => {
    expect(situer(PLAN.segments, 1)).toEqual({ segment: "s1", source: "rushes/rush.mp4", tempsSource: 11 });
    expect(situer(PLAN.segments, 6.5)).toEqual({ segment: "s2", source: "rushes/rush.mp4", tempsSource: 42.5 });
    expect(situer(PLAN.segments, 99)).toEqual({ segment: "s2", source: "rushes/rush.mp4", tempsSource: 50 });
    expect(situer([], 3)).toBeNull();
  });
});

describe("commentaires horodatés", () => {
  let env: EnvironnementTest;
  let dossier: string;
  const id = "2026-11-23_retours";
  const url = `/api/projets/${id}/plans/v1/retours`;

  beforeEach(async () => {
    env = await preparerEnvironnementTest();
    await writeFile(join(env.contexte.config.creations, "inbox", "rush.mp4"), "vidéo");
    const reponse = await env.app.inject({ method: "POST", url: "/api/projets", payload: VLOG });
    dossier = join(env.contexte.config.creations, reponse.json<ReponseCreationProjet>().projet.chemin);
    await mkdir(join(dossier, "versions/v1"), { recursive: true });
    await writeFile(join(dossier, "versions/v1/plan.json"), JSON.stringify(PLAN));
  });

  afterEach(async () => {
    await env.nettoyer();
  });

  it("refuse de commenter une version sans aperçu", async () => {
    const reponse = await env.app.inject({ method: "POST", url, payload: { temps: 3, texte: "trop tôt" } });
    expect(reponse.json()).toEqual({ erreur: "La version v1 n'a pas encore d'aperçu à commenter." });
  });

  it("ajoute, trie, modifie et supprime les commentaires dans retours.json", async () => {
    await writeFile(join(dossier, "versions/v1/apercu.mp4"), "vidéo");
    await env.app.inject({ method: "POST", url, payload: { temps: 6.54, texte: "Coupe trop tôt" } });
    await env.app.inject({ method: "POST", url, payload: { temps: null, texte: "Musique trop forte" } });
    const { commentaires } = (await env.app.inject({ method: "POST", url, payload: { temps: 1.2, texte: "  Accroche lente  " } })).json<RetoursVersion>();
    expect(commentaires.map(({ temps, texte }) => [temps, texte])).toEqual([
      [null, "Musique trop forte"],
      [1.2, "Accroche lente"],
      [6.5, "Coupe trop tôt"],
    ]);
    expect((await env.app.inject({ method: "POST", url, payload: { temps: 2, texte: "   " } })).statusCode).toBe(400);

    const cible = commentaires[2]?.id ?? "";
    const modifie = (await env.app.inject({ method: "PUT", url: `${url}/${cible}`, payload: { texte: "Coupe beaucoup trop tôt", traite: true } })).json<RetoursVersion>();
    expect(modifie.commentaires[2]).toMatchObject({ texte: "Coupe beaucoup trop tôt", traite: true });
    const supprime = (await env.app.inject({ method: "DELETE", url: `${url}/${commentaires[0]?.id ?? ""}` })).json<RetoursVersion>();
    expect(supprime.commentaires).toHaveLength(2);
    expect((await env.app.inject({ method: "DELETE", url: `${url}/inconnu` })).statusCode).toBe(404);

    const fichier = JSON.parse(await readFile(join(dossier, "versions/v1/retours.json"), "utf8")) as RetoursVersion;
    expect(fichier.version).toBe("v1");
    expect(fichier.commentaires.map(({ texte }) => texte)).toEqual(["Accroche lente", "Coupe beaucoup trop tôt"]);
  });

  it("lit un retours.json écrit à la main au format de CLAUDE.md", async () => {
    await writeFile(
      join(dossier, "versions/v1/retours.json"),
      JSON.stringify({ version: "v1", commentaires: [{ temps: 42.5, texte: "Coupe trop tôt", traite: false }, { temps: null, texte: "Musique", traite: false }] }),
    );
    const retours = await lireRetours(dossier, "v1");
    expect(retours.commentaires.map(({ temps, traite, reponse }) => [temps, traite, reponse])).toEqual([
      [null, false, null],
      [42.5, false, null],
    ]);
  });

  it("présente les commentaires à Claude, puis note la réponse de chacun", async () => {
    await writeFile(join(dossier, "versions/v1/apercu.mp4"), "vidéo");
    await env.app.inject({ method: "POST", url, payload: { temps: 6.5, texte: "Coupe | trop tôt" } });
    await env.app.inject({ method: "POST", url, payload: { temps: null, texte: "Musique trop forte" } });
    const { commentaires } = await lireRetours(dossier, "v1");

    expect(sectionRetours({ version: "v1", plan: PLAN, commentaires }).filter((ligne) => ligne.startsWith("| 0") || ligne.startsWith("| 1"))).toEqual([
      "| 0 | toute la vidéo | toute la vidéo | Musique trop forte |",
      "| 1 | 0:06.5 | s2 · rushes/rush.mp4 à 42.50 s | Coupe / trop tôt |",
    ]);

    expect(await marquerTraites(dossier, "v1", commentaires, [{ commentaire: 1, changement: "s2 commence plus tard." }, { commentaire: 9, changement: "?" }], "v2")).toBe(1);
    const apres = await lireRetours(dossier, "v1");
    expect(apres.commentaires.map(({ traite, traiteDans, reponse }) => [traite, traiteDans, reponse])).toEqual([
      [false, null, null],
      [true, "v2", "s2 commence plus tard."],
    ]);
  });

  it("valide une version rendue et refuse d'intégrer des retours inexistants", async () => {
    const validation = `/api/projets/${id}/plans/v1/validation`;
    expect((await env.app.inject({ method: "POST", url: validation, payload: { valide: true } })).statusCode).toBe(409);
    await writeFile(join(dossier, "versions/v1/apercu.mp4"), "vidéo");
    expect((await env.app.inject({ method: "POST", url: validation, payload: { valide: true } })).json<Projet>().metadata.versionValidee).toBe("v1");
    expect((await env.app.inject({ method: "GET", url: `/api/projets/${id}` })).json<{ etape: string }>().etape).toBe("valide");
    expect((await env.app.inject({ method: "POST", url: validation, payload: { valide: false } })).json<Projet>().metadata.versionValidee).toBeNull();

    const proposer = await env.app.inject({ method: "POST", url: `/api/projets/${id}/plans/proposer`, payload: { consigne: "", depuis: "v1" } });
    expect(proposer.json()).toEqual({ erreur: "Aucun commentaire à intégrer sur l'aperçu v1." });
    await env.app.inject({ method: "POST", url, payload: { temps: 2, texte: "Plus court" } });
    const acceptee = await env.app.inject({ method: "POST", url: `/api/projets/${id}/plans/proposer`, payload: { consigne: "", depuis: "v1" } });
    expect(acceptee.json<Tache>()).toMatchObject({ type: "proposition-plan", parametres: { depuis: "v1" } });
  });
});
