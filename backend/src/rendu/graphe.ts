import { plagesImage, type Categorie, type SegmentPlan } from "@editeur/shared";
import { z } from "zod";
import type { EncodeurH264 } from "../media/capacites.ts";

export const IMAGES_PAR_SECONDE_APERCU = 30;
export const LOUDNESS_APERCU = -14;
export const CRETE_MAX = -1;
const FONDU_AUDIO = 0.03;
const CATEGORIES_VERTICALES = new Set<Categorie>(["micro-histoire", "extrait-recit", "timelapse"]);
const TRANSFERTS_HDR = new Set(["arib-std-b67", "smpte2084"]);

export interface FormatRendu {
  largeur: number;
  hauteur: number;
}

export function estVertical(categorie: Categorie): boolean {
  return CATEGORIES_VERTICALES.has(categorie);
}

export function formatApercu(categorie: Categorie): FormatRendu {
  return estVertical(categorie) ? { largeur: 360, hauteur: 640 } : { largeur: 640, hauteur: 360 };
}

export function cadenceExport(cadences: (number | null)[]): number {
  const connues = cadences.filter((cadence): cadence is number => cadence !== null && cadence > 0);
  return connues.length === 0 ? 30 : Math.min(60, Math.round(Math.max(...connues)));
}

export interface DecoupeSegment {
  audio: { debut: number; duree: number };
  image: { debut: number; images: number };
}

const milliseconde = (valeur: number) => Math.round(valeur * 1000) / 1000;

export function decouper(segments: Pick<SegmentPlan, "debut" | "fin" | "decalageImage">[], ips: number): DecoupeSegment[] {
  const departsSon: number[] = [];
  let total = 0;
  for (const segment of segments) {
    departsSon.push(total);
    total += segment.fin - segment.debut;
  }
  const coupesImage = [...segments.map((segment, index) => (index === 0 ? 0 : (departsSon[index] ?? 0) + segment.decalageImage)), total];
  const plages = plagesImage(segments);
  return segments.map((segment, index) => ({
    audio: { debut: segment.debut, duree: milliseconde(segment.fin - segment.debut) },
    image: {
      debut: milliseconde(plages[index]?.debut ?? segment.debut),
      images: Math.round((coupesImage[index + 1] ?? total) * ips) - Math.round((coupesImage[index] ?? 0) * ips),
    },
  }));
}

const s = (valeur: number) => String(Math.round(valeur * 1000) / 1000);

export interface ProfilImage {
  format: FormatRendu;
  ips: number;
  placebo: boolean;
  acceleration: boolean;
}

export interface SourceImage {
  chemin: string;
  transfert: string | null;
}

export function estTransfertHdr(transfert: string | null): boolean {
  return transfert !== null && TRANSFERTS_HDR.has(transfert);
}

export function filtreImage(profil: ProfilImage, transfert: string | null): string {
  const { largeur: l, hauteur: h } = profil.format;
  const hdr = estTransfertHdr(transfert);
  if (profil.placebo) {
    const options = [
      `w=${l}`,
      `h=${h}`,
      "force_original_aspect_ratio=decrease",
      "pad_crop_ratio=0",
      "colorspace=bt709",
      "color_primaries=bt709",
      "color_trc=bt709",
      "range=tv",
      "format=yuv420p",
      ...(hdr ? ["tonemapping=bt.2390"] : []),
    ];
    return `libplacebo=${options.join(":")},setsar=1,fps=${profil.ips}`;
  }
  const etapes = [`scale=${l}:${h}:force_original_aspect_ratio=decrease:flags=bicubic`];
  if (hdr) {
    etapes.push(
      `zscale=tin=${transfert ?? "arib-std-b67"}:min=bt2020nc:pin=bt2020:t=linear:npl=203`,
      "format=gbrpf32le",
      "zscale=p=bt709",
      "tonemap=hable:desat=0",
      "zscale=t=bt709:m=bt709:r=tv",
    );
  }
  etapes.push("format=yuv420p", `pad=${l}:${h}:(ow-iw)/2:(oh-ih)/2`, "setsar=1", `fps=${profil.ips}`);
  return etapes.join(",");
}

