import { EXTENSIONS_AUDIO, EXTENSIONS_IMAGE, EXTENSIONS_VIDEO } from "./bibliotheque.ts";

export const GENRES_FICHIER = ["video", "audio", "image", "texte", "autre"] as const;
export type GenreFichier = (typeof GENRES_FICHIER)[number];

export const EXTENSIONS_TEXTE = [".txt", ".md", ".docx", ".odt", ".rtf", ".pdf", ".srt"] as const;

export const LIBELLES_GENRES: Record<GenreFichier, string> = {
  video: "Vidéo",
  audio: "Audio",
  image: "Image",
  texte: "Texte",
  autre: "Autre",
};

export function genreFichier(nom: string): GenreFichier {
  const point = nom.lastIndexOf(".");
  const extension = point > 0 ? nom.slice(point).toLowerCase() : "";
  const dans = (liste: readonly string[]) => liste.includes(extension);
  if (dans(EXTENSIONS_VIDEO) || [".avi", ".mts", ".m2ts", ".mxf", ".m4v"].includes(extension)) return "video";
  if (dans(EXTENSIONS_AUDIO) || [".aif", ".aiff", ".opus"].includes(extension)) return "audio";
  if (dans(EXTENSIONS_IMAGE) || [".heic", ".tif", ".tiff"].includes(extension)) return "image";
  if (dans(EXTENSIONS_TEXTE)) return "texte";
  return "autre";
}

export interface InfosVideo {
  largeur: number;
  hauteur: number;
  codec: string;
  imagesParSeconde: number | null;
}

export interface InfosAudio {
  codec: string;
  canaux: number;
  frequence: number | null;
}

export interface InfosMedia {
  duree: number | null;
  video: InfosVideo | null;
  audio: InfosAudio | null;
}

export interface FichierInbox {
  chemin: string;
  taille: number;
  modifie: string;
  genre: GenreFichier;
  infos: InfosMedia | null;
  erreurAnalyse: string | null;
}

export interface ReponseInbox {
  fichiers: FichierInbox[];
  espaceLibre: number | null;
  ffprobeDisponible: boolean;
}

export interface ReponseEnvoiInbox {
  fichier: FichierInbox;
}
