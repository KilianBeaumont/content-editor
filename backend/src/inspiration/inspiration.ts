import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import type { Readable } from "node:stream";
import {
  CATEGORIES,
  EXTENSIONS_INSPIRATION,
  schemaAnalyseInspiration,
  slug,
  tacheActive,
  type Categorie,
  type EtatAnalyse,
  type GuideCategorie,
  type ProfilInspiration,
  type ReponseGuides,
  type SaisieGuide,
  type VideoInspiration,
} from "@editeur/shared";
import { z } from "zod";
import { mettreALaCorbeille } from "../corbeille.ts";
import { codeErreur, ErreurHttp } from "../erreurs.ts";
import { cheminSur, ecrireJsonAtomique, existe, FichierInvalideError, lireJsonComplete, lireTexte } from "../fichiers.ts";
import type { FileDeTaches } from "../taches/file.ts";
import { enregistrerFlux, nomLibre, verifierExtension } from "../televersement.ts";
import { resumerProfil } from "./profil.ts";

export const dossierVideos = (categorie: Categorie) => `guides/${categorie}/inspiration/videos`;
export const dossierAnalyses = (categorie: Categorie) => `guides/${categorie}/inspiration/analyses`;

export function nomAnalyse(nomVideo: string): string {
  return slug(nomVideo.slice(0, nomVideo.length - extname(nomVideo).length)) || "video";
}

export function dossierAnalyse(categorie: Categorie, nomVideo: string): string {
  return `${dossierAnalyses(categorie)}/${nomAnalyse(nomVideo)}`;
}

const schemaEtat = z.object({ tailleSource: z.number(), modifieSource: z.string(), creeLe: z.string() });
export type EtatFichierAnalyse = z.infer<typeof schemaEtat>;

const schemaProfil = z.object({
  duree: z.number().nullable(),
  largeur: z.number().nullable(),
  hauteur: z.number().nullable(),
  imagesParSeconde: z.number().nullable(),
  coupes: z.number(),
  coupesParMinute: z.number().nullable(),
  dureeMoyennePlan: z.number().nullable(),
  dureeMedianePlan: z.number().nullable(),
  plusLongPlan: z.number().nullable(),
  premiereCoupe: z.number().nullable(),
  mots: z.number(),
  motsParMinute: z.number().nullable(),
  premierMot: z.number().nullable(),
  partParole: z.number().nullable(),
  plusLongSilence: z.number().nullable(),
}) satisfies z.ZodType<ProfilInspiration>;

async function lireSiPossible<T>(chemin: string, schema: z.ZodType<T>): Promise<T | null> {
  try {
    return await lireJsonComplete(chemin, schema, {});
  } catch (erreur) {
    if (codeErreur(erreur) === "ENOENT" || erreur instanceof FichierInvalideError) return null;
    throw erreur;
  }
}

async function lireTexteSiPresent(chemin: string, defaut: string): Promise<string> {
  try {
    return await lireTexte(chemin);
  } catch (erreur) {
    if (codeErreur(erreur) === "ENOENT") return defaut;
    throw erreur;
  }
}

async function listerVideos(creations: string, categorie: Categorie): Promise<string[]> {
  try {
    const entrees = await readdir(cheminSur(creations, dossierVideos(categorie)), { withFileTypes: true });
    return entrees
      .filter((entree) => entree.isFile() && !entree.name.startsWith(".") && (EXTENSIONS_INSPIRATION as readonly string[]).includes(extname(entree.name).toLowerCase()))
      .map((entree) => entree.name)
      .sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));
  } catch (erreur) {
    if (codeErreur(erreur) === "ENOENT") return [];
    throw erreur;
  }
}

async function planchesAnalyse(dossier: string, sousDossier: string): Promise<string[]> {
  try {
    return (await readdir(join(dossier, sousDossier))).filter((nom) => nom.endsWith(".jpg")).sort().map((nom) => `${sousDossier}/${nom}`);
  } catch (erreur) {
    if (codeErreur(erreur) === "ENOENT") return [];
    throw erreur;
  }
}

async function decrireVideo(creations: string, categorie: Categorie, nom: string): Promise<VideoInspiration> {
  const chemin = `${dossierVideos(categorie)}/${nom}`;
  const relatifAnalyse = dossierAnalyse(categorie, nom);
  const analyse = cheminSur(creations, relatifAnalyse);
  const infos = await stat(cheminSur(creations, chemin));
  const etat = await lireSiPossible(join(analyse, "etat.json"), schemaEtat);
  const valeur: EtatAnalyse =
    etat === null ? "absente" : etat.tailleSource === infos.size && etat.modifieSource === infos.mtime.toISOString() ? "a-jour" : "perimee";
  const planches = [...(await planchesAnalyse(analyse, "coupes")), ...(await planchesAnalyse(analyse, "planches"))].map((fichier) => `${relatifAnalyse}/${fichier}`);
  return {
    nom,
    chemin,
    taille: infos.size,
    etat: valeur,
    dossierAnalyse: relatifAnalyse,
    profil: etat === null ? null : await lireSiPossible(join(analyse, "profil.json"), schemaProfil),
    claude: etat === null ? null : await lireSiPossible(join(analyse, "analyse.json"), schemaAnalyseInspiration),
    planches,
  };
}

