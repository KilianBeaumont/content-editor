import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { GuideCategorie, ReponseGuides, ReponseTaches, VideoInspiration } from "@editeur/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { corpsAvecFichier, preparerEnvironnementTest, type EnvironnementTest } from "../test-outils.ts";
import { referencesInspiration } from "./inspiration.ts";

describe("guides et vidéos d'inspiration", () => {
  let env: EnvironnementTest;
  let creations: string;

  beforeEach(async () => {
    env = await preparerEnvironnementTest();
    creations = env.contexte.config.creations;
  });

  afterEach(async () => {
    await env.nettoyer();
  });

  it("crée le guide de la catégorie format court et le modifie", async () => {
    const guide = (await env.app.inject({ method: "GET", url: "/api/guides/court" })).json<GuideCategorie>();
    expect(guide.style).toContain("# Style : format court");
    expect(guide.videos).toEqual([]);

    const modifie = await env.app.inject({ method: "PUT", url: "/api/guides/court", payload: { style: "# Style\n\nTrès rythmé.", hooks: "# Hooks" } });
    expect(modifie.json<GuideCategorie>().style).toBe("# Style\n\nTrès rythmé.");
    expect(await readFile(join(creations, "guides/court/style.md"), "utf8")).toBe("# Style\n\nTrès rythmé.");
    expect((await env.app.inject({ method: "GET", url: "/api/guides/inconnue" })).statusCode).toBe(404);
  });

  it("reçoit une vidéo, la met en file d'analyse puis à la corbeille", async () => {
    const envoi = await env.app.inject({ method: "POST", url: "/api/guides/court/videos", ...corpsAvecFichier("Mon Short Préféré.mp4", "vidéo") });
    expect(envoi.json<VideoInspiration>()).toMatchObject({ nom: "mon-short-prefere.mp4", etat: "absente", dossierAnalyse: "guides/court/inspiration/analyses/mon-short-prefere" });
    expect((await env.app.inject({ method: "POST", url: "/api/guides/court/videos", ...corpsAvecFichier("notes.txt", "texte") })).statusCode).toBe(400);

    const lancement = await env.app.inject({ method: "POST", url: "/api/guides/court/analyses", payload: { noms: null } });
    expect(lancement.json()).toEqual({ ajoutees: 1 });
    const { taches } = (await env.app.inject({ method: "GET", url: "/api/taches" })).json<ReponseTaches>();
    expect(taches[0]).toMatchObject({ type: "analyse-inspiration", parametres: { categorie: "court", nom: "mon-short-prefere.mp4" } });

    const resume = (await env.app.inject({ method: "GET", url: "/api/guides" })).json<ReponseGuides>().guides.find((guide) => guide.categorie === "court");
    expect(resume).toEqual({ categorie: "court", videos: 1, analysees: 0 });

    const suppression = await env.app.inject({ method: "DELETE", url: "/api/guides/court/videos/mon-short-prefere.mp4" });
    expect(suppression.json<{ corbeille: string }>().corbeille).toMatch(/^corbeille\/guides\/court\/mon-short-prefere\.mp4_/);
    expect((await env.app.inject({ method: "DELETE", url: "/api/guides/court/videos/absent.mp4" })).statusCode).toBe(404);
  });

  it("transmet les analyses terminées comme références aux propositions de plan", async () => {
    await writeFile(join(creations, "guides/court/inspiration/videos/short.mp4"), "vidéo");
    const dossier = join(creations, "guides/court/inspiration/analyses/short");
    await mkdir(dossier, { recursive: true });
    const infos = await stat(join(creations, "guides/court/inspiration/videos/short.mp4"));
    await writeFile(join(dossier, "etat.json"), JSON.stringify({ tailleSource: infos.size, modifieSource: infos.mtime.toISOString(), creeLe: "2026-11-03T10:00:00Z" }));
    await writeFile(
      join(dossier, "profil.json"),
      JSON.stringify({ duree: 20, largeur: 1080, hauteur: 1920, imagesParSeconde: 30, coupes: 12, coupesParMinute: 36, dureeMoyennePlan: 1.5, dureeMedianePlan: 1.4, plusLongPlan: 3, premiereCoupe: 0.8, mots: 60, motsParMinute: 180, premierMot: 0.1, partParole: 0.9, plusLongSilence: 0.4 }),
    );
    await writeFile(join(dossier, "analyse.json"), JSON.stringify({ resume: "Très rythmé, boucle finale.", techniques: ["Zoom brusque à 0:03", "Boucle : la fin reprend le début"], analyse: "# …" }));

    const lignes = await referencesInspiration(creations, "court");
    expect(lignes[0]).toBe("## Références d'inspiration (guides/court/inspiration)");
    expect(lignes).toContain("### short.mp4");
    expect(lignes).toContain("- Ce qu'on en retient : Très rythmé, boucle finale.");
    expect(lignes).toContain("  - Boucle : la fin reprend le début");
    expect(lignes.find((ligne) => ligne.startsWith("- Profil :"))).toContain("12 coupes, 36,0 par minute");
    expect(await referencesInspiration(creations, "vlog")).toEqual([]);
  });
});
