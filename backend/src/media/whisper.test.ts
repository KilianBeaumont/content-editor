import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { OutilsTache } from "../taches/file.ts";
import { accelerationWhisper, analyserJsonWhisper, progressionWhisper, telechargerModele } from "./whisper.ts";

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
});

describe("téléchargement du modèle", () => {
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
      if (requete.url !== "/ggml-test.bin") {
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
    expect(await telechargerModele(dossier, "test", suivi, adresse)).toMatch(/^Modèle test téléchargé et vérifié/);
    expect(await readFile(join(dossier, "ggml-test.bin"))).toEqual(contenu);
    expect(suivi.vues.at(-1)).toBe(1);
    expect(await telechargerModele(dossier, "test", outils(), adresse)).toBe("Le modèle test est déjà présent.");
  });

  it("refuse un fichier abîmé, un modèle inconnu et un nom dangereux sans rien laisser", async () => {
    empreinte = "0".repeat(64);
    await expect(telechargerModele(dossier, "test", outils(), adresse)).rejects.toThrow(/empreinte SHA-256 différente/);
    await expect(telechargerModele(dossier, "inconnu", outils(), adresse)).rejects.toThrow(/erreur 404/);
    await expect(telechargerModele(dossier, "../sortie", outils(), adresse)).rejects.toThrow(/Nom de modèle invalide/);
    expect(await readdir(dossier)).toEqual([]);
  });
});
