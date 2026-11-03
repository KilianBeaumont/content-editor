import { estCategorieVerticale, plagesImage, type Cadrage, type Categorie, type EtatCadre, type SegmentPlan } from "@editeur/shared";
import { z } from "zod";
import type { Encodeur } from "../media/capacites.ts";

export const IMAGES_PAR_SECONDE_APERCU = 30;
export const LOUDNESS_APERCU = -14;
export const CRETE_MAX = -1;
const FONDU_AUDIO = 0.03;
const TRANSFERTS_HDR = new Set(["arib-std-b67", "smpte2084"]);

export interface FormatRendu {
  largeur: number;
  hauteur: number;
}

export function estVertical(categorie: Categorie): boolean {
  return estCategorieVerticale(categorie);
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
  hdr: boolean;
}

export interface SourceImage {
  chemin: string;
  transfert: string | null;
  largeur: number | null;
  hauteur: number | null;
}

export function estTransfertHdr(transfert: string | null): boolean {
  return transfert !== null && TRANSFERTS_HDR.has(transfert);
}

function filtreHlgClassique(transfert: string | null): string[] {
  if (transfert === "arib-std-b67") return [];
  const entree = transfert === "smpte2084" ? "tin=smpte2084:min=bt2020nc:pin=bt2020" : "tin=bt709:min=bt709:pin=bt709";
  return [`zscale=${entree}:t=linear:npl=203`, "format=gbrpf32le", "zscale=p=bt2020:t=arib-std-b67:m=bt2020nc:r=tv"];
}

