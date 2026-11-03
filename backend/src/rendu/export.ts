import { randomUUID } from "node:crypto";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  cheminFicheExport,
  DEFINITIONS_SORTIES,
  dureePlan,
  genreFichier,
  type ExportSortie,
  type PlanMontage,
  type Projet,
  type ReponseExports,
  type ReponseExportsGlobaux,
  type Sortie,
} from "@editeur/shared";
import { z } from "zod";
import type { Contexte } from "../contexte.ts";
import { codeErreur, ErreurHttp } from "../erreurs.ts";
import { cheminSur, ecrireJsonAtomique, existe, FichierInvalideError, lireJsonComplete, renommer } from "../fichiers.ts";
import { capacitesFfmpeg } from "../media/capacites.ts";
import { sonderMedia } from "../media/ffprobe.ts";
import { lireParametres } from "../parametres.ts";
import { lirePlan } from "../plans/plans.ts";
import { listerProjets } from "../projets/liste.ts";
import { lireProjet } from "../projets/projets.ts";
import { verifierExportable } from "../projets/verification.ts";
import type { OutilsTache } from "../taches/file.ts";
import { cadenceExport, encodageFinal, encodageIntermediaire, estVertical, type ProfilImage, type SourceImage } from "./graphe.ts";
import { mesurerVolume, rendre, type ProfilRendu } from "./moteur.ts";
import { descriptionProjet } from "./description.ts";
import { resoudreMusiques, verifierPlanSansErreur } from "./ressources.ts";

const ECART_DUREE_TOLERE = 0.1;
const ECART_VOLUME_TOLERE = 1;
const CRETE_TOLEREE = -0.5;

const schemaFiche = z.object({
  sortie: z.string(),
  fichier: z.string(),
  version: z.string(),
  creeLe: z.string(),
  largeur: z.number(),
  hauteur: z.number(),
  imagesParSeconde: z.number(),
  encodeur: z.string(),
  dureePlan: z.number(),
  duree: z.number().nullable(),
  volumeLufs: z.number().nullable(),
  creteDb: z.number().nullable(),
  taille: z.number(),
  dureeRenduSecondes: z.number(),
  controles: z.array(z.string()),
  publieLe: z.string().nullable(),
});

export function sortiesVideo(projet: Projet): Sortie[] {
  const sortie: Sortie = estVertical(projet.metadata.categorie) ? "formats-courts" : "youtube";
  return projet.metadata.sorties.includes(sortie) ? [sortie] : [];
}

async function lireFiche(dossier: string, sortie: Sortie): Promise<ExportSortie | null> {
  try {
    const fiche = await lireJsonComplete(join(dossier, cheminFicheExport(sortie)), schemaFiche, {});
    return { ...fiche, sortie };
  } catch (erreur) {
    if (codeErreur(erreur) === "ENOENT" || erreur instanceof FichierInvalideError) return null;
    throw erreur;
  }
}

export async function listerExports(creations: string, id: string): Promise<ReponseExports> {
  const projet = await lireProjet(creations, id);
  const dossier = cheminSur(creations, projet.chemin);
  const exports: ExportSortie[] = [];
  for (const sortie of projet.metadata.sorties) {
    const fiche = await lireFiche(dossier, sortie);
    if (fiche !== null && (await existe(join(dossier, fiche.fichier)))) exports.push(fiche);
  }
  return { exports, sortiesVideo: sortiesVideo(projet) };
}

export async function marquerPublie(creations: string, id: string, sortie: Sortie, publie: boolean): Promise<ReponseExports> {
  const projet = await lireProjet(creations, id);
  const dossier = cheminSur(creations, projet.chemin);
  const fiche = await lireFiche(dossier, sortie);
  if (fiche === null) throw new ErreurHttp(404, `Aucun export ${DEFINITIONS_SORTIES[sortie].libelle} pour ce projet.`);
  await ecrireJsonAtomique(join(dossier, cheminFicheExport(sortie)), { ...fiche, publieLe: publie ? new Date().toISOString() : null });
  return listerExports(creations, id);
}

