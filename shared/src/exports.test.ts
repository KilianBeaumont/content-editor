import { describe, expect, it } from "vitest";
import { dimensionsQualite, qualite4kPossible } from "./exports.ts";

const FULL_HD = { largeur: 1920, hauteur: 1080 };

describe("qualité d'export", () => {
  it("double la résolution standard pour la 4K", () => {
    expect(dimensionsQualite(FULL_HD, "4k")).toEqual({ largeur: 3840, hauteur: 2160 });
    expect(dimensionsQualite(FULL_HD, "standard")).toEqual(FULL_HD);
  });

  it("ne propose la 4K que si les rushes la permettent, en paysage comme en portrait", () => {
    expect(qualite4kPossible(FULL_HD, { largeur: 3840, hauteur: 2160 })).toBe(true);
    expect(qualite4kPossible(FULL_HD, { largeur: 2160, hauteur: 3840 })).toBe(true);
    expect(qualite4kPossible(FULL_HD, { largeur: 1920, hauteur: 1080 })).toBe(false);
    expect(qualite4kPossible({ largeur: 1080, hauteur: 1920 }, { largeur: 2160, hauteur: 3840 })).toBe(true);
    expect(qualite4kPossible(FULL_HD, null)).toBe(false);
  });
});
