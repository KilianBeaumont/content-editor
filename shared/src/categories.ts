export const CATEGORIES = ["vlog", "recit", "micro-histoire", "extrait-recit", "timelapse", "podcast"] as const;

export type Categorie = (typeof CATEGORIES)[number];

export const LIBELLES_CATEGORIES: Record<Categorie, string> = {
  vlog: "vlog",
  recit: "récit",
  "micro-histoire": "micro-histoire",
  "extrait-recit": "extrait de récit",
  timelapse: "timelapse",
  podcast: "podcast",
};