export async function verifierExportPossible(creations: string, projet: Projet, sortie: Sortie): Promise<PlanMontage> {
  const libelle = DEFINITIONS_SORTIES[sortie].libelle;
  if (!sortiesVideo(projet).includes(sortie)) throw new Error(`La sortie ${libelle} ne s'exporte pas encore pour ce projet.`);
  const version = projet.metadata.versionValidee;
  if (version === null) throw new Error("Valide d'abord une version (onglet Aperçu) : c'est elle qui est exportée.");
  const plan = await lirePlan(cheminSur(creations, projet.chemin), version);
  if (plan === null) throw new Error(`Le plan de la version validée ${version} est introuvable.`);
  const verification = await verifierExportable(creations, projet);
  if (!verification.exportable || verification.sortiesBloquees.includes(sortie)) {
    const blocages = verification.problemes.filter((probleme) => probleme.niveau === "blocage").map((probleme) => probleme.message);
    throw new Error(`Export bloqué : ${blocages.join(" ") || `la sortie ${libelle} n'est pas autorisée.`}`);
  }
  return plan;
}

function temps(secondes: number): string {
  return `${Math.floor(secondes / 60)}:${String(Math.round(secondes % 60)).padStart(2, "0")}`;
}

export async function exporterVideo(contexte: Contexte, id: string, sortie: Sortie, outils: OutilsTache): Promise<string> {
  const { config } = contexte;
  const { ffmpeg, ffprobe } = config.binaires;
  const debutRendu = Date.now();
  const projet = await lireProjet(config.creations, id);
  const dossier = cheminSur(config.creations, projet.chemin);
  const plan = await verifierExportPossible(config.creations, projet, sortie);
  await verifierPlanSansErreur(config.creations, projet, plan, ffprobe);

  outils.progression(0, "Analyse des rushes d'origine");
  const sources = new Map<string, SourceImage>();
  const cadences: (number | null)[] = [];
  for (const chemin of new Set([...plan.segments.map((segment) => segment.source), ...plan.plansDeCoupe.map((coupe) => coupe.source)])) {
    if (genreFichier(chemin) !== "video") continue;
    const absolu = cheminSur(dossier, chemin);
    const infos = await sonderMedia(ffprobe, absolu);
    if (infos.video === null) continue;
    sources.set(chemin, { chemin: absolu, transfert: infos.video.transfert });
    cadences.push(infos.video.imagesParSeconde);
  }

  const parametres = await lireParametres(config.creations);
  const prereglage = sortie === "formats-courts" ? parametres.exports.formatCourt : parametres.exports.youtube;
  const format = { largeur: prereglage.largeur, hauteur: prereglage.hauteur };
  const ips = cadenceExport(cadences);
  const capacites = await capacitesFfmpeg(ffmpeg);
  const total = dureePlan(plan);
  const musiques = await resoudreMusiques(config.creations, dossier, plan, ffprobe);
  const profil = (acceleration: boolean): ProfilRendu => {
    const image: ProfilImage = { format, ips, placebo: acceleration && capacites.placebo, acceleration };
    return {
      image,
      encodageClip: encodageIntermediaire(capacites.encodeur, ips),
      encodageSortie: encodageFinal(capacites.encodeur, format, ips),
      loudness: prereglage.loudnessLufs,
      deuxPasses: true,
      debitAudio: "320k",
    };
  };
  const entrees = {
    plan,
    image: (chemin: string) => sources.get(chemin) ?? null,
    son: (chemin: string) => cheminSur(dossier, chemin),
    musiques,
  };

  const temporaire = join(dossier, "travail", "rendu", `export-${sortie}-${randomUUID()}`);
  await mkdir(temporaire, { recursive: true });
  try {
    const fichierTemporaire = join(temporaire, "export.mp4");
    try {
      await rendre(ffmpeg, entrees, profil(true), temporaire, fichierTemporaire, outils);
    } catch (erreur) {
      if (outils.signal.aborted) throw erreur;
      outils.progression(0, "Nouvel essai sans accélération matérielle du décodage");
      await rendre(ffmpeg, entrees, profil(false), temporaire, fichierTemporaire, outils);
    }

    outils.progression(1, "Vérification du fichier exporté");
    const infos = await sonderMedia(ffprobe, fichierTemporaire);
    const volume = await mesurerVolume(ffmpeg, fichierTemporaire, prereglage.loudnessLufs, outils, "Mesure du volume exporté");
    const volumeLufs = volume === null ? null : Number(volume.input_i);
    const creteDb = volume === null ? null : Number(volume.input_tp);
    const controles: string[] = [];
    if (infos.video === null) controles.push("Le fichier n'a pas d'image.");
    else {
      if (infos.video.largeur !== format.largeur || infos.video.hauteur !== format.hauteur) {
        controles.push(`Résolution ${infos.video.largeur}x${infos.video.hauteur} au lieu de ${format.largeur}x${format.hauteur}.`);
      }
      if (infos.video.codec !== "h264") controles.push(`Codec vidéo ${infos.video.codec} au lieu de H.264.`);
    }
    if (infos.audio === null) controles.push("Le fichier n'a pas de son.");
    else if (infos.audio.codec !== "aac") controles.push(`Codec audio ${infos.audio.codec} au lieu de AAC.`);
    if (infos.duree === null || Math.abs(infos.duree - total) > ECART_DUREE_TOLERE) {
      controles.push(`Durée ${infos.duree?.toFixed(2) ?? "illisible"} s au lieu de ${total.toFixed(2)} s prévues.`);
    }
    if (volumeLufs === null) controles.push("Volume non mesurable.");
    else if (volumeLufs < -50) controles.push("Le son est quasiment silencieux.");
    else if (Math.abs(volumeLufs - prereglage.loudnessLufs) > ECART_VOLUME_TOLERE) {
      controles.push(`Volume ${volumeLufs.toFixed(1)} LUFS au lieu de ${prereglage.loudnessLufs} LUFS visés.`);
    }
    if (creteDb !== null && creteDb > CRETE_TOLEREE) controles.push(`Crêtes à ${creteDb.toFixed(1)} dBTP : risque de saturation.`);

    const fichier = `exports/${sortie}/${projet.id}.mp4`;
    const cible = join(dossier, fichier);
    await mkdir(dirname(cible), { recursive: true });
    await renommer(fichierTemporaire, cible);
    const fiche: ExportSortie = {
      sortie,
      fichier,
      version: plan.version,
      creeLe: new Date().toISOString(),
      largeur: format.largeur,
      hauteur: format.hauteur,
      imagesParSeconde: ips,
      encodeur: capacites.encodeur,
      dureePlan: total,
      duree: infos.duree,
      volumeLufs,
      creteDb,
      taille: (await stat(cible)).size,
      dureeRenduSecondes: Math.round((Date.now() - debutRendu) / 100) / 10,
      controles,
      publieLe: null,
    };
    await writeFile(join(dirname(cible), "description.txt"), await descriptionProjet(config.creations, projet, plan), "utf8");
    await mkdir(dirname(join(dossier, cheminFicheExport(sortie))), { recursive: true });
    await ecrireJsonAtomique(join(dossier, cheminFicheExport(sortie)), fiche);
    const bilan = controles.length === 0 ? "contrôles OK" : `${controles.length} point${controles.length > 1 ? "s" : ""} à vérifier`;
    return `Export ${DEFINITIONS_SORTIES[sortie].libelle} (${plan.version}) : ${temps(infos.duree ?? total)}, ${format.largeur}x${format.hauteur} à ${ips} i/s, ${volumeLufs?.toFixed(1) ?? "?"} LUFS, en ${Math.round(fiche.dureeRenduSecondes)} s (${bilan}).`;
  } finally {
    await rm(temporaire, { recursive: true, force: true });
  }
}

export async function listerTousLesExports(creations: string): Promise<ReponseExportsGlobaux> {
  const { projets } = await listerProjets(creations);
  const elements: ReponseExportsGlobaux["elements"] = [];
  for (const resume of projets) {
    const projet = await lireProjet(creations, resume.id);
    const { exports } = await listerExports(creations, resume.id);
    for (const fiche of exports) {
      elements.push({
        projet: {
          id: projet.id,
          chemin: projet.chemin,
          titre: projet.metadata.titre.fr,
          chaine: projet.metadata.chaine,
          datePublicationPrevue: projet.metadata.datePublicationPrevue,
          versionValidee: projet.metadata.versionValidee,
        },
        fiche,
      });
    }
  }
  return { elements };
}
