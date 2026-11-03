import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PropositionPlan, ReponseCreationProjet, ReponsePlans, ReponseTaches, SaisieProjet, Tache, Transcription, VersionPlan } from "@editeur/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { lireProjet } from "../projets/projets.ts";
import { preparerEnvironnementTest, type EnvironnementTest } from "../test-outils.ts";
import { enregistrerProposition, versionAProposer } from "./plans.ts";
import { CONTEXTE_PLAN, preparerProposition, transcriptionCompacte } from "./preparation.ts";

const VLOG: SaisieProjet = {
  chaine: "creation",
  categorie: "vlog",
  titre: { fr: "Journée à l'atelier", en: null },
  datePublicationPrevue: "2026-11-20",
  anglais: false,
  sorties: ["youtube"],
  nombreFormatsCourts: null,
  consignes: { intention: "Montrer la peinture | du décor", dureeViseeMinutes: 3, aGarder: "La blague du chat", aEviter: "Les essais ratés" },
  fichiers: [
    { chemin: "matin.mp4", destination: "rushes", note: "bonne prise vers 2:10" },
    { chemin: "fond.mp3", destination: "assets", note: "" },
  ],
  auteur: null,
  autorisation: null,
  artistes: [],
  assetsBibliotheque: [],
  futurRoman: false,
  vocabulaire: "",
};

const PROPOSITION: PropositionPlan = {
  resume: "Une journée racontée en trois temps.",
  hook: { segment: "s1", explication: "La blague du chat ouvre la vidéo." },
  segments: [{ id: "s1", source: "rushes/matin.mp4", debut: 1, fin: 4, role: "accroche", citation: "Bonjour", raison: "Ça démarre fort.", decalageImage: 0, cadrage: null }],
  plansDeCoupe: [],
  musiques: [],
  pointsAVerifier: [],
  reponsesRetours: [],
};

