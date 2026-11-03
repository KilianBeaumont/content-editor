import { describe, expect, it } from "vitest";
import {
  argumentsClipAudio,
  cadenceExport,
  debitCibleKbps,
  decouper,
  filtreImage,
  filtreLoudnorm,
  formatApercu,
  grapheAudio,
  grapheVideo,
  lireMesureLoudnorm,
  type ProfilImage,
} from "./graphe.ts";

const APERCU: ProfilImage = { format: formatApercu("vlog"), ips: 30, placebo: false, acceleration: false };

describe("découpage du plan", () => {
  it("garde le son exact et compte les images sans dérive, décalages compris", () => {
    const segments = [
      { debut: 3.72, fin: 8.25, decalageImage: 0 },
      { debut: 14.65, fin: 27.4, decalageImage: -1.2 },
      { debut: 56.05, fin: 71.7, decalageImage: 0.5 },
    ];
    const decoupes = decouper(segments, 30);
    expect(decoupes.map(({ audio }) => audio.duree)).toEqual([4.53, 12.75, 15.65]);
    expect(decoupes.map(({ image }) => image.debut)).toEqual([3.72, 13.45, 56.55]);
    expect(decoupes.map(({ image }) => image.images)).toEqual([100, 433, 455]);
    expect(decouper(segments, 60).reduce((total, { image }) => total + image.images, 0)).toBe(Math.round(32.93 * 60));
  });

  it("choisit le format de l'aperçu, la cadence et le débit de l'export", () => {
    expect(formatApercu("micro-histoire")).toEqual({ largeur: 360, hauteur: 640 });
    expect(cadenceExport([59.94, null])).toBe(60);
    expect(cadenceExport([120])).toBe(60);
    expect(cadenceExport([null])).toBe(30);
    expect(debitCibleKbps({ largeur: 1920, hauteur: 1080 }, 60)).toBe(12_000);
    expect(debitCibleKbps({ largeur: 1080, hauteur: 1920 }, 30)).toBe(8_000);
  });
});

describe("filtres d'image", () => {
  it("convertit le HDR en SDR avec libplacebo ou zscale", () => {
    const placebo = { ...APERCU, format: { largeur: 1920, hauteur: 1080 }, ips: 60, placebo: true };
    expect(filtreImage(placebo, "arib-std-b67")).toContain("tonemapping=bt.2390");
    expect(filtreImage(placebo, null)).not.toContain("tonemapping");
    expect(filtreImage(APERCU, "arib-std-b67")).toContain("zscale=tin=arib-std-b67");
    expect(filtreImage(APERCU, null)).toBe(
      "scale=640:360:force_original_aspect_ratio=decrease:flags=bicubic,format=yuv420p,pad=640:360:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30",
    );
  });

  it("découpe le son avec des fondus contre les clics", () => {
    const args = argumentsClipAudio("rush.mp4", 3.72, 4.53, "a001.wav");
    expect(args[args.indexOf("-af") + 1]).toBe("apad=whole_dur=4.53,afade=t=in:d=0.03,afade=t=out:st=4.5:d=0.03");
  });
});

describe("graphes", () => {
  it("mélange la voix et la musique baissée sous la voix", () => {
    const graphe = grapheAudio(60, [{ source: "lofi.mp3", dureeFichier: 174, debut: 0, fin: null, volumeDb: -20, baisseSousVoix: true }]);
    expect(graphe.entrees).toEqual(["-i", "lofi.mp3"]);
    expect(graphe.filtre).toContain("[m0r][sc0]sidechaincompress");
    expect(graphe.filtre.endsWith("[voix][m0]amix=inputs=2:normalize=0:duration=first[a]")).toBe(true);
    expect(grapheAudio(10, []).filtre).toBe("[0:a]aformat=sample_rates=48000:channel_layouts=stereo[voix];[voix]anull[a]");
  });

  it("superpose les plans de coupe à leur place", () => {
    const graphe = grapheVideo(APERCU, [{ source: { chemin: "proxy.mp4", transfert: null }, debut: 57.7, duree: 2, position: 1 }], 2);
    expect(graphe.entrees).toEqual(["-ss", "57.7", "-t", "2", "-i", "proxy.mp4"]);
    expect(graphe.filtre).toContain("[v0][c0]overlay=eof_action=pass:enable='between(t,1,3)'[v]");
  });

  it("lit la mesure de volume et la réutilise en deuxième passe", () => {
    const journal = ["[Parsed_loudnorm_0] ", "{", '"input_i" : "-23.1",', '"input_tp" : "-4.2",', '"input_lra" : "6.0",', '"input_thresh" : "-33.5",', '"target_offset" : "0.3"', "}"];
    const mesure = lireMesureLoudnorm(journal);
    expect(mesure).toMatchObject({ input_i: "-23.1", target_offset: "0.3" });
    expect(filtreLoudnorm(-14, mesure)).toBe(
      "loudnorm=I=-14:TP=-1:LRA=11:measured_I=-23.1:measured_TP=-4.2:measured_LRA=6.0:measured_thresh=-33.5:offset=0.3:linear=true",
    );
    expect(lireMesureLoudnorm(["pas de mesure"])).toBeNull();
  });
});
