import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { OutilsTache } from "../taches/file.ts";
import {
  accelerationWhisper,
  analyserJsonWhisper,
  argumentsWhisper,
  commandeDetectionParole,
  filtrerHorsParole,
  lirePassagesParole,
  DEPOT_MODELES,
  DEPOT_VAD,
  progressionWhisper,
  telechargerModele,
} from "./whisper.ts";

describe("lecture de la sortie de whisper.cpp", () => {
  it("recolle les morceaux de mots et ignore les jetons spéciaux", () => {
    const json = JSON.stringify({
      transcription: [
        {
          offsets: { from: 0, to: 4340 },
          text: " Bonjour, ceci est un essai.",
          tokens: [
            { text: "[_BEG_]", offsets: { from: 0, to: 0 }, p: 0.87 },
            { text: " Bonjour", offsets: { from: 120, to: 470 }, p: 0.99 },
            { text: ",", offsets: { from: 480, to: 610 }, p: 0.99 },
            { text: " ce", offsets: { from: 610, to: 710 }, p: 0.99 },
            { text: "ci", offsets: { from: 790, to: 800 }, p: 0.8 },
            { text: " est", offsets: { from: 1010, to: 1090 }, p: 1 },
            { text: "[_TT_217]", offsets: { from: 4340, to: 4340 }, p: 0.5 },
          ],
        },
        { offsets: { from: 4340, to: 5000 }, text: " ", tokens: [] },
      ],
    });
    expect(analyserJsonWhisper(json)).toEqual([
      {
        debut: 0,
        fin: 4.34,
        texte: "Bonjour, ceci est un essai.",
        mots: [
          { mot: "Bonjour,", debut: 0.12, fin: 0.61, probabilite: 0.99 },
          { mot: "ceci", debut: 0.61, fin: 0.8, probabilite: 0.8 },
          { mot: "est", debut: 1.01, fin: 1.09, probabilite: 1 },
        ],
        corrige: false,
      },
    ]);
  });

  it("lit la progression et l'accélération utilisée", () => {
    expect(progressionWhisper("whisper_print_progress_callback: progress =  45%")).toBe(0.45);
    expect(progressionWhisper("whisper_model_load: loading model")).toBeNull();
    expect(accelerationWhisper(["whisper_backend_init_gpu: using CUDA0 backend"])).toBe("CUDA");
    expect(accelerationWhisper(["whisper_backend_init_gpu: using MTL0 backend"])).toBe("Metal");
    expect(accelerationWhisper(["whisper_init_with_params_no_state: use gpu = 0"])).toBeNull();
  });

  it("limite les boucles et ajoute le vocabulaire", () => {
    expect(argumentsWhisper("m.bin", "a.wav", { langue: "fr", sortieSansExtension: "sortie" })).toEqual([
      "-m", "m.bin", "-f", "a.wav", "-l", "fr", "-ojf", "-of", "sortie", "-pp", "-mc", "0", "-sns",
    ]);
    expect(argumentsWhisper("m.bin", "a.wav", { langue: "en", sortieSansExtension: "s", vocabulaire: "Valorant, Jett." }).slice(13)).toEqual([
      "--prompt",
      "Valorant, Jett.",
      "--carry-initial-prompt",
    ]);
  });
});

describe("détection de la parole", () => {
  it("lit les passages parlés et retire les phrases inventées hors de ces passages", () => {
    const passages = lirePassagesParole([
      "whisper_vad_segments_from_probs: VAD segment 0: start = 0.10, end = 2.01 (duration: 1.91)",
      "whisper_vad_segments_from_probs: VAD segment 1: start = 30.75, end = 32.13 (duration: 1.38)",
      "Speech segment 0: start = 10.00, end = 201.00",
    ]);
    expect(passages).toEqual([
      { debut: 0.1, fin: 2.01 },
      { debut: 30.75, fin: 32.13 },
    ]);
    const segment = (debut: number, fin: number, texte: string) => ({ debut, fin, texte, mots: [], corrige: false });
    const segments = [segment(0, 1.9, "On lance la partie."), segment(12, 14, "Sous-titres réalisés par la communauté."), segment(30, 32, "Il reste deux ennemis.")];
    expect(filtrerHorsParole(segments, passages).map(({ texte }) => texte)).toEqual(["On lance la partie.", "Il reste deux ennemis."]);
  });

  it("cherche l'outil de détection à côté de whisper-cli", () => {
    expect(commandeDetectionParole("whisper-cli")).toBe("whisper-vad-speech-segments");
    expect(commandeDetectionParole(join("outils", "whisper", "whisper-cli.exe"))).toBe(join("outils", "whisper", "whisper-vad-speech-segments.exe"));
  });
});

describe("téléchargement d'un modèle", () => {
  const contenu = Buffer.from("modèle de test ".repeat(1000));
  let dossier: string;
  let serveur: Server;
  let adresse: string;
  let empreinte: string;

  function outils(): OutilsTache & { vues: number[] } {
    const vues: number[] = [];
    return {
      signal: new AbortController().signal,
      progression: (fraction) => {
        if (fraction !== null) vues.push(fraction);
      },
      vues,
    };
  }

  beforeEach(async () => {
    dossier = await mkdtemp(join(tmpdir(), "editeur-modeles-"));
    empreinte = createHash("sha256").update(contenu).digest("hex");
    serveur = createServer((requete, reponse) => {
      if (requete.url !== `/${DEPOT_MODELES}/resolve/main/ggml-test.bin`) {
        reponse.writeHead(404).end();
        return;
      }
      reponse.writeHead(200, { "content-length": contenu.length, "x-linked-etag": `"${empreinte}"` });
      reponse.end(contenu);
    });
    await new Promise<void>((resoudre) => serveur.listen(0, "127.0.0.1", resoudre));
    adresse = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise((resoudre) => serveur.close(resoudre));
    await rm(dossier, { recursive: true, force: true });
  });

  it("télécharge, vérifie l'empreinte et suit la progression", async () => {
    const suivi = outils();
    expect(await telechargerModele(dossier, "ggml-test.bin", DEPOT_MODELES, suivi, adresse)).toMatch(
      /^Modèle ggml-test\.bin téléchargé et vérifié/,
    );
    expect(await readFile(join(dossier, "ggml-test.bin"))).toEqual(contenu);
    expect(suivi.vues.at(-1)).toBe(1);
    expect(await telechargerModele(dossier, "ggml-test.bin", DEPOT_MODELES, outils(), adresse)).toBe(
      "Le modèle ggml-test.bin est déjà présent.",
    );
  });

  it("refuse un fichier abîmé, un modèle inconnu et un nom ou un dépôt non prévus, sans rien laisser", async () => {
    empreinte = "0".repeat(64);
    await expect(telechargerModele(dossier, "ggml-test.bin", DEPOT_MODELES, outils(), adresse)).rejects.toThrow(
      /empreinte SHA-256 différente/,
    );
    await expect(telechargerModele(dossier, "ggml-inconnu.bin", DEPOT_VAD, outils(), adresse)).rejects.toThrow(/erreur 404/);
    await expect(telechargerModele(dossier, "../sortie.bin", DEPOT_MODELES, outils(), adresse)).rejects.toThrow(/Modèle invalide/);
    await expect(telechargerModele(dossier, "ggml-test.bin", "pirate/depot", outils(), adresse)).rejects.toThrow(/Modèle invalide/);
    expect(await readdir(dossier)).toEqual([]);
  });
});
