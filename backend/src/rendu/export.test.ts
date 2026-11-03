import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ExportSortie, Parametres, PlanMontage, ReponseCreationProjet, ReponseDescription, ReponseExports, ReponseExportsGlobaux, ReponseTaches, SaisieProjet, Tache } from "@editeur/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { preparerEnvironnementTest, type EnvironnementTest } from "../test-outils.ts";

const ffmpegPresent = spawnSync("ffmpeg", ["-version"]).status === 0;

const VLOG: SaisieProjet = {
  chaine: "creation",
  categorie: "vlog",
  titre: { fr: "Export", en: null },
  datePublicationPrevue: "2026-11-24",
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

const segment = { source: "rushes/rush.mp4", role: "", citation: "", raison: "" };
const PLAN: PlanMontage = {
  version: "v1",
  statut: "valide",
  creeLe: "2026-11-03T10:00:00.000Z",
  modifieLe: null,
  resume: "",
  hook: { segment: "s1", explication: "" },
  segments: [
    { ...segment, id: "s1", debut: 3, fin: 4.5, decalageImage: 0, cadrage: null, transition: "coupe" },
    { ...segment, id: "s2", debut: 0.5, fin: 2.5, decalageImage: -0.3, cadrage: null, transition: "coupe" },
  ],
  plansDeCoupe: [{ source: "rushes/rush.mp4", debut: 5, fin: 5.5, position: 2, raison: "", cadrage: null }],
  musiques: [],
  bruitages: [],
  textes: [],
  sousTitres: false,
  pointsAVerifier: [],
  reponsesRetours: [],
};

describe.skipIf(!ffmpegPresent)("export final", { timeout: 60_000 }, () => {
  let env: EnvironnementTest;
  let dossier: string;
  const id = "2026-11-24_export";

  beforeEach(async () => {
    env = await preparerEnvironnementTest();
    const creations = env.contexte.config.creations;
    // prettier-ignore
    spawnSync("ffmpeg", [
      "-v", "error", "-y",
      "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=50:duration=6",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=6",
      "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-shortest", join(creations, "inbox", "rush.mp4"),
    ]);
    const reponse = await env.app.inject({ method: "POST", url: "/api/projets", payload: VLOG });
    dossier = join(creations, reponse.json<ReponseCreationProjet>().projet.chemin);
    const parametres = JSON.parse(await readFile(join(creations, "parametres.json"), "utf8")) as Parametres;
    parametres.exports.youtube = { largeur: 640, hauteur: 360, loudnessLufs: -14 };
    await writeFile(join(creations, "parametres.json"), JSON.stringify(parametres));
    await mkdir(join(dossier, "versions/v1"), { recursive: true });
    await writeFile(join(dossier, "versions/v1/plan.json"), JSON.stringify(PLAN));
  });

  afterEach(async () => {
    await env.nettoyer();
  });

  async function attendre(): Promise<Tache[]> {
    for (let essai = 0; essai < 600; essai++) {
      const { taches } = (await env.app.inject({ method: "GET", url: "/api/taches" })).json<ReponseTaches>();
      if (taches.every((tache) => tache.etat !== "attente" && tache.etat !== "en-cours")) return taches;
      await new Promise((resoudre) => setTimeout(resoudre, 50));
    }
    throw new Error("Tâches trop longues.");
  }

  it("refuse d'exporter sans version validée", async () => {
    const reponse = await env.app.inject({ method: "POST", url: `/api/projets/${id}/exports`, payload: { sortie: "youtube" } });
    expect(reponse.json()).toEqual({ erreur: "Valide d'abord une version (onglet Aperçu) : c'est elle qui est exportée." });
    const autre = await env.app.inject({ method: "POST", url: `/api/projets/${id}/exports`, payload: { sortie: "podcast-fr" } });
    expect(autre.json<{ erreur: string }>().erreur).toMatch(/ne s'exporte pas encore/);
    expect((await env.app.inject({ method: "POST", url: `/api/projets/${id}/exports/youtube/afficher` })).statusCode).toBe(404);
  });

  it("rend la version validée depuis les rushes d'origine, la vérifie, la range et la marque publiée", async () => {
    await writeFile(join(dossier, "versions/v1/apercu.mp4"), "vidéo");
    await env.app.inject({ method: "POST", url: `/api/projets/${id}/plans/v1/validation`, payload: { valide: true } });

    expect((await env.app.inject({ method: "POST", url: `/api/projets/${id}/exports`, payload: { sortie: "youtube" } })).statusCode).toBe(202);
    const [tache] = await attendre();
    expect(tache?.erreur).toBeNull();
    expect(tache?.resultat).toMatch(/^Export YouTube \(v1\) : 0:04, 640x360 à 50 i\/s, -1[3-5]\.\d LUFS, en \d+ s \(contrôles OK\)\.$/);

    const { exports, sortiesVideo, qualites, emplacements } = (await env.app.inject({ method: "GET", url: `/api/projets/${id}/exports` })).json<ReponseExports>();
    expect(emplacements.youtube).toBe(join(dossier, "exports", "youtube", `${id}.mp4`));
    expect(sortiesVideo).toEqual(["youtube"]);
    expect(qualites).toEqual([
      { sortie: "youtube", standard: { largeur: 640, hauteur: 360 }, uhd: { largeur: 1280, hauteur: 720 }, rushes: { largeur: 1280, hauteur: 720 }, hdr: false },
    ]);
    expect(exports[0]).toMatchObject({ sortie: "youtube", fichier: `exports/youtube/${id}.mp4`, version: "v1", imagesParSeconde: 50, couleurs: "sdr", controles: [], publieLe: null });
    const sonde = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,nb_frames,color_transfer", "-of", "csv=p=0", join(dossier, exports[0]?.fichier ?? "")]);
    expect(sonde.stdout.toString().trim()).toBe("640,360,bt709,175");
    expect(await readFile(join(dossier, "exports/youtube/description.txt"), "utf8")).toBe("Export\n");
    expect((await env.app.inject({ method: "GET", url: `/api/projets/${id}/description` })).json<ReponseDescription>()).toEqual({ texte: "Export\n" });

    const publie = (await env.app.inject({ method: "POST", url: `/api/projets/${id}/exports/youtube/publication`, payload: { publie: true } })).json<ReponseExports>();
    expect(publie.exports[0]?.publieLe).not.toBeNull();
    const fiche = JSON.parse(await readFile(join(dossier, "travail/exports/youtube.json"), "utf8")) as ExportSortie;
    expect(fiche.publieLe).not.toBeNull();
    expect((await env.app.inject({ method: "GET", url: `/api/projets/${id}` })).json<{ etape: string }>().etape).toBe("exporte");
    const globaux = (await env.app.inject({ method: "GET", url: "/api/exports" })).json<ReponseExportsGlobaux>();
    expect(globaux.elements).toHaveLength(1);
    expect(globaux.elements[0]).toMatchObject({ projet: { id, titre: "Export", chaine: "creation", versionValidee: "v1" }, fiche: { sortie: "youtube" } });
  });
});
