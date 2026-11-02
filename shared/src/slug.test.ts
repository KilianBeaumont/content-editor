import { describe, expect, it } from "vitest";
import { slug } from "./slug.ts";

describe("slug", () => {
  it.each([
    ["Le Dernier Dragon", "le-dernier-dragon"],
    ["Été à l'Œil !", "ete-a-l-oeil"],
    ["  Première   carte — v2  ", "premiere-carte-v2"],
    ["Ça grésille, n'est-ce pas ?", "ca-gresille-n-est-ce-pas"],
    ["Cœur & âme", "coeur-ame"],
    ["!!!", ""],
  ])("%s → %s", (texte, attendu) => {
    expect(slug(texte)).toBe(attendu);
  });

  it("coupe les titres trop longs sans finir par un tiret", () => {
    const resultat = slug("mot ".repeat(40));
    expect(resultat.length).toBeLessThanOrEqual(80);
    expect(resultat.endsWith("-")).toBe(false);
  });
});
