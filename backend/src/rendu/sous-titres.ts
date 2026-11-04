import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import type { PlanMontage, Projet, ReglagesSousTitres, Transcription } from "@editeur/shared";
import { lireAsset } from "../bibliotheque/bibliotheque.ts";
import { cheminSur } from "../fichiers.ts";
import { lireParametres } from "../parametres.ts";
import { lireTranscription } from "../projets/transcriptions.ts";
import type { FormatRendu } from "./graphe.ts";

export const EXTENSIONS_POLICE_SOUS_TITRES = [".ttf", ".otf", ".ttc"];
const PARASITES = new Set(["euh", "heu", "hum", "hmm", "um", "uh", "erm", "euhm"]);
const PAUSE_GROUPE = 0.35;
const DUREE_MAX_GROUPE = 2.2;
const MAINTIEN = 0.25;

export interface MotAffiche {
  mot: string;
  debut: number;
  fin: number;
}

function lireTexteNom(octets: Buffer, debut: number, longueur: number, plateforme: number): string {
  const morceau = octets.subarray(debut, debut + longueur);
  if (plateforme === 3 || plateforme === 0) {
    let texte = "";
    for (let i = 0; i + 1 < morceau.length; i += 2) texte += String.fromCharCode(morceau.readUInt16BE(i));
    return texte;
  }
  return morceau.toString("latin1");
}

export function nomFamillePolice(octets: Buffer): string | null {
  if (octets.length < 12) return null;
  const base = octets.toString("latin1", 0, 4) === "ttcf" ? octets.readUInt32BE(12) : 0;
  const tables = octets.readUInt16BE(base + 4);
  for (let index = 0; index < tables; index++) {
    const entree = base + 12 + index * 16;
    if (entree + 16 > octets.length || octets.toString("latin1", entree, entree + 4) !== "name") continue;
    const table = octets.readUInt32BE(entree + 8);
    const nombre = octets.readUInt16BE(table + 2);
    const chaines = table + octets.readUInt16BE(table + 4);
    const candidats: { priorite: number; texte: string }[] = [];
    for (let numero = 0; numero < nombre; numero++) {
      const enregistrement = table + 6 + numero * 12;
      const plateforme = octets.readUInt16BE(enregistrement);
      const langue = octets.readUInt16BE(enregistrement + 4);
      const identifiant = octets.readUInt16BE(enregistrement + 6);
      if (identifiant !== 1 && identifiant !== 16) continue;
      const texte = lireTexteNom(octets, chaines + octets.readUInt16BE(enregistrement + 10), octets.readUInt16BE(enregistrement + 8), plateforme).trim();
      if (texte === "") continue;
      const priorite = (identifiant === 1 ? 0 : 10) + (plateforme === 3 ? 0 : 5) + (langue === 0x409 || langue === 0 ? 0 : 1);
      candidats.push({ priorite, texte });
    }
    candidats.sort((a, b) => a.priorite - b.priorite);
    return candidats[0]?.texte ?? null;
  }
  return null;
}

export function motsSurTimeline(plan: Pick<PlanMontage, "segments">, transcriptions: Map<string, Transcription>): MotAffiche[] {
  const mots: MotAffiche[] = [];
  let depart = 0;
  for (const segment of plan.segments) {
    const transcription = transcriptions.get(segment.source);
    for (const passage of transcription?.segments ?? []) {
      for (const mot of passage.mots) {
        const milieu = (mot.debut + mot.fin) / 2;
        const texte = mot.mot.trim();
        if (milieu < segment.debut || milieu > segment.fin || texte === "") continue;
        if (PARASITES.has(texte.toLowerCase().replace(/[^\p{L}]/gu, ""))) continue;
        const debut = depart + Math.max(0, mot.debut - segment.debut);
        const fin = depart + Math.min(segment.fin, mot.fin) - segment.debut;
        mots.push({ mot: texte, debut, fin: Math.max(fin, debut + 0.05) });
      }
    }
    depart += segment.fin - segment.debut;
  }
  return mots.sort((a, b) => a.debut - b.debut);
}

export function grouperMots(mots: MotAffiche[], motsMax: number): MotAffiche[][] {
  const groupes: MotAffiche[][] = [];
  let courant: MotAffiche[] = [];
  for (const mot of mots) {
    const precedent = courant.at(-1);
    const premier = courant[0];
    const couper =
      precedent !== undefined &&
      (courant.length >= motsMax || mot.debut - precedent.fin > PAUSE_GROUPE || /[.!?…]$/.test(precedent.mot) || (premier !== undefined && mot.fin - premier.debut > DUREE_MAX_GROUPE));
    if (couper) {
      groupes.push(courant);
      courant = [];
    }
    courant.push(mot);
  }
  if (courant.length > 0) groupes.push(courant);
  return groupes;
}

function couleurAss(hexadecimal: string): string {
  const [r, v, b] = [1, 3, 5].map((position) => hexadecimal.slice(position, position + 2).toUpperCase());
  return `&H00${b ?? "FF"}${v ?? "FF"}${r ?? "FF"}&`;
}

