import { spawnSync } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PlanMontage, RenduApercu, ReponseCreationProjet, ReponsePlans, ReponseTaches, SaisieProjet, Tache } from "@editeur/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { preparerEnvironnementTest, type EnvironnementTest } from "../test-outils.ts";

const ffmpegPresent = spawnSync("ffmpeg", ["-version"]).status === 0;

const VLOG: SaisieProjet = {
  chaine: "creation",
  categorie: "vlog",
  titre: { fr: "Rendu", en: null },
  datePublicationPrevue: "2026-11-22",
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

function plan(statut: PlanMontage["statut"]): PlanMontage {
  const segment = { source: "rushes/rush.mp4", role: "", citation: "", raison: "" };
  return {
    version: "v1",
    statut,
    creeLe: "2026-11-03T10:00:00.000Z",
    modifieLe: null,
    resume: "",
    hook: { segment: "s1", explication: "" },
    segments: [
      { ...segment, id: "s1", debut: 4, fin: 5.5, decalageImage: 0 },
      { ...segment, id: "s2", debut: 1, fin: 3, decalageImage: -0.4 },
    ],
    plansDeCoupe: [{ source: "rushes/rush.mp4", debut: 5, fin: 5.5, position: 2, raison: "" }],
    musiques: [{ origine: "projet", reference: "assets/musique.wav", debut: 0.5, fin: null, volumeDb: -20, baisseSousVoix: true, raison: "" }],
    pointsAVerifier: [],
    reponsesRetours: [],
  };
}

describe.skipIf(!ffmpegPresent)("rendu de l'aperçu", { timeout: 60_000 }, () => {
  let env: EnvironnementTest;
  let dossier: string;
  const id = "2026-11-22_rendu";

  beforeEach(async () => {
    env = await preparerEnvironnementTest();
    const inbox = join(env.contexte.config.creations, "inbox");
    // prettier-ignore
    spawnSync("ffmpeg", [
      "-v", "error", "-y",
      "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=25:duration=6",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=6",
      "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-shortest", join(inbox, "rush.mp4"),
    ]);
    const reponse = await env.app.inject({ method: "POST", url: "/api/projets", payload: VLOG });
    dossier = join(env.contexte.config.creations, reponse.json<ReponseCreationProjet>().projet.chemin);
    await mkdir(join(dossier, "assets"), { recursive: true });
    spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=220:duration=10", join(dossier, "assets/musique.wav")]);
    await mkdir(join(dossier, "versions/v1"), { recursive: true });
  });

  afterEach(async () => {
    await env.nettoyer();
  });

  async function attendre(): Promise<Tache[]> {
    for (let essai = 0; essai < 400; essai++) {
      const { taches } = (await env.app.inject({ method: "GET", url: "/api/taches" })).json<ReponseTaches>();
      if (taches.every((tache) => tache.etat !== "attente" && tache.etat !== "en-cours")) return taches;
      await new Promise((resoudre) => setTimeout(resoudre, 50));
    }
    throw new Error("Tâches trop longues.");
  }

  it("refuse un plan non validé ou un rush sans proxy", async () => {
    const url = `/api/projets/${id}/plans/v1/apercu`;
    await writeFile(join(dossier, "versions/v1/plan.json"), JSON.stringify(plan("propose")));
    expect((await env.app.inject({ method: "POST", url })).json()).toEqual({ erreur: "Valide d'abord le plan v1." });

    await writeFile(join(dossier, "versions/v1/plan.json"), JSON.stringify(plan("valide")));
    expect((await env.app.inject({ method: "POST", url })).statusCode).toBe(202);
    const [tache] = await attendre();
    expect(tache?.erreur).toBe("Prépare d'abord rushes/rush.mp4 (section Analyse des rushes) : l'aperçu est rendu à partir des proxys.");
  });

  it("rend l'aperçu à partir des proxys, au bon format et à la bonne durée, puis le protège", async () => {
    await env.app.inject({ method: "POST", url: `/api/projets/${id}/preparations`, payload: { fichiers: null } });
    await attendre();
    await writeFile(join(dossier, "versions/v1/plan.json"), JSON.stringify(plan("valide")));

    const url = `/api/projets/${id}/plans/v1/apercu`;
    expect((await env.app.inject({ method: "POST", url })).statusCode).toBe(202);
    const [tache] = await attendre();
    expect(tache?.erreur).toBeNull();
    expect(tache?.resultat).toMatch(/^Aperçu v1 rendu : 0:04, 640x360, en \d+ s \(contrôles OK\)\.$/);

    const sonde = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,width,height,nb_frames", "-of", "json", join(dossier, "versions/v1/apercu.mp4")]);
    const flux = (JSON.parse(sonde.stdout.toString()) as { streams: { codec_type: string; width?: number; height?: number; nb_frames?: string }[] }).streams;
    expect(flux.find((element) => element.codec_type === "video")).toMatchObject({ width: 640, height: 360, nb_frames: "105" });
    expect(flux.some((element) => element.codec_type === "audio")).toBe(true);

    const rendu = JSON.parse(await readFile(join(dossier, "versions/v1/rendu.json"), "utf8")) as RenduApercu;
    expect(rendu).toMatchObject({ version: "v1", fichier: "versions/v1/apercu.mp4", dureePlan: 3.5, controles: [] });
    expect(await readdir(join(dossier, "travail/rendu"))).toEqual([]);

    const [version] = (await env.app.inject({ method: "GET", url: `/api/projets/${id}/plans` })).json<ReponsePlans>().versions;
    expect(version).toMatchObject({ apercu: true, rendu: { duree: rendu.duree } });
    expect((await env.app.inject({ method: "POST", url })).statusCode).toBe(409);
  });
});
