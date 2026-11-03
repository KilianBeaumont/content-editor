import type { InfosMedia, Transcription } from "@editeur/shared";
import { describe, expect, it } from "vitest";
import { calculerProfil, lireCoupe, resumerProfil } from "./profil.ts";

const MEDIA: InfosMedia = { duree: 30, video: { largeur: 1080, hauteur: 1920, codec: "h264", imagesParSeconde: 30, transfert: null }, audio: { codec: "aac", canaux: 2, frequence: 48000 } };

describe("profil d'une vidéo d'inspiration", () => {
  it("lit les coupes détectées par ffmpeg", () => {
    expect(lireCoupe("frame:2    pts:264960  pts_time:17.25")).toBe(17.25);
    expect(lireCoupe("lavfi.scene_score=0.64")).toBeNull();
  });

  it("mesure le rythme, le débit et le silence", () => {
    const mot = (debut: number) => ({ mot: "mot", debut, fin: debut + 0.3, probabilite: 0.9 });
    const transcription = {
      segments: [
        { debut: 0.4, fin: 10, texte: "", mots: [mot(0.4), mot(1), mot(2)], corrige: false },
        { debut: 12, fin: 20, texte: "", mots: [mot(12), mot(13)], corrige: false },
      ],
    } as Pick<Transcription, "segments"> as Transcription;
    const audio = { pas: 0.1, niveaux: [], seuilSilence: -40, silences: [{ debut: 10, fin: 12 }], pics: [] };
    const profil = calculerProfil(MEDIA, [1.5, 4, 10, 22], transcription, audio);
    expect(profil).toEqual({
      duree: 30,
      largeur: 1080,
      hauteur: 1920,
      imagesParSeconde: 30,
      coupes: 4,
      coupesParMinute: 8,
      dureeMoyennePlan: 6,
      dureeMedianePlan: 6,
      plusLongPlan: 12,
      premiereCoupe: 1.5,
      mots: 5,
      motsParMinute: 10,
      premierMot: 0.4,
      partParole: 0.59,
      plusLongSilence: 2,
    });
    expect(resumerProfil(profil)).toBe(
      "30,0 s (1080x1920) · 4 coupes, 8,0 par minute · plans de 6,0 s en médiane (le plus long : 12,0 s) · première coupe à 1,5 s · 10 mots par minute, premier mot à 0,4 s · parole 59 % du temps, plus long silence 2,0 s",
    );
  });

  it("reste lisible sans transcription ni coupe", () => {
    const profil = calculerProfil(MEDIA, [], null, null);
    expect(profil).toMatchObject({ coupes: 0, dureeMoyennePlan: 30, premiereCoupe: null, motsParMinute: null, partParole: null });
  });
});
