import { plagesImage, type Categorie, type SegmentPlan } from "@editeur/shared";

export const IMAGES_PAR_SECONDE = 30;
export const LOUDNESS_APERCU = -14;
const FONDU_AUDIO = 0.03;
const CATEGORIES_VERTICALES = new Set<Categorie>(["micro-histoire", "extrait-recit", "timelapse"]);

export interface FormatRendu {
  largeur: number;
  hauteur: number;
}

export function formatApercu(categorie: Categorie): FormatRendu {
  return CATEGORIES_VERTICALES.has(categorie) ? { largeur: 360, hauteur: 640 } : { largeur: 640, hauteur: 360 };
}

export interface DecoupeSegment {
  audio: { debut: number; duree: number };
  image: { debut: number; images: number };
}

const milliseconde = (valeur: number) => Math.round(valeur * 1000) / 1000;

export function decouper(segments: Pick<SegmentPlan, "debut" | "fin" | "decalageImage">[], ips = IMAGES_PAR_SECONDE): DecoupeSegment[] {
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

export function filtreCadre(format: FormatRendu): string {
  const { largeur: l, hauteur: h } = format;
  return `scale=${l}:${h}:force_original_aspect_ratio=decrease,pad=${l}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${IMAGES_PAR_SECONDE}`;
}

const ENCODAGE_VIDEO = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-g", String(IMAGES_PAR_SECONDE)];

export function argumentsClipVideo(source: string | null, debut: number, images: number, format: FormatRendu, cible: string): string[] {
  const entree =
    source === null
      ? ["-f", "lavfi", "-i", `color=black:s=${format.largeur}x${format.hauteur}:r=${IMAGES_PAR_SECONDE}`]
      : ["-ss", s(debut), "-i", source, "-an", "-vf", `${filtreCadre(format)},tpad=stop_mode=clone:stop_duration=5`];
  return [...entree, "-frames:v", String(images), ...ENCODAGE_VIDEO, cible];
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
  source: string;
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

export interface GrapheFinal {
  entrees: string[];
  filtre: string;
}

const STEREO = "aformat=sample_rates=48000:channel_layouts=stereo";

export function grapheFinal(format: FormatRendu, total: number, coupes: CoupeRendu[], musiques: MusiqueRendu[]): GrapheFinal {
  const entrees: string[] = [];
  const filtres: string[] = [];

  let video = "[0:v]setpts=PTS-STARTPTS";
  coupes.forEach((coupe, index) => {
    entrees.push("-ss", s(coupe.debut), "-t", s(coupe.duree), "-i", coupe.source);
    filtres.push(`${video}[v${index}]`);
    filtres.push(`[${2 + index}:v]${filtreCadre(format)},setpts=PTS-STARTPTS+${s(coupe.position)}/TB[c${index}]`);
    video = `[v${index}][c${index}]overlay=eof_action=pass:enable='between(t,${s(coupe.position)},${s(coupe.position + coupe.duree)})'`;
  });
  filtres.push(`${video}[v]`);

  const ducking = musiques.filter((musique) => musique.baisseSousVoix).length;
  const voix = ["[voix]", ...Array.from({ length: ducking }, (_, index) => `[sc${index}]`)].join("");
  filtres.push(`[1:a]${STEREO}${ducking > 0 ? `,asplit=${ducking + 1}` : ""}${ducking > 0 ? voix : "[voix]"}`);
  let pisteDucking = 0;
  const pistes = ["[voix]"];
  musiques.forEach((musique, index) => {
    entrees.push("-i", musique.source);
    const longueur = Math.max(0.1, Math.min((musique.fin ?? total) - musique.debut, musique.dureeFichier ?? Number.POSITIVE_INFINITY));
    const entree = Math.min(1, longueur / 3);
    const sortie = Math.min(1.5, longueur / 3);
    const retard = Math.round(musique.debut * 1000);
    filtres.push(
      `[${2 + coupes.length + index}:a]${STEREO},atrim=0:${s(longueur)},asetpts=PTS-STARTPTS,afade=t=in:d=${s(entree)},afade=t=out:st=${s(longueur - sortie)}:d=${s(sortie)},volume=${s(musique.volumeDb)}dB,adelay=${retard}:all=1[m${index}r]`,
    );
    filtres.push(
      musique.baisseSousVoix
        ? `[m${index}r][sc${pisteDucking++}]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=300[m${index}]`
        : `[m${index}r]anull[m${index}]`,
    );
    pistes.push(`[m${index}]`);
  });
  const melange = pistes.length > 1 ? `${pistes.join("")}amix=inputs=${pistes.length}:normalize=0:duration=first,` : "[voix]";
  filtres.push(`${melange}loudnorm=I=${LOUDNESS_APERCU}:TP=-1.5:LRA=11,aresample=48000[a]`);
  return { entrees, filtre: filtres.join(";") };
}
