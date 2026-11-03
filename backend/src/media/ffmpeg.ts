import { codeErreur } from "../erreurs.ts";
import { lancer } from "../processus.ts";
import type { OutilsTache } from "../taches/file.ts";

export async function extraireAudio(
  ffmpeg: string,
  source: string,
  cible: string,
  duree: number | null,
  surProgression: (fraction: number) => void,
  outils: OutilsTache,
): Promise<void> {
  let resultat;
  try {
    resultat = await lancer(
      ffmpeg,
      ["-v", "error", "-nostdin", "-y", "-progress", "pipe:1", "-i", source, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", cible],
      {
        signal: outils.signal,
        surLigne: (ligne, flux) => {
          const temps = flux === "sortie" ? /^out_time_us=(\d+)/.exec(ligne) : null;
          if (temps && duree) surProgression(Number(temps[1]) / 1e6 / duree);
        },
      },
    );
  } catch (erreur) {
    if (codeErreur(erreur) === "ENOENT") throw new Error("ffmpeg introuvable : vérifie son chemin dans Paramètres.", { cause: erreur });
    throw erreur;
  }
  if (outils.signal.aborted) throw new Error("Extraction annulée.");
  if (resultat.code !== 0) {
    const detail = resultat.dernieresErreurs.at(-1);
    throw new Error(`ffmpeg n'a pas pu extraire l'audio${detail ? ` : ${detail}` : "."}`);
  }
}
