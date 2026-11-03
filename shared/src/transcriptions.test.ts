import { describe, expect, it } from "vitest";
import { repartirMots, repetitionsSuspectes, type SegmentTranscrit } from "./transcriptions.ts";

function segment(texte: string, debut: number): SegmentTranscrit {
  return { debut, fin: debut + 1, texte, mots: [], corrige: false };
}

describe("repetitionsSuspectes", () => {
  it("repère les phrases répétées trois fois ou plus d'affilée, en gardant la première", () => {
    const segments = [
      segment("On lance la partie.", 0),
      segment("Je vais sur le site B.", 1),
      segment("je vais sur le site B", 2),
      segment("Je vais sur le site B !", 3),
      segment("Je vais sur le site B.", 4),
      segment("Il reste deux ennemis.", 5),
      segment("Oui.", 6),
      segment("Oui.", 7),
    ];
    expect(repetitionsSuspectes(segments)).toEqual([2, 3, 4]);
  });

  it("ne signale rien sans répétition", () => {
    expect(repetitionsSuspectes([segment("Un.", 0), segment("Deux.", 1)])).toEqual([]);
    expect(repetitionsSuspectes([])).toEqual([]);
  });
});

describe("repartirMots", () => {
  it("répartit les mots corrigés sur la durée de la phrase, selon leur longueur", () => {
    const mots = repartirMots("Je  pose la spike", 10, 14);
    expect(mots.map(({ mot }) => mot)).toEqual(["Je", "pose", "la", "spike"]);
    expect(mots[0]?.debut).toBe(10);
    expect(mots.at(-1)?.fin).toBeCloseTo(14);
    expect((mots[1]?.fin ?? 0) - (mots[1]?.debut ?? 0)).toBeCloseTo((4 * 4) / 13);
    expect(mots.every((mot, index) => index === 0 || mot.debut === mots[index - 1]?.fin)).toBe(true);
    expect(mots.every(({ probabilite }) => probabilite === 1)).toBe(true);
  });
});