function filtreAjuste(profil: ProfilImage, transfert: string | null): string {
  const { largeur: l, hauteur: h } = profil.format;
  const hdr = estTransfertHdr(transfert);
  if (profil.placebo) {
    const couleurs = profil.hdr
      ? ["colorspace=bt2020nc", "color_primaries=bt2020", "color_trc=arib-std-b67", "range=tv", "format=yuv420p10le"]
      : ["colorspace=bt709", "color_primaries=bt709", "color_trc=bt709", "range=tv", "format=yuv420p", ...(hdr ? ["tonemapping=bt.2390"] : [])];
    const options = [`w=${l}`, `h=${h}`, "force_original_aspect_ratio=decrease", "pad_crop_ratio=0", ...couleurs];
    return `libplacebo=${options.join(":")},setsar=1,fps=${profil.ips}`;
  }
  const etapes = [`scale=${l}:${h}:force_original_aspect_ratio=decrease:flags=bicubic`];
  if (profil.hdr) {
    etapes.push(...filtreHlgClassique(transfert), "format=yuv420p10le", `pad=${l}:${h}:(ow-iw)/2:(oh-ih)/2`, "setsar=1", `fps=${profil.ips}`);
    return etapes.join(",");
  }
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

function filtresCouleurs(profil: ProfilImage, transfert: string | null): string[] {
  const hdr = estTransfertHdr(transfert);
  if (profil.placebo) {
    const options = profil.hdr
      ? ["colorspace=bt2020nc", "color_primaries=bt2020", "color_trc=arib-std-b67", "range=tv", "format=yuv420p10le"]
      : ["colorspace=bt709", "color_primaries=bt709", "color_trc=bt709", "range=tv", "format=yuv420p", ...(hdr ? ["tonemapping=bt.2390"] : [])];
    return [`libplacebo=${options.join(":")}`];
  }
  if (profil.hdr) return [...filtreHlgClassique(transfert), "format=yuv420p10le"];
  if (!hdr) return ["format=yuv420p"];
  return [
    `zscale=tin=${transfert ?? "arib-std-b67"}:min=bt2020nc:pin=bt2020:t=linear:npl=203`,
    "format=gbrpf32le",
    "zscale=p=bt709",
    "tonemap=hable:desat=0",
    "zscale=t=bt709:m=bt709:r=tv",
    "format=yuv420p",
  ];
}

const pair = (valeur: number) => Math.max(2, Math.round(valeur / 2) * 2);

export function fenetre(source: { largeur: number; hauteur: number }, format: FormatRendu, zoom: number): { largeur: number; hauteur: number } {
  const ratio = format.largeur / format.hauteur;
  const base = source.largeur / source.hauteur > ratio ? { largeur: source.hauteur * ratio, hauteur: source.hauteur } : { largeur: source.largeur, hauteur: source.largeur / ratio };
  return { largeur: Math.min(source.largeur, pair(base.largeur / zoom)), hauteur: Math.min(source.hauteur, pair(base.hauteur / zoom)) };
}

function progression(variable: string, duree: number): string {
  const p = `min(1,max(0,${variable}/${s(Math.max(0.04, duree))}))`;
  return `(3*pow(${p},2)-2*pow(${p},3))`;
}

function interpole(debut: number, fin: number, variable: string, duree: number): string {
  return Math.abs(fin - debut) < 0.0005 ? s(debut) : `(${s(debut)}+${s(fin - debut)}*${progression(variable, duree)})`;
}

function filtresRecadrage(source: { largeur: number; hauteur: number }, profil: ProfilImage, debut: EtatCadre, fin: EtatCadre, duree: number): string[] {
  const { largeur: l, hauteur: h } = profil.format;
  const zoomMin = Math.min(debut.zoom, fin.zoom);
  const cadre = fenetre(source, profil.format, zoomMin);
  const x = `max(0,min(iw-${cadre.largeur},${interpole(debut.x, fin.x, "t", duree)}*iw-${cadre.largeur / 2}))`;
  const y = `max(0,min(ih-${cadre.hauteur},${interpole(debut.y, fin.y, "t", duree)}*ih-${cadre.hauteur / 2}))`;
  const filtres = [`crop=w=${cadre.largeur}:h=${cadre.hauteur}:x='${x}':y='${y}'`];
  if (Math.abs(debut.zoom - fin.zoom) < 0.0005) return [...filtres, `scale=${l}:${h}:flags=bicubic`];
  const zoom = interpole(debut.zoom / zoomMin, fin.zoom / zoomMin, "it", duree);
  return [...filtres, `scale=${l * 2}:${h * 2}:flags=bicubic`, `zoompan=z='${zoom}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${l}x${h}:fps=${profil.ips}`];
}

function fondFlou(profil: ProfilImage, suffixe: string): string {
  const { largeur: l, hauteur: h } = profil.format;
  const [a, b, fond, avant] = ["a", "b", "fond", "avant"].map((nom) => `${nom}${suffixe}`);
  return [
    `split[${a}][${b}];[${a}]scale=${l}:${h}:force_original_aspect_ratio=increase,crop=${l}:${h},boxblur=20:2,eq=brightness=-0.08[${fond}]`,
    `[${b}]scale=${l}:${h}:force_original_aspect_ratio=decrease[${avant}]`,
    `[${fond}][${avant}]overlay=(W-w)/2:(H-h)/2${profil.hdr ? ":format=yuv420p10" : ""}`,
  ].join(";");
}

export function filtreImage(profil: ProfilImage, source: SourceImage, cadrage: Cadrage | null = null, duree = 0, suffixe = ""): string {
  if (cadrage === null || source.largeur === null || source.hauteur === null) return filtreAjuste(profil, source.transfert);
  const debut = [...filtresCouleurs(profil, source.transfert), `fps=${profil.ips}`];
  const format = profil.hdr ? "format=yuv420p10le" : "format=yuv420p";
  if (cadrage.mode === "fond-flou") return `${debut.join(",")},${fondFlou(profil, suffixe)},setsar=1,${format}`;
  const dimensions = { largeur: source.largeur, hauteur: source.hauteur };
  return [...debut, ...filtresRecadrage(dimensions, profil, cadrage.debut, cadrage.fin ?? cadrage.debut, duree), "setsar=1", format].join(",");
}

export function peripheriqueImage(profil: ProfilImage): string[] {
  return profil.placebo ? ["-init_hw_device", "vulkan"] : [];
}

export function optionsEntreeImage(profil: ProfilImage): string[] {
  return profil.acceleration ? ["-hwaccel", "auto"] : [];
}

function debitSdrKbps(format: FormatRendu, ips: number): number {
  const cote = Math.min(format.largeur, format.hauteur);
  const rapide = ips > 30;
  if (cote >= 2160) return rapide ? 60_000 : 40_000;
  if (cote >= 1440) return rapide ? 24_000 : 16_000;
  if (cote >= 1080) return rapide ? 12_000 : 8_000;
  if (cote >= 720) return rapide ? 7_500 : 5_000;
  return rapide ? 2_500 : 1_500;
}

export function debitCibleKbps(format: FormatRendu, ips: number, hdr = false): number {
  return Math.round(debitSdrKbps(format, ips) * (hdr ? 1.25 : 1));
}

const COULEURS_BT709 = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"];
const COULEURS_HLG = ["-colorspace", "bt2020nc", "-color_primaries", "bt2020", "-color_trc", "arib-std-b67", "-color_range", "tv"];

function encodageHevc(encodeur: Encodeur, reglage: "clip" | "final", debit: number, ips: number): string[] {
  const plafond = reglage === "final" ? ["-maxrate", `${Math.round(debit * 1.15)}k`, "-bufsize", `${debit * 2}k`] : [];
  const gop = ["-g", String(reglage === "final" ? Math.round(ips / 2) : ips)];
  const fin = [...gop, "-tag:v", "hvc1", ...COULEURS_HLG];
  if (encodeur === "hevc_nvenc") {
    const qualite = reglage === "final" ? ["-preset", "p6", "-rc", "vbr", "-cq", "19", "-b:v", `${debit}k`] : ["-preset", "p5", "-rc", "vbr", "-cq", "16", "-b:v", "0"];
    return ["-c:v", "hevc_nvenc", ...qualite, ...plafond, "-profile:v", "main10", "-pix_fmt", "p010le", ...fin];
  }
  if (encodeur === "hevc_videotoolbox") {
    const qualite = reglage === "final" ? ["-b:v", `${debit}k`] : ["-q:v", "80"];
    return ["-c:v", "hevc_videotoolbox", ...qualite, ...plafond, "-profile:v", "main10", "-pix_fmt", "p010le", ...fin];
  }
  const qualite = reglage === "final" ? ["-preset", "medium", "-crf", "18"] : ["-preset", "veryfast", "-crf", "14"];
  return ["-c:v", "libx265", ...qualite, ...plafond, "-pix_fmt", "yuv420p10le", ...fin];
}

function estHevc(encodeur: Encodeur): boolean {
  return encodeur.startsWith("hevc") || encodeur === "libx265";
}

export function encodageIntermediaire(encodeur: Encodeur | "apercu", ips: number): string[] {
  if (encodeur !== "apercu" && estHevc(encodeur)) return encodageHevc(encodeur, "clip", 0, ips);
  const commun = ["-pix_fmt", "yuv420p", "-g", String(ips)];
  if (encodeur === "apercu") return ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23", ...commun];
  if (encodeur === "h264_nvenc") return ["-c:v", "h264_nvenc", "-preset", "p5", "-rc", "vbr", "-cq", "16", "-b:v", "0", ...commun, ...COULEURS_BT709];
  if (encodeur === "h264_videotoolbox") return ["-c:v", "h264_videotoolbox", "-q:v", "80", ...commun, ...COULEURS_BT709];
  return ["-c:v", "libx264", "-preset", "veryfast", "-crf", "14", ...commun, ...COULEURS_BT709];
}

export function encodageFinal(encodeur: Encodeur, format: FormatRendu, ips: number): string[] {
  if (estHevc(encodeur)) return encodageHevc(encodeur, "final", debitCibleKbps(format, ips, true), ips);
  const debit = debitCibleKbps(format, ips);
  const plafond = ["-maxrate", `${Math.round(debit * 1.15)}k`, "-bufsize", `${debit * 2}k`];
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
  cadrage: Cadrage | null = null,
): string[] {
  const { largeur, hauteur } = profil.format;
  const entree =
    source === null
      ? ["-f", "lavfi", "-i", `color=black:s=${largeur}x${hauteur}:r=${profil.ips}${profil.hdr ? ",format=yuv420p10le" : ""}`]
      : [...peripheriqueImage(profil), ...optionsEntreeImage(profil), "-ss", s(debut), "-i", source.chemin, "-an", "-vf", `${filtreImage(profil, source, cadrage, images / profil.ips)},tpad=stop_mode=clone:stop_duration=5`];
  return [...entree, "-frames:v", String(images), ...encodage, cible];
}

export function argumentsClipAudio(source: string, debut: number, duree: number, cible: string, fondus = { entree: true, sortie: true }): string[] {
  const fondu = Math.min(FONDU_AUDIO, duree / 4);
  const filtres = [`apad=whole_dur=${s(duree)}`, ...(fondus.entree ? [`afade=t=in:d=${s(fondu)}`] : []), ...(fondus.sortie ? [`afade=t=out:st=${s(duree - fondu)}:d=${s(fondu)}`] : [])];
  return [
    "-ss",
    s(debut),
    "-t",
    s(duree),
    "-i",
    source,
    "-vn",
    "-af",
    filtres.join(","),
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
  cadrage: Cadrage | null;
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
    filtres.push(`[${premiereEntree + index}:v]${filtreImage(profil, coupe.source, coupe.cadrage, coupe.duree, `c${index}`)},setpts=PTS-STARTPTS+${s(coupe.position)}/TB[c${index}]`);
    video = `[v${index}][c${index}]overlay=eof_action=pass${profil.hdr ? ":format=yuv420p10" : ""}:enable='between(t,${s(coupe.position)},${s(coupe.position + coupe.duree)})'`;
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
