import { codeErreur } from "../erreurs.ts";
import { lancer } from "../processus.ts";
import type { OutilsTache } from "../taches/file.ts";

export interface OptionsFfmpeg {
  duree: number | null;
  action: string;
  surProgression?: (fraction: number) => void;
  surSortie?: (ligne: string) => void;
  cwd?: string;
}

export async function executerFfmpeg(ffmpeg: string, args: string[], options: OptionsFfmpeg, outils: OutilsTache): Promise<void> {
  const avecProgression = options.surProgression !== undefined;
  let resultat;
  try {
    resultat = await lancer(ffmpeg, ["-v", "error", "-nostdin", "-y", ...(avecProgression ? ["-progress", "pipe:1", "-stats_period", "0.5"] : []), ...args], {
      signal: outils.signal,
      cwd: options.cwd,
      surLigne: (ligne, flux) => {
        if (flux !== "sortie") return;
        const temps = /^out_time_us=(\d+)/.exec(ligne);
        if (temps) {
          if (options.duree) options.surProgression?.(Math.min(1, Number(temps[1]) / 1e6 / options.duree));
          return;
        }
        options.surSortie?.(ligne);
      },
    });
  } catch (erreur) {
    if (codeErreur(erreur) === "ENOENT") throw new Error("ffmpeg introuvable : vérifie son chemin dans Paramètres.", { cause: erreur });
    throw erreur;
  }
  if (outils.signal.aborted) throw new Error(`${options.action} annulée.`);
  if (resultat.code !== 0) {
    const detail = resultat.dernieresErreurs.at(-1);
    throw new Error(`ffmpeg a échoué (${options.action.toLowerCase()})${detail ? ` : ${detail}` : "."}`);
  }
}

export function extraireAudio(
  ffmpeg: string,
  source: string,
  cible: string,
  duree: number | null,
  surProgression: (fraction: number) => void,
  outils: OutilsTache,
): Promise<void> {
  return executerFfmpeg(
    ffmpeg,
    ["-i", source, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", cible],
    { duree, action: "Extraction de l'audio", surProgression },
    outils,
  );
}
