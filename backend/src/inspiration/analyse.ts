import { randomUUID } from "node:crypto";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GUIDE_ANIMATIONS, LIBELLES_SUJETS_GUIDE, schemaAnalyseInspiration, type AnalyseAudio, type SujetGuide, type Transcription } from "@editeur/shared";
import { z } from "zod";
import { appelerClaude } from "../claude/appel.ts";
import type { Contexte } from "../contexte.ts";
import { cheminSur, ecrireJsonAtomique, existe } from "../fichiers.ts";
import { executerFfmpeg } from "../media/ffmpeg.ts";
import { sonderMedia } from "../media/ffprobe.ts";
import { transcrireSource } from "../media/transcription.ts";
import { lireParametres } from "../parametres.ts";
import { transcriptionCompacte } from "../plans/preparation.ts";
import { analyserNiveaux, argumentsNiveaux, argumentsProxy, echapperFiltre, filtrePlanches, intervallePlanches, lireNiveau } from "../rushes/analyse.ts";
import type { OutilsTache } from "../taches/file.ts";
import { dossierAnalyse, dossierVideos, ecrireEtatAnalyse } from "./inspiration.ts";
import { calculerProfil, lireCoupe, resumerProfil } from "./profil.ts";

export const SKILL_ANALYSER_INSPIRATION = ".claude/skills/analyser-inspiration/SKILL.md";
const SCHEMA_ANALYSE = z.toJSONSchema(schemaAnalyseInspiration, { target: "draft-07" });
const SEUIL_COUPE = 0.2;
const ECART_COUPES = 0.2;
const PAS_MOUVEMENT = 1 / 6;
const DUREE_MOUVEMENT = 24;
const POLICES: Partial<Record<NodeJS.Platform, string[]>> = {
  win32: ["C:/Windows/Fonts/arial.ttf"],
  darwin: ["/System/Library/Fonts/Supplemental/Arial.ttf", "/Library/Fonts/Arial.ttf"],
  linux: ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"],
};

async function police(): Promise<string | null> {
  for (const candidate of POLICES[process.platform] ?? []) if (await existe(candidate)) return candidate;
  return null;
}

function filtreImagesCoupes(policeImages: string | null): string {
  const etapes = [`select='eq(n\\,0)+gt(scene\\,${SEUIL_COUPE})'`, "scale=320:-2"];
  if (policeImages !== null) {
    etapes.push(
      `drawtext=fontfile='${echapperFiltre(policeImages)}':text='%{eif\\:floor(t/60)\\:d}\\:%{eif\\:mod(t\\,60)\\:d\\:2}.%{eif\\:mod(floor(t*10)\\,10)\\:d}':x=6:y=6:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=4`,
    );
  }
  etapes.push("tile=4x3:padding=4:color=black");
  return etapes.join(",");
}

export function filtreMouvement(policeImages: string | null): string {
  const etapes = [`select='lte(t\\,${DUREE_MOUVEMENT})*(isnan(prev_selected_t)+gte(t-prev_selected_t\\,${PAS_MOUVEMENT - 0.01}))'`, "scale=320:-2"];
  if (policeImages !== null) {
    etapes.push(
      `drawtext=fontfile='${echapperFiltre(policeImages)}':text='%{eif\\:floor(t/60)\\:d}\\:%{eif\\:mod(t\\,60)\\:d\\:2}.%{eif\\:mod(floor(t*10)\\,10)\\:d}':x=6:y=6:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=4`,
    );
  }
  etapes.push("tile=4x3:padding=4:color=black");
  return etapes.join(",");
}

async function images(dossier: string): Promise<string[]> {
  try {
    return (await readdir(dossier)).filter((nom) => nom.endsWith(".jpg")).sort();
  } catch {
    return [];
  }
}

function sousTache(outils: OutilsTache, debut: number, fin: number): OutilsTache {
  return { signal: outils.signal, progression: (fraction, etape) => outils.progression(fraction === null ? null : debut + fraction * (fin - debut), etape) };
}

