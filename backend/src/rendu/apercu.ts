import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { cheminApercu, cheminRendu, dureePlan, genreFichier, type RenduApercu } from "@editeur/shared";
import { lireAsset } from "../bibliotheque/bibliotheque.ts";
import type { Contexte } from "../contexte.ts";
import { cheminSur, ecrireJsonAtomique, renommer } from "../fichiers.ts";
import { executerFfmpeg } from "../media/ffmpeg.ts";
import { sonderMedia } from "../media/ffprobe.ts";
import { listerVersions, lirePlan, sourcesPlan } from "../plans/plans.ts";
import { validerPlan } from "../plans/validation.ts";
import { lireProjet } from "../projets/projets.ts";
import { etatPreparation, lirePreparation } from "../rushes/etat.ts";
import type { OutilsTache } from "../taches/file.ts";
import { argumentsClipAudio, argumentsClipVideo, decouper, formatApercu, grapheFinal, type MusiqueRendu } from "./graphe.ts";

const PART_CLIPS = 0.6;
const ECART_DUREE_TOLERE = 0.15;

function temps(secondes: number): string {
  return `${Math.floor(secondes / 60)}:${String(Math.round(secondes % 60)).padStart(2, "0")}`;
}

function nomClip(prefixe: string, index: number, extension: string): string {
  return `${prefixe}${String(index + 1).padStart(3, "0")}.${extension}`;
}

export async function verifierRenduPossible(dossier: string, version: string): Promise<void> {
  const etat = (await listerVersions(dossier)).find((element) => element.version === version);
  const plan = etat === undefined ? null : await lirePlan(dossier, version);
  if (etat === undefined || plan === null) throw new Error(`Plan introuvable : ${version}.`);
  if (etat.apercu) throw new Error(`L'aperçu de ${version} existe déjà : propose la version suivante pour en faire un autre.`);
  if (plan.statut !== "valide") throw new Error(`Valide d'abord le plan ${version}.`);
}

