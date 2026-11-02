const LIGATURES: Record<string, string> = { œ: "oe", æ: "ae", ß: "ss" };
const LONGUEUR_MAX = 80;

export function slug(texte: string): string {
  return texte
    .toLowerCase()
    .replace(/[œæß]/g, (lettre) => LIGATURES[lettre] ?? lettre)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, LONGUEUR_MAX)
    .replace(/-+$/, "");
}
