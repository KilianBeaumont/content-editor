import { mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReponseCreationProjet, ReponseTranscriptions, SaisieProjet, Transcription } from "@editeur/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileDeTaches } from "../taches/file.ts";
import { preparerEnvironnementTest, type EnvironnementTest } from "../test-outils.ts";
import { lancerTranscriptions } from "./transcriptions.ts";

const RECIT: SaisieProjet = {
  chaine: "recits",
  categorie: "recit",
  titre: { fr: "Le dernier dragon", en: "The Last Dragon" },
  datePublicationPrevue: "2026-11-06",
  anglais: true,
  sorties: ["youtube"],
  nombreFormatsCourts: null,
  consignes: { intention: "", dureeViseeMinutes: null, aGarder: "", aEviter: "" },
  fichiers: [
    { chemin: "narration.wav", destination: "voix/fr", note: "" },
    { chemin: "narration-en.wav", destination: "voix/en", note: "" },
    { chemin: "dragon.png", destination: "assets", note: "" },
  ],
  auteur: { id: null, nom: "Kilian", source: "", estUtilisateur: true },
  autorisation: null,
  artistes: [],
  assetsBibliotheque: [],
  futurRoman: false,
};

describe("transcriptions d'un projet", () => {
  let env: EnvironnementTest;
  let dossier: string;
  const id = "2026-11-06_le-dernier-dragon";

  beforeEach(async () => {
    env = await preparerEnvironnementTest();
    for (const { chemin } of RECIT.fichiers) await writeFile(join(env.contexte.config.creations, "inbox", chemin), "audio");
    const reponse = await env.app.inject({ method: "POST", url: "/api/projets", payload: RECIT });
    dossier = join(env.contexte.config.creations, reponse.json<ReponseCreationProjet>().projet.chemin);
  });

  afterEach(async () => {
    await env.nettoyer();
  });

  async function lister() {
    return (await env.app.inject({ method: "GET", url: `/api/projets/${id}/transcriptions` })).json<ReponseTranscriptions>().fichiers;
  }

  async function ecrireTranscription(chemin: string, changement: Partial<Transcription> = {}) {
    const infos = await stat(join(dossier, chemin));
    const transcription: Transcription = {
      version: 1,
      source: chemin,
      langue: "fr",
      modele: "large-v3-turbo",
      acceleration: "CUDA",
      duree: 12,
      tailleSource: infos.size,
      modifieSource: infos.mtime.toISOString(),
      creeLe: "2026-11-03T10:00:00.000Z",
      segments: [{ debut: 0, fin: 2, texte: "Il était une fois.", mots: [{ mot: "Il", debut: 0, fin: 0.3, probabilite: 0.9 }] }],
      ...changement,
    };
    await mkdir(join(dossier, "travail", "transcriptions", "voix", "fr"), { recursive: true });
    await writeFile(join(dossier, "travail", "transcriptions", `${chemin}.json`), JSON.stringify(transcription));
    return transcription;
  }

  it("propose les rushes et les voix, avec leur langue, mais pas les images", async () => {
    expect(await lister()).toEqual([
      { chemin: "voix/en/narration-en.wav", langue: "en", etat: "absente", duree: null, nombreMots: null },
      { chemin: "voix/fr/narration.wav", langue: "fr", etat: "absente", duree: null, nombreMots: null },
    ]);
  });

  it("lit une transcription et repère celle d'un fichier remplacé depuis", async () => {
    const transcription = await ecrireTranscription("voix/fr/narration.wav");
    expect((await lister()).find((fichier) => fichier.chemin === "voix/fr/narration.wav")).toMatchObject({
      etat: "a-jour",
      duree: 12,
      nombreMots: 1,
    });
    const lue = await env.app.inject({ method: "GET", url: `/api/projets/${id}/transcriptions/voix/fr/narration.wav` });
    expect(lue.json<Transcription>()).toEqual(transcription);

    await writeFile(join(dossier, "voix", "fr", "narration.wav"), "nouvelle prise plus longue");
    expect((await lister()).find((fichier) => fichier.chemin === "voix/fr/narration.wav")?.etat).toBe("perimee");
  });

  it("répond 404 sans transcription et refuse un chemin hors du projet", async () => {
    expect((await env.app.inject({ method: "GET", url: `/api/projets/${id}/transcriptions/voix/fr/narration.wav` })).statusCode).toBe(404);
    expect(
      (await env.app.inject({ method: "GET", url: `/api/projets/${id}/transcriptions/..%2F..%2F..%2Fparametres.json` })).statusCode,
    ).toBe(400);
  });

  it("met en file les fichiers à transcrire, sans doublon ni fichier déjà à jour", async () => {
    await ecrireTranscription("voix/fr/narration.wav");
    const file = new FileDeTaches(() => join(env.dossier, "taches-test.json"), {
      "telechargement-modele": async () => null,
      "essai-transcription": async () => null,
      transcription: () => new Promise(() => undefined),
    });
    const creations = env.contexte.config.creations;

    expect(await lancerTranscriptions(creations, file, id, null)).toBe(1);
    expect(await lancerTranscriptions(creations, file, id, null)).toBe(0);
    expect(file.liste()[0]).toMatchObject({ type: "transcription", projet: id, parametres: { fichier: "voix/en/narration-en.wav" } });

    expect(await lancerTranscriptions(creations, file, id, ["voix/fr/narration.wav"])).toBe(1);
    await expect(lancerTranscriptions(creations, file, id, ["assets/dragon.png"])).rejects.toThrow(/ne peut pas être transcrit/);
  });
});
