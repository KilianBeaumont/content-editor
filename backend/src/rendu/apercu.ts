import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { cheminApercu, cheminRendu, dureePlan, genreFichier, type RenduApercu } from "@editeur/shared";
import type { Contexte } from "../contexte.ts";
import { cheminSur, ecrireJsonAtomique, renommer } from "../fichiers.ts";
import { sonderMedia } from "../media/ffprobe.ts";
import { listerVersions, lirePlan } from "../plans/plans.ts";
import { lireProjet } from "../projets/projets.ts";
import { etatPreparation, lirePreparation } from "../rushes/etat.ts";
import type { OutilsTache } from "../taches/file.ts";
import { encodageIntermediaire, formatApercu, IMAGES_PAR_SECONDE_APERCU, LOUDNESS_APERCU, type ProfilImage, type SourceImage } from "./graphe.ts";
import { rendre } from "./moteur.ts";
import { resoudreMusiques, verifierPlanSansErreur } from "./ressources.ts";

const ECART_DUREE_TOLERE = 0.15;

function temps(secondes: number): string {
  return `${Math.floor(secondes / 60)}:${String(Math.round(secondes % 60)).padStart(2, "0")}`;
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
  await verifierPlanSansErreur(config.creations, projet, plan, ffprobe);

  const proxies = new Map<string, SourceImage>();
  for (const chemin of new Set([...plan.segments.map((segment) => segment.source), ...plan.plansDeCoupe.map((coupe) => coupe.source)])) {
    if (genreFichier(chemin) !== "video") continue;
    const preparation = await lirePreparation(dossier, chemin);
    if (preparation?.proxy === null || preparation?.proxy === undefined || (await etatPreparation(dossier, chemin, preparation)) !== "a-jour") {
      throw new Error(`Prépare d'abord ${chemin} (section Analyse des rushes) : l'aperçu est rendu à partir des proxys.`);
    }
    const proxy = cheminSur(dossier, preparation.proxy);
    const video = (await sonderMedia(ffprobe, proxy)).video;
    proxies.set(chemin, { chemin: proxy, transfert: null, largeur: video?.largeur ?? null, hauteur: video?.hauteur ?? null });
  }

  const format = formatApercu(projet.metadata.categorie);
  const image: ProfilImage = { format, ips: IMAGES_PAR_SECONDE_APERCU, placebo: false, acceleration: false, hdr: false };
  const encodage = encodageIntermediaire("apercu", IMAGES_PAR_SECONDE_APERCU);
  const total = dureePlan(plan);
  const temporaire = join(dossier, "travail", "rendu", `${version}-${randomUUID()}`);
  await mkdir(temporaire, { recursive: true });
  try {
    const sortie = join(temporaire, "apercu.mp4");
    await rendre(
      ffmpeg,
      {
        plan,
        image: (chemin) => proxies.get(chemin) ?? null,
        son: (chemin) => proxies.get(chemin)?.chemin ?? cheminSur(dossier, chemin),
        musiques: await resoudreMusiques(config.creations, dossier, plan, ffprobe),
      },
      { image, encodageClip: encodage, encodageSortie: encodage, loudness: LOUDNESS_APERCU, deuxPasses: false, debitAudio: "128k" },
      temporaire,
      sortie,
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
