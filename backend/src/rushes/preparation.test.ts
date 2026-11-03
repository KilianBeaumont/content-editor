import { spawnSync } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  AnalyseAudio,
  PreparationRush,
  ReponseCreationProjet,
  ReponseReperes,
  ReponseTaches,
  ReponseTranscriptions,
  SaisieProjet,
  Tache,
} from "@editeur/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { preparerEnvironnementTest, type EnvironnementTest } from "../test-outils.ts";

const ffmpegPresent = spawnSync("ffmpeg", ["-version"]).status === 0;

const VLOG: SaisieProjet = {
  chaine: "creation",
  categorie: "vlog",
  titre: { fr: "Essai", en: null },
  datePublicationPrevue: "2026-11-21",
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

describe("préparation des rushes et repères", () => {
  let env: EnvironnementTest;
  let dossier: string;
  const id = "2026-11-21_essai";

  beforeEach(async () => {
    env = await preparerEnvironnementTest();
    const inbox = join(env.contexte.config.creations, "inbox");
    if (ffmpegPresent) {
      // prettier-ignore
      const resultat = spawnSync("ffmpeg", [
        "-v", "error", "-y",
        "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=25:duration=6",
        "-f", "lavfi", "-i", "aevalsrc=if(between(t\\,2\\,3)\\,0\\,0.3*sin(2*PI*440*t)):s=48000:d=6",
        "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-shortest",
        join(inbox, "rush.mp4"),
      ]);
      expect(resultat.status).toBe(0);
    } else {
      await writeFile(join(inbox, "rush.mp4"), "vidéo");
    }
    const reponse = await env.app.inject({ method: "POST", url: "/api/projets", payload: VLOG });
    dossier = join(env.contexte.config.creations, reponse.json<ReponseCreationProjet>().projet.chemin);
  });

  afterEach(async () => {
    await env.nettoyer();
  });

  async function attendreTaches(): Promise<Tache[]> {
    for (let essai = 0; essai < 300; essai++) {
      const { taches } = (await env.app.inject({ method: "GET", url: "/api/taches" })).json<ReponseTaches>();
      if (taches.every((tache) => tache.etat !== "attente" && tache.etat !== "en-cours")) return taches;
      await new Promise((resoudre) => setTimeout(resoudre, 50));
    }
    throw new Error("Tâches trop longues.");
  }

  it.skipIf(!ffmpegPresent)("crée le proxy, les planches et l'analyse du son, puis signale le rush comme préparé", async () => {
    const lancement = await env.app.inject({ method: "POST", url: `/api/projets/${id}/preparations`, payload: { fichiers: null } });
    expect(lancement.json()).toEqual({ ajoutees: 1 });
    const [tache] = await attendreTaches();
    expect(tache?.erreur).toBeNull();
    expect(tache?.resultat).toMatch(/^Proxy 640 px de large, 1 silence et \d+ pics? sonores? repérés?, 1 planche d'images \(une image toutes les 1 s\)\.$/);

    const preparation = JSON.parse(await readFile(join(dossier, "travail/preparation/rushes/rush.mp4.json"), "utf8")) as PreparationRush;
    expect(preparation).toMatchObject({ proxy: "travail/proxy/rushes/rush.mp4.mp4", hdr: false, planches: { intervalle: 1, colonnes: 4, lignes: 3 } });
    expect(await readdir(join(dossier, "travail/planches/rushes/rush.mp4"))).toEqual(["planche-01.jpg"]);
    const audio = JSON.parse(await readFile(join(dossier, "travail/audio/rushes/rush.mp4.json"), "utf8")) as AnalyseAudio;
    expect(audio.silences).toHaveLength(1);
    expect(audio.silences[0]?.debut).toBeCloseTo(2, 0);
    expect(audio.silences[0]?.fin).toBeCloseTo(3, 0);

    const proxy = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", join(dossier, preparation.proxy ?? "")]);
    expect(proxy.stdout.toString().trim().split(/\r?\n/)[0]).toBe("640,360");

    const { fichiers } = (await env.app.inject({ method: "GET", url: `/api/projets/${id}/transcriptions` })).json<ReponseTranscriptions>();
    expect(fichiers[0]).toMatchObject({ preparation: "a-jour", proxy: "travail/proxy/rushes/rush.mp4.mp4" });
    const relance = await env.app.inject({ method: "POST", url: `/api/projets/${id}/preparations`, payload: { fichiers: null } });
    expect(relance.json()).toEqual({ ajoutees: 0 });
  });

  it("refuse de préparer un fichier qui n'est pas un rush", async () => {
    const reponse = await env.app.inject({ method: "POST", url: `/api/projets/${id}/preparations`, payload: { fichiers: ["metadata.json"] } });
    expect(reponse.statusCode).toBe(400);
  });

  it("ajoute, trie et supprime les repères posés à la main", async () => {
    const url = `/api/projets/${id}/reperes`;
    await env.app.inject({ method: "POST", url, payload: { source: "rushes/rush.mp4", temps: 4.567, note: " la blague " } });
    const { reperes } = (await env.app.inject({ method: "POST", url, payload: { source: "rushes/rush.mp4", temps: 1, note: "" } })).json<ReponseReperes>();
    expect(reperes.map(({ temps, note }) => [temps, note])).toEqual([
      [1, ""],
      [4.57, "la blague"],
    ]);

    expect((await env.app.inject({ method: "POST", url, payload: { source: "rushes/absent.mp4", temps: 1, note: "" } })).statusCode).toBe(400);
    expect((await env.app.inject({ method: "POST", url, payload: { source: "../../parametres.json", temps: 1, note: "" } })).statusCode).toBe(400);

    const restants = (await env.app.inject({ method: "DELETE", url: `${url}/${reperes[0]?.id ?? ""}` })).json<ReponseReperes>().reperes;
    expect(restants.map(({ note }) => note)).toEqual(["la blague"]);
    expect((await env.app.inject({ method: "DELETE", url: `${url}/inconnu` })).statusCode).toBe(404);
    expect(JSON.parse(await readFile(join(dossier, "travail/reperes.json"), "utf8"))).toMatchObject({ reperes: [{ note: "la blague" }] });
  });
});
