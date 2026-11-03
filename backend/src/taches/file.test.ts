import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Tache } from "@editeur/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileDeTaches, type Executeur } from "./file.ts";

const pause = (ms: number) => new Promise((resoudre) => setTimeout(resoudre, ms));

describe("file de tâches", () => {
  let dossier: string;
  const fichier = () => join(dossier, "taches.json");

  beforeEach(async () => {
    dossier = await mkdtemp(join(tmpdir(), "editeur-taches-"));
  });

  afterEach(async () => {
    await rm(dossier, { recursive: true, force: true, maxRetries: 10, retryDelay: 20 });
  });

  function file(executeur: Executeur) {
    return new FileDeTaches(fichier, { "telechargement-modele": executeur, "essai-transcription": executeur, transcription: executeur });
  }

  it("exécute les tâches une par une, dans l'ordre d'arrivée, et garde l'historique", async () => {
    const ordre: string[] = [];
    let enCours = 0;
    let maximum = 0;
    const taches = file(async (tache) => {
      enCours++;
      maximum = Math.max(maximum, enCours);
      ordre.push(String(tache.parametres.nom));
      await pause(20);
      enCours--;
      return `fini ${String(tache.parametres.nom)}`;
    });
    const a = taches.ajouter("essai-transcription", "A", null, { nom: "a" });
    const b = taches.ajouter("essai-transcription", "B", "2026-11-06_projet", { nom: "b" });

    expect((await taches.attendre(b.id)).resultat).toBe("fini b");
    expect((await taches.attendre(a.id)).etat).toBe("terminee");
    expect(ordre).toEqual(["a", "b"]);
    expect(maximum).toBe(1);

    await pause(20);
    const enregistre = JSON.parse(await readFile(fichier(), "utf8")) as { taches: Tache[] };
    expect(enregistre.taches.map(({ libelle, etat, projet }) => ({ libelle, etat, projet }))).toEqual([
      { libelle: "B", etat: "terminee", projet: "2026-11-06_projet" },
      { libelle: "A", etat: "terminee", projet: null },
    ]);
  });

  it("transmet la progression aux abonnés", async () => {
    const vues: (number | null)[] = [];
    const taches = file(async (_tache, outils) => {
      outils.progression(0.5, "Moitié");
      await pause(300);
      return null;
    });
    taches.abonner((liste) => vues.push(liste[0]?.progression ?? null));
    const tache = taches.ajouter("essai-transcription", "Progression", null, {});
    await pause(100);
    expect(taches.liste()[0]).toMatchObject({ etat: "en-cours", progression: 0.5, etape: "Moitié" });
    expect(await taches.attendre(tache.id)).toMatchObject({ etat: "terminee", progression: 1 });
    expect(vues).toContain(0.5);
  });

  it("note l'erreur d'une tâche qui échoue et permet de la relancer", async () => {
    let essais = 0;
    const taches = file(async () => {
      essais++;
      if (essais === 1) throw new Error("ffmpeg introuvable");
      return "réussi";
    });
    const tache = taches.ajouter("essai-transcription", "Essai", null, { a: 1 });
    expect(await taches.attendre(tache.id)).toMatchObject({ etat: "echouee", erreur: "ffmpeg introuvable" });
    const relance = taches.relancer(tache.id);
    expect(relance.parametres).toEqual({ a: 1 });
    expect(await taches.attendre(relance.id)).toMatchObject({ etat: "terminee", resultat: "réussi" });
  });

  it("annule une tâche en cours et une tâche en attente", async () => {
    const taches = file(
      (_tache, outils) =>
        new Promise((_resoudre, rejeter) => {
          outils.signal.addEventListener("abort", () => rejeter(new Error("arrêté")));
        }),
    );
    const premiere = taches.ajouter("essai-transcription", "Longue", null, {});
    const seconde = taches.ajouter("essai-transcription", "En attente", null, {});
    await pause(20);

    expect(taches.annuler(seconde.id).etat).toBe("annulee");
    taches.annuler(premiere.id);
    expect(await taches.attendre(premiere.id)).toMatchObject({ etat: "annulee", erreur: null });
    expect(() => taches.annuler(premiere.id)).toThrow("Cette tâche est déjà terminée.");
  });

  it("marque comme interrompues les tâches coupées par un redémarrage", async () => {
    const coupee: Tache = {
      id: "1",
      type: "telechargement-modele",
      libelle: "Téléchargement",
      projet: null,
      parametres: { modele: "large-v3-turbo" },
      etat: "en-cours",
      progression: 0.4,
      etape: "Téléchargement du modèle",
      resteSecondes: 30,
      creeLe: "2026-11-03T10:00:00.000Z",
      demarreLe: "2026-11-03T10:00:01.000Z",
      termineLe: null,
      resultat: null,
      erreur: null,
    };
    await writeFile(fichier(), JSON.stringify({ taches: [coupee] }));
    const taches = file(async () => null);
    await taches.charger();
    expect(taches.liste()[0]).toMatchObject({
      etat: "interrompue",
      resteSecondes: null,
      erreur: "L'outil a été arrêté pendant la tâche.",
    });
  });
});
