import { describe, expect, it } from "vitest";
import { recalerBornes } from "./recalage.ts";

const mot = (debut: number, fin: number) => ({ mot: "m", debut, fin, probabilite: 0.9 });
const MOTS = [mot(1, 1.4), mot(1.4, 1.9), mot(2.5, 3), mot(3, 3.6), mot(3.8, 4.2)];

describe("recalage des bornes d'un extrait", () => {
  it("commence juste avant un mot coupé et finit juste après le dernier mot", () => {
    expect(recalerBornes({ debut: 1.6, fin: 3.2 }, MOTS, null)).toEqual({ debut: 1.45, fin: 3.75 });
  });

  it("avance au mot suivant proche et ne déborde pas sur le mot d'après", () => {
    expect(recalerBornes({ debut: 2.2, fin: 3.7 }, MOTS, null)).toEqual({ debut: 2.38, fin: 3.75 });
  });

  it("ne dépasse pas la fin du rush et laisse les bornes sans mots telles quelles", () => {
    expect(recalerBornes({ debut: 3.7, fin: 4.25 }, MOTS, 4.3)).toEqual({ debut: 3.68, fin: 4.3 });
    expect(recalerBornes({ debut: 10, fin: 12 }, MOTS, null)).toEqual({ debut: 10, fin: 12 });
    expect(recalerBornes({ debut: 1, fin: 2 }, [], null)).toEqual({ debut: 1, fin: 2 });
  });
});
