import type { FichierMedia } from "@editeur/shared";
import { formaterDuree } from "./api.ts";

export function resumeMedia(fichier: FichierMedia): string {
  const { infos } = fichier;
  if (infos === null) return "";
  const morceaux: string[] = [];
  if (infos.video !== null) {
    morceaux.push(`${infos.video.largeur}×${infos.video.hauteur}`);
    if (infos.video.imagesParSeconde !== null && fichier.genre === "video") {
      morceaux.push(`${String(infos.video.imagesParSeconde).replace(".", ",")} i/s`);
    }
  }
  if (infos.audio !== null) {
    const canaux = infos.audio.canaux === 1 ? "mono" : infos.audio.canaux === 2 ? "stéréo" : `${infos.audio.canaux} canaux`;
    morceaux.push(`son ${canaux}`);
  }
  return morceaux.join(" · ");
}

export function dureeMedia(fichier: FichierMedia): string {
  return fichier.infos?.duree != null && fichier.genre !== "image" ? formaterDuree(fichier.infos.duree) : "";
}