export function peripheriqueImage(profil: ProfilImage): string[] {
  return profil.placebo ? ["-init_hw_device", "vulkan"] : [];
}

export function optionsEntreeImage(profil: ProfilImage): string[] {
  return profil.acceleration ? ["-hwaccel", "auto"] : [];
}

export function debitCibleKbps(format: FormatRendu, ips: number): number {
  const cote = Math.min(format.largeur, format.hauteur);
  const rapide = ips > 30;
  if (cote >= 2160) return rapide ? 60_000 : 40_000;
  if (cote >= 1440) return rapide ? 24_000 : 16_000;
  if (cote >= 1080) return rapide ? 12_000 : 8_000;
  if (cote >= 720) return rapide ? 7_500 : 5_000;
  return rapide ? 2_500 : 1_500;
}

const COULEURS_BT709 = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"];

export function encodageIntermediaire(encodeur: EncodeurH264 | "apercu", ips: number): string[] {
  const commun = ["-pix_fmt", "yuv420p", "-g", String(ips)];
  if (encodeur === "apercu") return ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23", ...commun];
  if (encodeur === "h264_nvenc") return ["-c:v", "h264_nvenc", "-preset", "p5", "-rc", "vbr", "-cq", "16", "-b:v", "0", ...commun, ...COULEURS_BT709];
  if (encodeur === "h264_videotoolbox") return ["-c:v", "h264_videotoolbox", "-q:v", "80", ...commun, ...COULEURS_BT709];
  return ["-c:v", "libx264", "-preset", "veryfast", "-crf", "14", ...commun, ...COULEURS_BT709];
}

export function encodageFinal(encodeur: EncodeurH264, format: FormatRendu, ips: number): string[] {
  const debit = debitCibleKbps(format, ips);
  const plafond = ["-maxrate", `${Math.round(debit * 1.5)}k`, "-bufsize", `${debit * 2}k`];
  const commun = ["-pix_fmt", "yuv420p", "-g", String(Math.round(ips / 2)), "-bf", "2", "-profile:v", "high", ...COULEURS_BT709];
  if (encodeur === "h264_nvenc") return ["-c:v", "h264_nvenc", "-preset", "p6", "-rc", "vbr", "-cq", "19", "-b:v", `${debit}k`, ...plafond, ...commun];
  if (encodeur === "h264_videotoolbox") return ["-c:v", "h264_videotoolbox", "-b:v", `${debit}k`, ...plafond, ...commun];
  return ["-c:v", "libx264", "-preset", "medium", "-crf", "18", ...plafond, ...commun];
}

export function argumentsClipVideo(
  source: SourceImage | null,
  debut: number,
  images: number,
  profil: ProfilImage,
  encodage: string[],
  cible: string,
): string[] {
  const { largeur, hauteur } = profil.format;
  const entree =
    source === null
      ? ["-f", "lavfi", "-i", `color=black:s=${largeur}x${hauteur}:r=${profil.ips}`]
      : [...peripheriqueImage(profil), ...optionsEntreeImage(profil), "-ss", s(debut), "-i", source.chemin, "-an", "-vf", `${filtreImage(profil, source.transfert)},tpad=stop_mode=clone:stop_duration=5`];
  return [...entree, "-frames:v", String(images), ...encodage, cible];
}

export function argumentsClipAudio(source: string, debut: number, duree: number, cible: string): string[] {
  const fondu = Math.min(FONDU_AUDIO, duree / 4);
  return [
    "-ss",
    s(debut),
    "-t",
    s(duree),
    "-i",
    source,
    "-vn",
    "-af",
    `apad=whole_dur=${s(duree)},afade=t=in:d=${s(fondu)},afade=t=out:st=${s(duree - fondu)}:d=${s(fondu)}`,
    "-ac",
    "2",
    "-ar",
    "48000",
    "-c:a",
    "pcm_s16le",
    cible,
  ];
}

export interface CoupeRendu {
  source: SourceImage;
  debut: number;
  duree: number;
  position: number;
}

export interface MusiqueRendu {
  source: string;
  dureeFichier: number | null;
  debut: number;
  fin: number | null;
  volumeDb: number;
  baisseSousVoix: boolean;
}

export interface Graphe {
  entrees: string[];
  filtre: string;
}