export async function analyserInspiration(contexte: Contexte, categorie: SujetGuide, nom: string, outils: OutilsTache): Promise<string> {
  const { config, racineDepot } = contexte;
  const { ffmpeg, ffprobe } = config.binaires;
  const source = cheminSur(config.creations, `${dossierVideos(categorie)}/${nom}`);
  if (!(await existe(source))) throw new Error(`Vidéo introuvable : ${nom}`);
  const consignes = join(racineDepot, SKILL_ANALYSER_INSPIRATION);
  if (!(await existe(consignes))) throw new Error(`Consignes introuvables : ${SKILL_ANALYSER_INSPIRATION}.`);

  outils.progression(0, "Lecture de la vidéo");
  const infos = await stat(source);
  const media = await sonderMedia(ffprobe, source);
  const duree = media.duree;
  const dossier = cheminSur(config.creations, dossierAnalyse(categorie, nom));
  await rm(dossier, { recursive: true, force: true });
  await mkdir(dossier, { recursive: true });

  const proxy = join(dossier, "proxy.mp4");
  if (media.video !== null) {
    outils.progression(0, "Création d'une copie légère");
    await executerFfmpeg(ffmpeg, argumentsProxy(source, media.video, media.audio !== null, proxy), { duree, action: "Copie légère", surProgression: (fraction) => outils.progression(fraction * 0.25) }, outils);
  }
  const lecture = media.video === null ? source : proxy;

  const coupes: number[] = [];
  if (media.video !== null) {
    outils.progression(0.25, "Détection des coupes");
    await executerFfmpeg(
      ffmpeg,
      ["-i", proxy, "-an", "-vf", `select='gt(scene,${SEUIL_COUPE})',metadata=print:file=-`, "-f", "null", "-"],
      {
        duree,
        action: "Détection des coupes",
        surSortie: (ligne) => {
          const coupe = lireCoupe(ligne);
          if (coupe !== null && coupe - (coupes.at(-1) ?? -1) >= ECART_COUPES) coupes.push(Math.round(coupe * 100) / 100);
        },
      },
      outils,
    );
    await ecrireJsonAtomique(join(dossier, "coupes.json"), { seuil: SEUIL_COUPE, coupes });

    outils.progression(0.35, "Planches d'images");
    const policeImages = await police();
    await mkdir(join(dossier, "planches"), { recursive: true });
    await executerFfmpeg(ffmpeg, ["-i", proxy, "-an", "-vf", filtrePlanches(intervallePlanches(duree ?? 60), policeImages), "-fps_mode", "vfr", "-q:v", "4", join(dossier, "planches", "planche-%02d.jpg")], { duree: null, action: "Planches" }, outils);
    await mkdir(join(dossier, "coupes"), { recursive: true });
    await executerFfmpeg(ffmpeg, ["-i", proxy, "-an", "-vf", filtreImagesCoupes(policeImages), "-fps_mode", "vfr", "-q:v", "4", join(dossier, "coupes", "coupes-%02d.jpg")], { duree: null, action: "Images des coupes" }, outils);
    if (categorie === GUIDE_ANIMATIONS) {
      await mkdir(join(dossier, "mouvement"), { recursive: true });
      await executerFfmpeg(ffmpeg, ["-i", proxy, "-an", "-vf", filtreMouvement(policeImages), "-fps_mode", "vfr", "-q:v", "4", join(dossier, "mouvement", "mouvement-%02d.jpg")], { duree: null, action: "Images du mouvement" }, outils);
    }
  }

  let audio: AnalyseAudio | null = null;
  let transcription: Transcription | null = null;
  let noteTranscription = "";
  if (media.audio !== null) {
    outils.progression(0.45, "Mesure du son");
    const niveaux: number[] = [];
    await executerFfmpeg(ffmpeg, argumentsNiveaux(lecture), { duree, action: "Mesure du son", surSortie: (ligne) => { const niveau = lireNiveau(ligne); if (niveau !== null) niveaux.push(niveau); } }, outils);
    audio = analyserNiveaux(niveaux);
    await ecrireJsonAtomique(join(dossier, "audio.json"), audio);
    try {
      transcription = (await transcrireSource(contexte, { source: lecture, cheminRelatif: nom, langue: "auto", vocabulaire: "", dossierTemporaire: tmpdir() }, sousTache(outils, 0.5, 0.75))).transcription;
      await ecrireJsonAtomique(join(dossier, "transcription.json"), transcription);
      await writeFile(join(dossier, "transcription.md"), transcriptionCompacte(transcription, audio), "utf8");
    } catch (erreur) {
      if (outils.signal.aborted) throw erreur;
      noteTranscription = ` Transcription impossible : ${erreur instanceof Error ? erreur.message : String(erreur)}`;
    }
  }

  const profil = calculerProfil(media, coupes, transcription, audio);
  await ecrireJsonAtomique(join(dossier, "profil.json"), profil);
  await ecrireEtatAnalyse(dossier, { tailleSource: infos.size, modifieSource: infos.mtime.toISOString(), creeLe: new Date().toISOString() });
  await rm(proxy, { force: true });

  outils.progression(0.8, "Claude analyse la vidéo");
  const fichiers = [
    "profil.json",
    ...(transcription === null ? [] : ["transcription.md"]),
    ...(await images(join(dossier, "coupes"))).map((image) => `coupes/${image}`),
    ...(await images(join(dossier, "mouvement"))).map((image) => `mouvement/${image}`),
    ...(await images(join(dossier, "planches"))).map((image) => `planches/${image}`),
  ];
  const { claude } = await lireParametres(config.creations);
  const reponse = await appelerClaude({
    commande: config.binaires.claude,
    modele: claude.modele,
    dossier,
    consignes,
    prompt: [
      `Analyse cette vidéo d'inspiration (${nom}) pour le guide « ${LIBELLES_SUJETS_GUIDE[categorie]} » (${categorie}), en suivant tes consignes.`,
      `Profil chiffré : ${resumerProfil(profil)}.`,
      `Fichiers du dossier courant : ${fichiers.join(", ")}.`,
      "Réponds uniquement par l'analyse structurée.",
    ].join("\n"),
    schema: SCHEMA_ANALYSE,
    session: { id: randomUUID(), reprise: false },
    signal: outils.signal,
    surEtape: (etape) => outils.progression(null, etape),
  });
  const analyse = schemaAnalyseInspiration.safeParse(reponse.sortie);
  if (!analyse.success) throw new Error(`L'analyse renvoyée par Claude n'est pas conforme :\n${z.prettifyError(analyse.error)}`);
  await ecrireJsonAtomique(join(dossier, "analyse.json"), analyse.data);
  await writeFile(join(dossier, "analyse.md"), `# Analyse : ${nom}\n\n> ${resumerProfil(profil)}\n\n${analyse.data.analyse.trim()}\n`, "utf8");
  return `${nom} analysée : ${profil.coupes} coupes, ${analyse.data.techniques.length} techniques repérées.${noteTranscription}`;
}