describe("plans de montage", () => {
  let env: EnvironnementTest;
  let creations: string;
  let dossier: string;
  const id = "2026-11-20_journee-a-l-atelier";

  beforeEach(async () => {
    env = await preparerEnvironnementTest();
    creations = env.contexte.config.creations;
    for (const { chemin } of VLOG.fichiers) await writeFile(join(creations, "inbox", chemin), "média");
    const reponse = await env.app.inject({ method: "POST", url: "/api/projets", payload: VLOG });
    dossier = join(creations, reponse.json<ReponseCreationProjet>().projet.chemin);
  });

  afterEach(async () => {
    await env.nettoyer();
  });

  async function ecrireTranscription() {
    const transcription: Transcription = {
      version: 1,
      source: "rushes/matin.mp4",
      langue: "fr",
      modele: "large-v3-turbo",
      acceleration: null,
      duree: 30,
      tailleSource: (await stat(join(dossier, "rushes/matin.mp4"))).size,
      modifieSource: (await stat(join(dossier, "rushes/matin.mp4"))).mtime.toISOString(),
      creeLe: "2026-11-03T10:00:00.000Z",
      vad: true,
      vocabulaire: "",
      corrigee: false,
      segments: [
        { debut: 0.5, fin: 2, texte: "Bonjour à tous.", mots: [], corrige: false },
        { debut: 6, fin: 8.25, texte: "On attaque le décor.", mots: [], corrige: false },
      ],
    };
    const cible = join(dossier, "travail/transcriptions/rushes/matin.mp4.json");
    await mkdir(join(cible, ".."), { recursive: true });
    await writeFile(cible, JSON.stringify(transcription));
    return transcription;
  }

  async function plans() {
    return (await env.app.inject({ method: "GET", url: `/api/projets/${id}/plans` })).json<ReponsePlans>().versions;
  }

  it("écrit une transcription compacte, avec les silences notables", async () => {
    const transcription = await ecrireTranscription();
    expect(transcriptionCompacte(transcription)).toBe(
      [
        "# rushes/matin.mp4 : 0:30.0 (30.0 s), français",
        "",
        "Une ligne par passage : [début-fin] en secondes dans le rush. {t} : horaire du mot qui suit.",
        "",
        "[0.50-2.00] Bonjour à tous.",
        "(silence de 4.0 s)",
        "[6.00-8.25] On attaque le décor.",
        "(silence de 21.8 s jusqu'à la fin)",
        "",
      ].join("\n"),
    );
  });

  it("place des repères dans les phrases, aux pauses mesurées et à défaut tous les quelques mots", async () => {
    const mots = (texte: string, debut: number, duree: number) =>
      texte.split(" ").map((mot, index) => ({ mot, debut: debut + index * duree, fin: debut + (index + 1) * duree, probabilite: 0.9 }));
    const transcription: Transcription = {
      ...(await ecrireTranscription()),
      segments: [
        {
          debut: 0,
          fin: 4.4,
          texte: "trois méthodes que j'utilise trois outils que",
          mots: [...mots("trois méthodes que j'utilise", 2, 0.34), ...mots("trois outils que", 3.36, 0.35)],
          corrige: false,
        },
        { debut: 5, fin: 9, texte: "un deux trois quatre cinq six sept huit neuf dix", mots: mots("un deux trois quatre cinq six sept huit neuf dix", 5, 0.4), corrige: false },
        { debut: 10, fin: 11, texte: "Texte corrigé à la main", mots: mots("texte faux", 10, 0.5), corrige: true },
        { debut: 12, fin: 14, texte: "bonjour à tous", mots: [...mots("bonjour", 12, 0.35), ...mots("à tous", 12.35, 0.2)], corrige: false },
      ],
    };
    const silences = [
      { debut: 3.6, fin: 3.9 },
      { debut: 12, fin: 12.8 },
    ];
    const audio = { pas: 0.1, niveaux: [], seuilSilence: -36, silences, pics: [{ temps: 7.2, niveau: -12 }] };
    const lignes = transcriptionCompacte(transcription, audio).split("\n");
    expect(lignes).toContain("[0.00-4.40] trois méthodes que j'utilise (pause 0.3 s) {3.90} trois outils que");
    expect(lignes).toContain("[5.00-9.00] un deux trois quatre cinq six sept huit {8.20} neuf dix");
    expect(lignes).toContain("[10.00-11.00] Texte corrigé à la main");
    expect(lignes).toContain("[12.00-14.00] (pause 0.8 s) {12.80} bonjour à tous");
    expect(lignes).toContain("Pics sonores (moments les plus forts du son) : 7.2.");
  });

  it("prépare le contexte lu par Claude : consignes, fichiers, transcriptions et guide", async () => {
    await ecrireTranscription();
    await writeFile(join(creations, "guides/vlog/style.md"), "# Style : vlog\n\nRythme très serré.");
    const projet = await lireProjet(creations, id);
    const preparation = await preparerProposition(creations, projet, "ffprobe-absent", "v1", "Plus court que d'habitude");

    expect(preparation).toEqual({ transcriptions: 1, version: "v1", planPrecedent: null });
    const contexte = await readFile(join(dossier, CONTEXTE_PLAN), "utf8");
    expect(contexte).toContain("- Intention : Montrer la peinture / du décor");
    expect(contexte).toContain("- Durée visée : 3 min (180 s)");
    expect(contexte).toContain("- **Consigne pour cette proposition** : Plus court que d'habitude");
    expect(contexte).toMatch(/\| rushes\/matin\.mp4 \| Vidéo \| .* \| bonne prise vers 2:10 \| travail\/transcriptions\/rushes\/matin\.mp4\.md \|/);
    expect(contexte).toMatch(/\| assets\/fond\.mp3 \| Audio \|/);
    expect(contexte).toContain("Rythme très serré.");
    expect(contexte).not.toContain("metadata.json");
    expect(await readFile(join(dossier, "travail/transcriptions/rushes/matin.mp4.md"), "utf8")).toContain("[6.00-8.25] On attaque le décor.");
  });

  it("remplace la proposition tant qu'aucun aperçu n'existe, puis passe à la version suivante", async () => {
    expect(await versionAProposer(dossier)).toEqual({ version: "v1", remplace: false });
    await enregistrerProposition(dossier, PROPOSITION, new Date("2026-11-03T10:00:00Z"));
    expect(await versionAProposer(dossier)).toEqual({ version: "v1", remplace: true });

    const autre = await enregistrerProposition(dossier, { ...PROPOSITION, resume: "Autre idée." }, new Date("2026-11-03T11:00:00Z"));
    expect(autre).toMatchObject({ version: "v1", statut: "propose", resume: "Autre idée.", modifieLe: null });
    expect(await readdir(join(dossier, "travail/propositions"))).toEqual(["v1_2026-11-03T11-00-00.000Z.json"]);

    await writeFile(join(dossier, "versions/v1/apercu.mp4"), "vidéo");
    expect(await versionAProposer(dossier)).toEqual({ version: "v2", remplace: false });
    expect((await enregistrerProposition(dossier, PROPOSITION)).version).toBe("v2");

    const v2 = join(dossier, "versions/v2/plan.json");
    await writeFile(v2, JSON.stringify({ ...JSON.parse(await readFile(v2, "utf8")), statut: "valide" }));
    expect(await versionAProposer(dossier)).toEqual({ version: "v3", remplace: false });
  });

  it("liste les versions, de la plus récente à la plus ancienne, avec leurs problèmes", async () => {
    expect(await plans()).toEqual([]);
    await enregistrerProposition(dossier, { ...PROPOSITION, hook: { segment: "s7", explication: "" } });
    await writeFile(join(dossier, "versions/v1/apercu.mp4"), "vidéo");
    await mkdir(join(dossier, "versions/v2"));
    await writeFile(join(dossier, "versions/v2/plan.json"), "{ abîmé");

    const versions = await plans();
    expect(versions.map(({ version, apercu }) => [version, apercu])).toEqual([
      ["v2", false],
      ["v1", true],
    ]);
    expect(versions[0]?.erreur).toMatch(/plan\.json n'est pas un JSON valide/);
    expect(versions[1]?.problemes.map(({ message }) => message)).toEqual([
      "L'accroche renvoie à un segment inconnu : s7.",
      "Durée du plan : 0:03,0, pour 3:00,0 visées.",
    ]);
  });

  it("enregistre les modifications à la main, valide le plan et le repasse en brouillon", async () => {
    await enregistrerProposition(dossier, PROPOSITION, new Date("2026-11-03T10:00:00Z"));
    const url = `/api/projets/${id}/plans/v1`;
    const segments = [{ ...PROPOSITION.segments[0], fin: 5 }, { ...PROPOSITION.segments[0], id: "s2", debut: 10, fin: 12, decalageImage: -0.5, cadrage: null }];

    const modifie = await env.app.inject({ method: "PUT", url, payload: { ...PROPOSITION, segments } });
    expect(modifie.statusCode).toBe(200);
    expect(modifie.json<VersionPlan>().plan).toMatchObject({ statut: "propose", creeLe: "2026-11-03T10:00:00.000Z", segments: [{ fin: 5 }, { decalageImage: -0.5, cadrage: null }] });
    expect(modifie.json<VersionPlan>().plan?.modifieLe).not.toBeNull();
    expect((await env.app.inject({ method: "PUT", url, payload: { ...PROPOSITION, segments: [{ id: "x" }] } })).statusCode).toBe(400);

    const valide = await env.app.inject({ method: "POST", url: `${url}/statut`, payload: { statut: "valide" } });
    expect(valide.json<VersionPlan>().plan?.statut).toBe("valide");
    expect((await env.app.inject({ method: "PUT", url, payload: PROPOSITION })).json()).toEqual({
      erreur: "Ce plan est validé : repasse-le en brouillon pour le modifier.",
    });
    expect((await env.app.inject({ method: "POST", url: `${url}/statut`, payload: { statut: "propose" } })).json<VersionPlan>().plan?.statut).toBe("propose");

    await env.app.inject({ method: "PUT", url, payload: { ...PROPOSITION, hook: { segment: "s9", explication: "" } } });
    const refus = await env.app.inject({ method: "POST", url: `${url}/statut`, payload: { statut: "valide" } });
    expect(refus.statusCode).toBe(409);
    expect(refus.json<{ erreur: string }>().erreur).toMatch(/^Corrige d'abord le plan : L'accroche renvoie à un segment inconnu : s9\./);

    await writeFile(join(dossier, "versions/v1/apercu.mp4"), "vidéo");
    expect((await env.app.inject({ method: "PUT", url, payload: PROPOSITION })).statusCode).toBe(409);
    expect((await env.app.inject({ method: "PUT", url: `/api/projets/${id}/plans/v7`, payload: PROPOSITION })).statusCode).toBe(404);
  });

  it("met la proposition en file et signale clairement l'échec", async () => {
    const reponse = await env.app.inject({ method: "POST", url: `/api/projets/${id}/plans/proposer`, payload: { consigne: "  Plus court  " } });
    expect(reponse.statusCode).toBe(202);
    expect(reponse.json<Tache>()).toMatchObject({ type: "proposition-plan", projet: id, parametres: { consigne: "Plus court" } });

    let tache: Tache | undefined;
    for (let essai = 0; essai < 100; essai++) {
      tache = (await env.app.inject({ method: "GET", url: "/api/taches" })).json<ReponseTaches>().taches[0];
      if (tache?.etat === "echouee") break;
      await new Promise((resoudre) => setTimeout(resoudre, 20));
    }
    expect(tache?.erreur).toBe("Consignes de montage introuvables : .claude/skills/proposer-plan/SKILL.md.");
    expect((await env.app.inject({ method: "POST", url: "/api/projets/inconnu/plans/proposer", payload: { consigne: "" } })).statusCode).toBe(404);
  });
});
