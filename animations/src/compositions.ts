import type { StyleTextes, TexteEcran } from "@editeur/shared";

export const ID_TEXTE = "texte-ecran";

export type ProprietesCompositionTexte = {
  texte: TexteEcran;
  style: StyleTextes;
  largeur: number;
  hauteur: number;
  ips: number;
};

export function dureeEnImages(texte: Pick<TexteEcran, "debut" | "fin">, ips: number): number {
  return Math.max(1, Math.round((texte.fin - texte.debut) * ips));
}