const STEREO = "aformat=sample_rates=48000:channel_layouts=stereo";

export function grapheAudio(total: number, musiques: MusiqueRendu[]): Graphe {
  const entrees: string[] = [];
  const filtres: string[] = [];
  const ducking = musiques.filter((musique) => musique.baisseSousVoix).length;
  const sorties = ["[voix]", ...Array.from({ length: ducking }, (_, index) => `[sc${index}]`)].join("");
  filtres.push(ducking > 0 ? `[0:a]${STEREO},asplit=${ducking + 1}${sorties}` : `[0:a]${STEREO}[voix]`);
  let pisteDucking = 0;
  const pistes = ["[voix]"];
  musiques.forEach((musique, index) => {
    entrees.push("-i", musique.source);
    const longueur = Math.max(0.1, Math.min((musique.fin ?? total) - musique.debut, musique.dureeFichier ?? Number.POSITIVE_INFINITY));
    const entree = Math.min(1, longueur / 3);
    const sortie = Math.min(1.5, longueur / 3);
    filtres.push(
      `[${1 + index}:a]${STEREO},atrim=0:${s(longueur)},asetpts=PTS-STARTPTS,afade=t=in:d=${s(entree)},afade=t=out:st=${s(longueur - sortie)}:d=${s(sortie)},volume=${s(musique.volumeDb)}dB,adelay=${Math.round(musique.debut * 1000)}:all=1[m${index}r]`,
    );
    filtres.push(
      musique.baisseSousVoix
        ? `[m${index}r][sc${pisteDucking++}]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=300[m${index}]`
        : `[m${index}r]anull[m${index}]`,
    );
    pistes.push(`[m${index}]`);
  });
  filtres.push(pistes.length > 1 ? `${pistes.join("")}amix=inputs=${pistes.length}:normalize=0:duration=first[a]` : "[voix]anull[a]");
  return { entrees, filtre: filtres.join(";") };
}

export function grapheVideo(profil: ProfilImage, coupes: CoupeRendu[], premiereEntree: number): Graphe {
  const entrees: string[] = [];
  const filtres: string[] = [];
  let video = "[0:v]setpts=PTS-STARTPTS";
  coupes.forEach((coupe, index) => {
    entrees.push(...optionsEntreeImage(profil), "-ss", s(coupe.debut), "-t", s(coupe.duree), "-i", coupe.source.chemin);
    filtres.push(`${video}[v${index}]`);
    filtres.push(`[${premiereEntree + index}:v]${filtreImage(profil, coupe.source.transfert)},setpts=PTS-STARTPTS+${s(coupe.position)}/TB[c${index}]`);
    video = `[v${index}][c${index}]overlay=eof_action=pass:enable='between(t,${s(coupe.position)},${s(coupe.position + coupe.duree)})'`;
  });
  filtres.push(`${video}[v]`);
  return { entrees, filtre: filtres.join(";") };
}

const nombreTexte = z.string().refine((valeur) => Number.isFinite(Number(valeur)));

const schemaMesure = z.object({
  input_i: nombreTexte,
  input_tp: nombreTexte,
  input_lra: nombreTexte,
  input_thresh: nombreTexte,
  target_offset: nombreTexte,
});

export type MesureLoudnorm = z.infer<typeof schemaMesure>;

export function lireMesureLoudnorm(lignes: string[]): MesureLoudnorm | null {
  const texte = lignes.join("\n");
  const debut = texte.lastIndexOf("{");
  const fin = texte.lastIndexOf("}");
  if (debut < 0 || fin < debut) return null;
  try {
    const resultat = schemaMesure.safeParse(JSON.parse(texte.slice(debut, fin + 1)));
    return resultat.success ? resultat.data : null;
  } catch {
    return null;
  }
}

export function filtreLoudnorm(cible: number, mesure: MesureLoudnorm | null): string {
  const base = `loudnorm=I=${cible}:TP=${CRETE_MAX}:LRA=11`;
  if (mesure === null) return base;
  return `${base}:measured_I=${mesure.input_i}:measured_TP=${mesure.input_tp}:measured_LRA=${mesure.input_lra}:measured_thresh=${mesure.input_thresh}:offset=${mesure.target_offset}:linear=true`;
}