export async function rendreApercu(contexte: Contexte, id: string, version: string, outils: OutilsTache): Promise<string> {
  const { config } = contexte;
  const { ffmpeg, ffprobe } = config.binaires;
  const debutRendu = Date.now();
  const projet = await lireProjet(config.creations, id);
  const dossier = cheminSur(config.creations, projet.chemin);
  await verifierRenduPossible(dossier, version);
  const plan = await lirePlan(dossier, version);
  if (plan === null) throw new Error(`Plan introuvable : ${version}.`);
  const erreurs = validerPlan(plan, await sourcesPlan(config.creations, projet, ffprobe)).filter((probleme) => probleme.niveau === "erreur");
  if (erreurs.length > 0) throw new Error(`Le plan contient des erreurs : ${erreurs.map((probleme) => probleme.message).join(" ")}`);

  const fichiersSource = new Map<string, string>();
  for (const chemin of new Set([...plan.segments.map((segment) => segment.source), ...plan.plansDeCoupe.map((coupe) => coupe.source)])) {
    if (genreFichier(chemin) !== "video") {
      fichiersSource.set(chemin, cheminSur(dossier, chemin));
      continue;
    }
    const preparation = await lirePreparation(dossier, chemin);
    if (preparation?.proxy === null || preparation?.proxy === undefined || (await etatPreparation(dossier, chemin, preparation)) !== "a-jour") {
      throw new Error(`Prépare d'abord ${chemin} (section Analyse des rushes) : l'aperçu est rendu à partir des proxys.`);
    }
    fichiersSource.set(chemin, cheminSur(dossier, preparation.proxy));
  }
  const source = (chemin: string) => fichiersSource.get(chemin) ?? cheminSur(dossier, chemin);

  const musiques: MusiqueRendu[] = [];
  for (const musique of plan.musiques) {
    const fichier =
      musique.origine === "projet"
        ? cheminSur(dossier, musique.reference)
        : cheminSur(config.creations, `bibliotheque/${(await lireAsset(config.creations, musique.reference)).asset.chemin}`);
    musiques.push({ ...musique, source: fichier, dureeFichier: (await sonderMedia(ffprobe, fichier)).duree });
  }

  const format = formatApercu(projet.metadata.categorie);
  const total = dureePlan(plan);
  const temporaire = join(dossier, "travail", "rendu", `${version}-${randomUUID()}`);
  await mkdir(temporaire, { recursive: true });
  try {
    const decoupes = decouper(plan.segments);
    const videos: string[] = [];
    const audios: string[] = [];
    for (const [index, decoupe] of decoupes.entries()) {
      const segment = plan.segments[index];
      if (segment === undefined) continue;
      outils.progression((index / decoupes.length) * PART_CLIPS, `Découpe du segment ${segment.id} (${index + 1}/${decoupes.length})`);
      if (decoupe.image.images > 0) {
        const clip = nomClip("v", index, "mp4");
        const image = genreFichier(segment.source) === "video" ? source(segment.source) : null;
        await executerFfmpeg(ffmpeg, argumentsClipVideo(image, decoupe.image.debut, decoupe.image.images, format, join(temporaire, clip)), { duree: null, action: "Découpe de l'image" }, outils);
        videos.push(clip);
      }
      const clip = nomClip("a", index, "wav");
      await executerFfmpeg(ffmpeg, argumentsClipAudio(source(segment.source), decoupe.audio.debut, decoupe.audio.duree, join(temporaire, clip)), { duree: null, action: "Découpe du son" }, outils);
      audios.push(clip);
    }
    await writeFile(join(temporaire, "videos.txt"), videos.map((nom) => `file '${nom}'`).join("\n"), "utf8");
    await writeFile(join(temporaire, "audios.txt"), audios.map((nom) => `file '${nom}'`).join("\n"), "utf8");

    outils.progression(PART_CLIPS, "Assemblage, plans de coupe, musique et volume");
    const coupes = plan.plansDeCoupe.map((coupe) => ({ source: source(coupe.source), debut: coupe.debut, duree: coupe.fin - coupe.debut, position: coupe.position }));
    const graphe = grapheFinal(format, total, coupes, musiques);
    const sortie = join(temporaire, "apercu.mp4");
    await executerFfmpeg(
      ffmpeg,
      [
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        join(temporaire, "videos.txt"),
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        join(temporaire, "audios.txt"),
        ...graphe.entrees,
        "-filter_complex",
        graphe.filtre,
        "-map",
        "[v]",
        "-map",
        "[a]",
        "-t",
        String(Math.round(total * 1000) / 1000),
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
        sortie,
      ],
      { duree: total, action: "Assemblage de l'aperçu", surProgression: (fraction) => outils.progression(PART_CLIPS + fraction * (1 - PART_CLIPS)) },
      outils,
    );

    outils.progression(1, "Vérification de l'aperçu");
    const infos = await sonderMedia(ffprobe, sortie);
    const controles: string[] = [];
    if (infos.duree === null) controles.push("Durée de l'aperçu illisible.");
    else if (Math.abs(infos.duree - total) > ECART_DUREE_TOLERE) controles.push(`Durée rendue ${infos.duree.toFixed(2)} s au lieu de ${total.toFixed(2)} s prévues.`);
    if (infos.audio === null) controles.push("L'aperçu n'a pas de son.");
    if (infos.video === null) controles.push("L'aperçu n'a pas d'image.");

    const cible = join(dossier, cheminApercu(version));
    await mkdir(dirname(cible), { recursive: true });
    await renommer(sortie, cible);
    const rendu: RenduApercu = {
      version,
      fichier: cheminApercu(version),
      creeLe: new Date().toISOString(),
      largeur: format.largeur,
      hauteur: format.hauteur,
      dureePlan: total,
      duree: infos.duree,
      dureeRenduSecondes: Math.round((Date.now() - debutRendu) / 100) / 10,
      controles,
    };
    await ecrireJsonAtomique(join(dossier, cheminRendu(version)), rendu);
    const bilan = controles.length === 0 ? "contrôles OK" : `${controles.length} point${controles.length > 1 ? "s" : ""} à vérifier`;
    return `Aperçu ${version} rendu : ${temps(infos.duree ?? total)}, ${format.largeur}x${format.hauteur}, en ${Math.round(rendu.dureeRenduSecondes)} s (${bilan}).`;
  } finally {
    await rm(temporaire, { recursive: true, force: true });
  }
}
