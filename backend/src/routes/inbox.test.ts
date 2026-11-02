import { spawnSync } from "node:child_process";
import { access, mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReponseEnvoiInbox, ReponseInbox } from "@editeur/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { nomSansDanger } from "../inbox/inbox.ts";
import { corpsAvecFichier, preparerEnvironnementTest, type EnvironnementTest } from "../test-outils.ts";

const ffmpegPresent = spawnSync("ffmpeg", ["-version"]).status === 0;

describe("routes de l'inbox", () => {
  let env: EnvironnementTest;

  beforeEach(async () => {
    env = await preparerEnvironnementTest();
  });

  afterEach(async () => {
    await env.nettoyer();
  });

  const inbox = () => join(env.contexte.config.creations, "inbox");

  async function lister(): Promise<ReponseInbox> {
    return (await env.app.inject({ method: "GET", url: "/api/inbox" })).json<ReponseInbox>();
  }

  async function envoyer(nomFichier: string, contenu = "données") {
    return env.app.inject({ method: "POST", url: "/api/inbox", ...corpsAvecFichier(nomFichier, contenu) });
  }

  it("liste une inbox vide avec l'espace disque libre", async () => {
    const liste = await lister();
    expect(liste.fichiers).toEqual([]);
    expect(liste.espaceLibre).toBeGreaterThan(0);
    expect(liste.ffprobeDisponible).toBe(true);
  });

  it("garde le nom d'origine et numérote les doublons", async () => {
    const premier = await envoyer("Rush 01.MP4");
    expect(premier.statusCode).toBe(200);
    expect(premier.json<ReponseEnvoiInbox>().fichier).toMatchObject({ chemin: "Rush 01.MP4", taille: 8, genre: "video" });

    const second = await envoyer("Rush 01.MP4");
    expect(second.json<ReponseEnvoiInbox>().fichier.chemin).toBe("Rush 01 (2).MP4");
    expect((await readdir(inbox())).sort()).toEqual(["Rush 01 (2).MP4", "Rush 01.MP4"]);
  });

  it("signale un média illisible sans bloquer la liste", async () => {
    await envoyer("faux.mp4", "pas une vidéo");
    await envoyer("notes.txt", "texte");
    const liste = await lister();
    expect(liste.fichiers.map(({ chemin, genre }) => ({ chemin, genre }))).toEqual([
      { chemin: "faux.mp4", genre: "video" },
      { chemin: "notes.txt", genre: "texte" },
    ]);
    expect(liste.fichiers[0]?.erreurAnalyse).toMatch(/^Fichier illisible par ffprobe/);
    expect(liste.fichiers[1]).toMatchObject({ infos: null, erreurAnalyse: null });
  });

  it("parcourt les sous-dossiers et ignore les fichiers cachés", async () => {
    await mkdir(join(inbox(), "carte SD", "DCIM"), { recursive: true });
    await writeFile(join(inbox(), "carte SD", "DCIM", "C0001.txt"), "x");
    await writeFile(join(inbox(), ".DS_Store"), "x");
    await writeFile(join(inbox(), ".envoi.tmp"), "x");
    expect((await lister()).fichiers.map(({ chemin }) => chemin)).toEqual(["carte SD/DCIM/C0001.txt"]);
  });

  it("indique quand ffprobe est introuvable", async () => {
    env.contexte.config.binaires.ffprobe = "ffprobe-inexistant";
    await envoyer("rush.mov");
    const liste = await lister();
    expect(liste.ffprobeDisponible).toBe(false);
    expect(liste.fichiers[0]?.erreurAnalyse).toBe("ffprobe introuvable : vérifie son chemin dans Paramètres.");
  });

  it.skipIf(!ffmpegPresent)("lit la durée, la résolution et l'audio d'une vraie vidéo", async () => {
    const resultat = spawnSync("ffmpeg", [
      "-v", "error", "-y",
      "-f", "lavfi", "-i", "testsrc2=size=320x240:rate=25:duration=2",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest",
      join(inbox(), "essai.mp4"),
    ]);
    expect(resultat.status).toBe(0);

    const [fichier] = (await lister()).fichiers;
    expect(fichier?.erreurAnalyse).toBeNull();
    expect(fichier?.infos?.video).toEqual({ largeur: 320, hauteur: 240, codec: "h264", imagesParSeconde: 25 });
    expect(fichier?.infos?.audio).toMatchObject({ codec: "aac", canaux: 1 });
    expect(fichier?.infos?.duree).toBeCloseTo(2, 0);
  });

  it("met un fichier à la corbeille et refuse les chemins hors de l'inbox", async () => {
    await envoyer("erreur.mp4");
    const reponse = await env.app.inject({ method: "DELETE", url: "/api/inbox/fichiers/erreur.mp4" });
    expect(reponse.statusCode).toBe(200);
    const { corbeille } = reponse.json<{ corbeille: string }>();
    expect(corbeille).toMatch(/^corbeille\/inbox\/erreur\.mp4_/);
    await expect(access(join(env.contexte.config.creations, corbeille))).resolves.toBeUndefined();
    expect(await readdir(inbox())).toEqual([]);

    expect((await env.app.inject({ method: "DELETE", url: "/api/inbox/fichiers/absent.mp4" })).statusCode).toBe(404);
    expect((await env.app.inject({ method: "DELETE", url: "/api/inbox/fichiers/..%2F..%2Fparametres.json" })).statusCode).toBe(400);
    expect((await env.app.inject({ method: "DELETE", url: "/api/inbox/fichiers/..%2Fparametres.json" })).statusCode).toBe(400);
    await expect(access(join(env.contexte.config.creations, "parametres.json"))).resolves.toBeUndefined();
  });
});

describe("nomSansDanger", () => {
  it("retire les dossiers et les caractères interdits sous Windows", () => {
    expect(nomSansDanger("../../rush.mp4")).toBe("rush.mp4");
    expect(nomSansDanger("C:\\Users\\moi\\rush.mov")).toBe("rush.mov");
    expect(nomSansDanger("plan: 1?.mp4")).toBe("plan_ 1_.mp4");
    expect(nomSansDanger("fin. ")).toBe("fin");
    expect(nomSansDanger("...")).toBe("fichier");
  });
});
