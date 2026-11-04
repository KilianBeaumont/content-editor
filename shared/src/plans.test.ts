import { describe, expect, it } from "vitest";
import { rectangleCadre, schemaPropositionPlan, situer, morceauxTexte } from "./plans.ts";

describe("rectangle de cadrage", () => {
  it("place une fenêtre 9:16 dans une image 16:9, sans sortir de l'image", () => {
    const vertical = 9 / 16;
    const horizontal = 16 / 9;
    const centre = rectangleCadre(horizontal, vertical, { x: 0.5, y: 0.5, zoom: 1 });
    expect(centre.largeur).toBeCloseTo((9 / 16) * (9 / 16));
    expect(centre.hauteur).toBe(1);
    expect(centre.gauche).toBeCloseTo(0.5 - centre.largeur / 2);
    expect(rectangleCadre(horizontal, vertical, { x: 0, y: 0.5, zoom: 1 }).gauche).toBe(0);
    expect(rectangleCadre(horizontal, vertical, { x: 1, y: 0.5, zoom: 1 }).gauche).toBeCloseTo(1 - centre.largeur);
    const zoome = rectangleCadre(horizontal, vertical, { x: 0.5, y: 0.2, zoom: 2 });
    expect(zoome.hauteur).toBe(0.5);
    expect(zoome.haut).toBe(0);
  });

  it("accepte un ancien plan sans cadrage ni plans de coupe", () => {
    const plan = schemaPropositionPlan.parse({
      resume: "",
      hook: { segment: "s1", explication: "" },
      segments: [{ id: "s1", source: "rushes/a.mp4", debut: 0, fin: 2, role: "", citation: "", raison: "" }],
      musiques: [],
      pointsAVerifier: [],
      reponsesRetours: [],
    });
    expect(plan.segments[0]).toMatchObject({ decalageImage: 0, cadrage: null });
    expect(plan.plansDeCoupe).toEqual([]);
    expect(situer(plan.segments, 1)).toEqual({ segment: "s1", source: "rushes/a.mp4", tempsSource: 1 });
  });
});

describe("morceauxTexte", () => {
  it("met en valeur les mots entre astérisques", () => {
    expect(morceauxTexte("Trois *outils* indispensables")).toEqual([
      { texte: "Trois ", accent: false },
      { texte: "outils", accent: true },
      { texte: " indispensables", accent: false },
    ]);
    expect(morceauxTexte("Prix : 5 * 3")).toEqual([{ texte: "Prix : 5  3", accent: false }]);
  });
});
