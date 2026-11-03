export const CATEGORIES = ["vlog", "court", "recit", "micro-histoire", "extrait-recit", "timelapse", "podcast"] as const;

export type Categorie = (typeof CATEGORIES)[number];

export const LIBELLES_CATEGORIES: Record<Categorie, string> = {
  vlog: "vlog",
  court: "format court",
  recit: "récit",
  "micro-histoire": "micro-histoire",
  "extrait-recit": "extrait de récit",
  timelapse: "timelapse",
  podcast: "podcast",
};

export const CATEGORIES_VERTICALES: readonly Categorie[] = ["court", "micro-histoire", "extrait-recit", "timelapse"];

export function estCategorieVerticale(categorie: Categorie): boolean {
  return CATEGORIES_VERTICALES.includes(categorie);
}