export function categorieValide(valeur: string): Categorie {
  const categorie = CATEGORIES.find((element) => element === valeur);
  if (categorie === undefined) throw new ErreurHttp(404, `Catégorie inconnue : ${valeur}`);
  return categorie;
}

export async function listerGuides(creations: string): Promise<ReponseGuides> {
  const guides = [];
  for (const categorie of CATEGORIES) {
    const videos = await Promise.all((await listerVideos(creations, categorie)).map((nom) => decrireVideo(creations, categorie, nom)));
    guides.push({ categorie, videos: videos.length, analysees: videos.filter((video) => video.etat === "a-jour" && video.claude !== null).length });
  }
  return { guides };
}

export async function lireGuide(creations: string, categorie: Categorie): Promise<GuideCategorie> {
  const racine = `guides/${categorie}`;
  return {
    categorie,
    style: await lireTexteSiPresent(cheminSur(creations, `${racine}/style.md`), ""),
    hooks: await lireTexteSiPresent(cheminSur(creations, `${racine}/hooks.md`), ""),
    videos: await Promise.all((await listerVideos(creations, categorie)).map((nom) => decrireVideo(creations, categorie, nom))),
  };
}

export async function ecrireGuide(creations: string, categorie: Categorie, saisie: SaisieGuide): Promise<GuideCategorie> {
  const racine = cheminSur(creations, `guides/${categorie}`);
  await mkdir(racine, { recursive: true });
  await writeFile(join(racine, "style.md"), saisie.style, "utf8");
  await writeFile(join(racine, "hooks.md"), saisie.hooks, "utf8");
  return lireGuide(creations, categorie);
}

export async function televerserInspiration(creations: string, categorie: Categorie, nomFichier: string, flux: Readable): Promise<VideoInspiration> {
  verifierExtension(nomFichier, EXTENSIONS_INSPIRATION);
  const dossier = cheminSur(creations, dossierVideos(categorie));
  await mkdir(dossier, { recursive: true });
  const nom = await nomLibre(dossier, nomFichier, "inspiration");
  await enregistrerFlux(flux, dossier, nom);
  return decrireVideo(creations, categorie, nom);
}

export async function supprimerInspiration(creations: string, categorie: Categorie, nom: string): Promise<{ corbeille: string }> {
  const chemin = `${dossierVideos(categorie)}/${nom}`;
  if (nom.includes("/") || nom.includes("\\") || !(await existe(cheminSur(creations, chemin)))) throw new ErreurHttp(404, `Vidéo introuvable : ${nom}`);
  const corbeille = await mettreALaCorbeille(creations, chemin, `guides/${categorie}`);
  const analyse = dossierAnalyse(categorie, nom);
  if (await existe(cheminSur(creations, analyse))) await mettreALaCorbeille(creations, analyse, `guides/${categorie}`);
  return { corbeille };
}

export async function lancerAnalyses(creations: string, file: FileDeTaches, categorie: Categorie, demandes: string[] | null): Promise<number> {
  const videos = await lireGuide(creations, categorie).then((guide) => guide.videos);
  for (const nom of demandes ?? []) {
    if (!videos.some((video) => video.nom === nom)) throw new ErreurHttp(400, `Vidéo introuvable : ${nom}`);
  }
  const enCours = new Set(
    file
      .liste()
      .filter((tache) => tache.type === "analyse-inspiration" && tache.parametres.categorie === categorie && tacheActive(tache))
      .map((tache) => String(tache.parametres.nom)),
  );
  const choisies = videos
    .filter((video) => (demandes === null ? video.etat !== "a-jour" || video.claude === null : demandes.includes(video.nom)))
    .filter((video) => !enCours.has(video.nom));
  for (const video of choisies) file.ajouter("analyse-inspiration", `Analyse de ${video.nom}`, null, { categorie, nom: video.nom });
  return choisies.length;
}

export async function referencesInspiration(creations: string, categorie: Categorie): Promise<string[]> {
  const videos = (await lireGuide(creations, categorie)).videos.filter((video) => video.profil !== null && video.claude !== null);
  if (videos.length === 0) return [];
  const lignes = [
    `## Références d'inspiration (guides/${categorie}/inspiration)`,
    "",
    "Des vidéos que l'utilisateur aime, analysées. Inspire-toi de leurs techniques et de leur rythme sans les copier ; le guide de style et les consignes passent avant.",
    "",
  ];
  for (const video of videos) {
    if (video.profil === null || video.claude === null) continue;
    lignes.push(`### ${video.nom}`, "", `- Profil : ${resumerProfil(video.profil)}`, `- Ce qu'on en retient : ${video.claude.resume}`);
    if (video.claude.techniques.length > 0) lignes.push("- Techniques :", ...video.claude.techniques.map((technique) => `  - ${technique}`));
    lignes.push("");
  }
  return lignes;
}

export async function ecrireEtatAnalyse(dossier: string, etat: EtatFichierAnalyse): Promise<void> {
  await ecrireJsonAtomique(join(dossier, "etat.json"), etat);
}
