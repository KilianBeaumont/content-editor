import type { AnalyseAudio, InfosVideo, Intervalle, PicSonore } from "@editeur/shared";

export const PAS_AUDIO = 0.1;
export const LARGEUR_PROXY = 640;
export const IMAGES_PAR_SECONDE_PROXY = 30;
export const COLONNES_PLANCHE = 4;
export const LIGNES_PLANCHE = 3;
const LARGEUR_VIGNETTE = 320;
const IMAGES_VISEES = 90;
const INTERVALLES = [1, 2, 3, 5, 10, 15, 20, 30];
const NIVEAU_MUET = -100;
const SILENCE_MIN = 0.3;
const ECART_PICS = 2;
const PICS_MAX = 40;
const TRANSFERTS_HDR: Record<string, string> = { "arib-std-b67": "arib-std-b67", smpte2084: "smpte2084" };

export function estHdr(video: InfosVideo | null): boolean {
  return video?.transfert !== null && video?.transfert !== undefined && video.transfert in TRANSFERTS_HDR;
}

export function filtreProxy(video: InfosVideo): string {
  const paysage = video.largeur >= video.hauteur;
  const taille = paysage ? `${LARGEUR_PROXY}:-2` : `-2:${LARGEUR_PROXY}`;
  const etapes = [`scale=${taille}:flags=bicubic`];
  if (estHdr(video)) {
    const transfert = TRANSFERTS_HDR[video.transfert ?? ""] ?? "arib-std-b67";
    etapes.push(
      `zscale=tin=${transfert}:min=bt2020nc:pin=bt2020:t=linear:npl=203`,
      "format=gbrpf32le",
      "zscale=p=bt709",
      "tonemap=hable:desat=0",
      "zscale=t=bt709:m=bt709:r=tv",
    );
  }
  etapes.push("format=yuv420p", `fps=${IMAGES_PAR_SECONDE_PROXY}`);
  return etapes.join(",");
}

export function argumentsProxy(source: string, video: InfosVideo | null, aAudio: boolean, cible: string): string[] {
  const args = ["-i", source, "-map", "0:v:0"];
  if (aAudio) args.push("-map", "0:a:0");
  if (video !== null) args.push("-vf", filtreProxy(video));
  args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-g", String(IMAGES_PAR_SECONDE_PROXY));
  if (aAudio) args.push("-c:a", "aac", "-b:a", "128k", "-ac", "2");
  args.push("-movflags", "+faststart", cible);
  return args;
}

export function argumentsNiveaux(source: string): string[] {
  const echantillons = Math.round(16000 * PAS_AUDIO);
  return [
    "-i",
    source,
    "-map",
    "0:a:0",
    "-af",
    `aresample=16000,asetnsamples=n=${echantillons}:p=0,astats=metadata=1:reset=1:measure_perchannel=none:measure_overall=RMS_level,ametadata=mode=print:key=lavfi.astats.Overall.RMS_level:file=-`,
    "-f",
    "null",
    "-",
  ];
}

export function lireNiveau(ligne: string): number | null {
  const resultat = /^lavfi\.astats\.Overall\.RMS_level=(.+)$/.exec(ligne.trim());
  if (resultat === null) return null;
  const valeur = Number(resultat[1]);
  return Number.isFinite(valeur) ? Math.max(NIVEAU_MUET, Math.round(valeur * 10) / 10) : NIVEAU_MUET;
}

function centile(valeurs: number[], fraction: number): number {
  if (valeurs.length === 0) return NIVEAU_MUET;
  const triees = [...valeurs].sort((a, b) => a - b);
  return triees[Math.min(triees.length - 1, Math.floor(fraction * triees.length))] ?? NIVEAU_MUET;
}

const arrondi = (valeur: number) => Math.round(valeur * 100) / 100;

export function analyserNiveaux(niveaux: number[], pas = PAS_AUDIO): AnalyseAudio {
  const fond = centile(niveaux, 0.03);
  const median = centile(niveaux, 0.5);
  const seuilSilence = Math.round(Math.min(-25, median - 6, Math.max(-60, fond + (median - fond) * 0.75)) * 10) / 10;
  const minimum = Math.round(SILENCE_MIN / pas);
  const silences: Intervalle[] = [];
  let debut: number | null = null;
  niveaux.forEach((niveau, index) => {
    if (niveau < seuilSilence) {
      debut ??= index;
      return;
    }
    if (debut !== null && index - debut >= minimum) silences.push({ debut: arrondi(debut * pas), fin: arrondi(index * pas) });
    debut = null;
  });
  if (debut !== null && niveaux.length - debut >= minimum) {
    silences.push({ debut: arrondi(debut * pas), fin: arrondi(niveaux.length * pas) });
  }

  const seuilPic = Math.max(centile(niveaux, 0.97), median + 6);
  const candidats = niveaux
    .map((niveau, index) => ({ temps: arrondi(index * pas), niveau }))
    .filter(({ niveau }, index) => niveau >= seuilPic && niveau > NIVEAU_MUET && niveau >= (niveaux[index - 1] ?? NIVEAU_MUET) && niveau >= (niveaux[index + 1] ?? NIVEAU_MUET))
    .sort((a, b) => b.niveau - a.niveau);
  const pics: PicSonore[] = [];
  for (const candidat of candidats) {
    if (pics.length >= PICS_MAX) break;
    if (pics.every((pic) => Math.abs(pic.temps - candidat.temps) >= ECART_PICS)) pics.push(candidat);
  }
  pics.sort((a, b) => a.temps - b.temps);
  return { pas, niveaux, seuilSilence, silences, pics };
}

export function intervallePlanches(duree: number): number {
  return INTERVALLES.find((intervalle) => duree / intervalle <= IMAGES_VISEES) ?? INTERVALLES.at(-1) ?? 30;
}

export function echapperFiltre(valeur: string): string {
  return valeur.replaceAll("\\", "/").replaceAll(":", "\\:").replaceAll("'", "\\'");
}

export function filtrePlanches(intervalle: number, police: string | null): string {
  const etapes = [`select='isnan(prev_selected_t)+gte(t-prev_selected_t,${intervalle - 0.02})'`, `scale=${LARGEUR_VIGNETTE}:-2`];
  if (police !== null) {
    etapes.push(
      `drawtext=fontfile='${echapperFiltre(police)}':text='%{eif\\:floor(t/60)\\:d}\\:%{eif\\:mod(t\\,60)\\:d\\:2}':x=6:y=6:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=4`,
    );
  }
  etapes.push(`tile=${COLONNES_PLANCHE}x${LIGNES_PLANCHE}:padding=4:color=black`);
  return etapes.join(",");
}
