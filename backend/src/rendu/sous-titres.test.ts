import type { ReglagesSousTitres, Transcription } from "@editeur/shared";
import { describe, expect, it } from "vitest";
import { genererAss, grouperMots, motsSurTimeline, nomFamillePolice } from "./sous-titres.ts";

function policeFactice(nom: string): Buffer {
  const texte = Buffer.from(nom, "utf16le").swap16();
  const name = Buffer.alloc(18 + texte.length);
  name.writeUInt16BE(0, 0);
  name.writeUInt16BE(1, 2);
  name.writeUInt16BE(18, 4);
  [3, 1, 0x409, 1, texte.length, 0].forEach((valeur, index) => name.writeUInt16BE(valeur, 6 + index * 2));
  texte.copy(name, 18);
  const entete = Buffer.alloc(28);
  entete.writeUInt32BE(0x00010000, 0);
  entete.writeUInt16BE(1, 4);
  entete.write("name", 12, "latin1");
  entete.writeUInt32BE(28, 20);
  entete.writeUInt32BE(name.length, 24);
  return Buffer.concat([entete, name]);
}

const REGLAGES: ReglagesSousTitres = {
  police: "ma-police",
  taillePourcent: 5,
  couleur: "#FFFFFF",
  couleurAccent: "#FFD43B",
  contour: 4,
  motsMax: 3,
  positionPourcent: 70,
  majuscules: true,
};

const mot = (texte: string, debut: number, fin: number) => ({ mot: texte, debut, fin, probabilite: 0.9 });

describe("sous-titres", () => {
  it("lit le nom de famille d'une police", () => {
    expect(nomFamillePolice(policeFactice("Ma Police"))).toBe("Ma Police");
    expect(nomFamillePolice(Buffer.from("pas une police"))).toBeNull();
  });

  it("replace les mots sur la ligne de temps de la vidéo finale, sans les hésitations", () => {
    const transcription = {
      segments: [
        { debut: 10, fin: 14, texte: "", mots: [mot("bonjour", 10.2, 10.6), mot("euh", 10.7, 11), mot("à", 11.1, 11.2), mot("tous", 11.2, 11.6)], corrige: false },
        { debut: 30, fin: 32, texte: "", mots: [mot("hors", 30, 30.5), mot("plan", 31, 31.5)], corrige: false },
      ],
    } as Pick<Transcription, "segments"> as Transcription;
    const segments = [
      { id: "s1", source: "rush.mp4", debut: 30.8, fin: 32, role: "", citation: "", raison: "", decalageImage: 0, cadrage: null },
      { id: "s2", source: "rush.mp4", debut: 10, fin: 12, role: "", citation: "", raison: "", decalageImage: 0, cadrage: null },
    ];
    const mots = motsSurTimeline({ segments }, new Map([["rush.mp4", transcription]]));
    expect(mots.map(({ mot: texte, debut }) => [texte, Math.round(debut * 100) / 100])).toEqual([
      ["plan", 0.2],
      ["bonjour", 1.4],
      ["à", 2.3],
      ["tous", 2.4],
    ]);
  });

  it("groupe les mots par trois, en coupant aux pauses et aux fins de phrase", () => {
    const mots = [
      { mot: "trois", debut: 0, fin: 0.3 },
      { mot: "outils", debut: 0.3, fin: 0.6 },
      { mot: "que", debut: 0.6, fin: 0.8 },
      { mot: "j'utilise.", debut: 0.8, fin: 1.2 },
      { mot: "Le", debut: 1.25, fin: 1.4 },
      { mot: "premier", debut: 2.2, fin: 2.5 },
    ];
    expect(grouperMots(mots, 3).map((groupe) => groupe.map(({ mot: texte }) => texte).join(" "))).toEqual(["trois outils que", "j'utilise.", "Le", "premier"]);
  });

  it("écrit un fichier ASS avec le mot prononcé surligné, à la position voulue", () => {
    const ass = genererAss(
      [
        { mot: "trois", debut: 0.2, fin: 0.5 },
        { mot: "outils", debut: 0.5, fin: 0.9 },
      ],
      { largeur: 1080, hauteur: 1920 },
      REGLAGES,
      "Ma Police",
    );
    expect(ass).toContain("PlayResX: 1080\nPlayResY: 1920");
    expect(ass).toContain("Style: Defaut,Ma Police,96,&H00FFFFFF&,&H00FFFFFF&,&H00000000&,&H64000000&,0,0,0,0,100,100,0,0,1,4,0,5,86,86,0,1");
    expect(ass).toContain("Dialogue: 0,0:00:00.20,0:00:00.50,Defaut,,0,0,0,,{\\an5\\pos(540,1344)}{\\c&H003BD4FF&}TROIS{\\c&H00FFFFFF&} OUTILS");
    expect(ass).toContain("Dialogue: 0,0:00:00.50,0:00:01.15,Defaut,,0,0,0,,{\\an5\\pos(540,1344)}TROIS {\\c&H003BD4FF&}OUTILS{\\c&H00FFFFFF&}");
  });
});