function horaire(secondes: number): string {
  const centiemes = Math.max(0, Math.round(secondes * 100));
  const h = Math.floor(centiemes / 360000);
  const m = Math.floor((centiemes % 360000) / 6000);
  const s = Math.floor((centiemes % 6000) / 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(centiemes % 100).padStart(2, "0")}`;
}

function echapper(texte: string): string {
  return texte.replace(/\\/g, "＼").replace(/[{}]/g, "");
}

const ACCROCHE_XXL = 2.5;
const ECHELLE_XXL = 1.8;
const POP = "\\fscx70\\fscy70\\t(0,120,\\fscx112\\fscy112)\\t(120,220,\\fscx100\\fscy100)";

function style(nom: string, famille: string, taille: number, couleur: string, contour: number, marge: number, fond: boolean): string {
  const bordure = fond ? `3,${Math.max(1, Math.round(taille * 0.22))},0` : `1,${contour},0`;
  const contourCouleur = fond ? "&H50000000&" : "&H00000000&";
  return `Style: ${nom},${famille.replace(/,/g, " ")},${taille},${couleur},${couleur},${contourCouleur},&H64000000&,0,0,0,0,100,100,0,0,${bordure},5,${marge},${marge},0,1`;
}

export function genererAss(mots: MotAffiche[], format: FormatRendu, reglages: ReglagesSousTitres, famille: string): string {
  const { largeur: l, hauteur: h } = format;
  const taille = Math.round((reglages.taillePourcent / 100) * h);
  const contour = Math.round((reglages.contour * Math.min(l, h)) / 1080 * 10) / 10;
  const marge = Math.round(l * 0.08);
  const base = couleurAss(reglages.couleur);
  const accent = couleurAss(reglages.couleurAccent);
  const position = `\\an5\\pos(${Math.round(l / 2)},${Math.round((reglages.positionPourcent / 100) * h)})`;
  const casse = (mot: string) => echapper(reglages.majuscules ? mot.toLocaleUpperCase("fr") : mot);
  const accroche = reglages.accrocheXxl ? mots.filter((mot) => mot.debut < ACCROCHE_XXL) : [];
  const groupes = grouperMots(mots.slice(accroche.length), reglages.motsMax);
  const lignes = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${l}`,
    `PlayResY: ${h}`,
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    style("Defaut", famille, taille, base, contour, marge, reglages.fond),
    style("Accroche", famille, Math.round(taille * ECHELLE_XXL), accent, Math.round(contour * ECHELLE_XXL * 10) / 10, marge, false),
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];
  const positionAccroche = `\\an5\\pos(${Math.round(l / 2)},${Math.round(h * 0.45)})`;
  accroche.forEach((mot, index) => {
    const fin = Math.min(mot.fin + MAINTIEN, accroche[index + 1]?.debut ?? groupes[0]?.[0]?.debut ?? Number.POSITIVE_INFINITY);
    if (fin > mot.debut) lignes.push(`Dialogue: 0,${horaire(mot.debut)},${horaire(fin)},Accroche,,0,0,0,,{${positionAccroche}${POP}}${casse(mot.mot)}`);
  });
  groupes.forEach((groupe, numero) => {
    const suivant = groupes[numero + 1]?.[0]?.debut ?? Number.POSITIVE_INFINITY;
    const finGroupe = Math.min((groupe.at(-1)?.fin ?? 0) + MAINTIEN, suivant);
    const elements = groupe.map((mot) => casse(mot.mot));
    if (!reglages.surlignage) {
      const debutGroupe = groupe[0]?.debut ?? 0;
      if (finGroupe > debutGroupe) lignes.push(`Dialogue: 0,${horaire(debutGroupe)},${horaire(finGroupe)},Defaut,,0,0,0,,{${position}}${elements.join(" ")}`);
      return;
    }
    groupe.forEach((mot, index) => {
      const fin = index === groupe.length - 1 ? finGroupe : (groupe[index + 1]?.debut ?? finGroupe);
      if (fin <= mot.debut) return;
      const texte = elements.map((element, rang) => (rang === index ? `{\\c${accent}}${element}{\\c${base}}` : element)).join(" ");
      lignes.push(`Dialogue: 0,${horaire(mot.debut)},${horaire(fin)},Defaut,,0,0,0,,{${position}}${texte}`);
    });
  });
  return `${lignes.join("\n")}\n`;
}

export interface SousTitresRendu {
  ass: string;
  police: string;
}

export async function policeDesTextes(creations: string, reglages: ReglagesSousTitres): Promise<string> {
  if (reglages.police === null) throw new Error("Choisis la police des sous-titres et des textes à l'écran : Paramètres → Sous-titres (une police de ta bibliothèque).");
  const { asset } = await lireAsset(creations, reglages.police);
  if (asset.type !== "police" || !EXTENSIONS_POLICE_SOUS_TITRES.includes(extname(asset.chemin).toLowerCase())) {
    throw new Error(`La police des sous-titres doit être un fichier ${EXTENSIONS_POLICE_SOUS_TITRES.join(", ")} de la bibliothèque.`);
  }
  return cheminSur(creations, `bibliotheque/${asset.chemin}`);
}

export async function preparerSousTitres(creations: string, projet: Projet, plan: PlanMontage, format: FormatRendu): Promise<SousTitresRendu | null> {
  if (!plan.sousTitres) return null;
  const { sousTitres: reglages } = await lireParametres(creations);
  const police = await policeDesTextes(creations, reglages);
  const famille = nomFamillePolice(await readFile(police));
  if (famille === null) throw new Error(`Impossible de lire le nom de la police ${police.split(/[\\/]/).at(-1) ?? ""}.`);
  const transcriptions = new Map<string, Transcription>();
  for (const source of new Set(plan.segments.map((segment) => segment.source))) {
    try {
      transcriptions.set(source, await lireTranscription(creations, projet.id, source));
    } catch {
      continue;
    }
  }
  return { ass: genererAss(motsSurTimeline(plan, transcriptions), format, reglages, famille), police };
}
