import { urlFichier } from "../api.ts";

const IMAGES = /\.(png|jpe?g|webp|gif)$/i;
const PDF = /\.pdf$/i;

export function ApercuFichier({ chemin }: { chemin: string }) {
  const url = urlFichier(chemin);
  const nom = chemin.split("/").at(-1) ?? chemin;
  return (
    <div className="apercu-fichier">
      {IMAGES.test(chemin) && <img src={url} alt={nom} />}
      {PDF.test(chemin) && <iframe src={url} title={nom} />}
      <a href={url} target="_blank" rel="noreferrer">
        Ouvrir {nom}
      </a>
    </div>
  );
}
