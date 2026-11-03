import { describe, expect, it } from "vitest";
import { argumentsClipAudio, argumentsClipVideo, decouper, formatApercu, grapheFinal } from "./graphe.ts";

const FORMAT = formatApercu("vlog");

describe("découpage du plan", () => {
  it("garde le son exact et compte les images sans dérive, décalages compris", () => {
    const segments = [
      { debut: 3.72, fin: 8.25, decalageImage: 0 },
      { debut: 14.65, fin: 27.4, decalageImage: -1.2 },
      { debut: 56.05, fin: 71.7, decalageImage: 0.5 },
    ];
    const decoupes = decouper(segments);
    expect(decoupes.map(({ audio }) => audio)).toEqual([
      { debut: 3.72, duree: 4.53 },
      { debut: 14.65, duree: 12.75 },
      { debut: 56.05, duree: 15.65 },
    ]);
    expect(decoupes.map(({ image }) => image.debut)).toEqual([3.72, 13.45, 56.55]);
    expect(decoupes.map(({ image }) => image.images)).toEqual([100, 433, 455]);
    expect(decoupes.reduce((total, { image }) => total + image.images, 0)).toBe(Math.round((4.53 + 12.75 + 15.65) * 30));
  });

  it("choisit le format de l'aperçu selon la catégorie", () => {
    expect(formatApercu("vlog")).toEqual({ largeur: 640, hauteur: 360 });
    expect(formatApercu("micro-histoire")).toEqual({ largeur: 360, hauteur: 640 });
  });
});

describe("arguments ffmpeg", () => {
  it("découpe l'image au nombre d'images près, cadrée et prolongée si le rush s'arrête", () => {
    const args = argumentsClipVideo("proxy.mp4", 13.4499999, 412, FORMAT, "v002.mp4");
    expect(args.slice(0, 4)).toEqual(["-ss", "13.45", "-i", "proxy.mp4"]);
    expect(args[args.indexOf("-vf") + 1]).toBe(
      "scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=5",
    );
    expect(args[args.indexOf("-frames:v") + 1]).toBe("412");
    expect(argumentsClipVideo(null, 0, 30, FORMAT, "v001.mp4").slice(0, 4)).toEqual(["-f", "lavfi", "-i", "color=black:s=640x360:r=30"]);
  });

  it("découpe le son à l'échantillon près avec des fondus contre les clics", () => {
    const args = argumentsClipAudio("rush.mp4", 3.72, 4.53, "a001.wav");
    expect(args.slice(0, 6)).toEqual(["-ss", "3.72", "-t", "4.53", "-i", "rush.mp4"]);
    expect(args[args.indexOf("-af") + 1]).toBe("apad=whole_dur=4.53,afade=t=in:d=0.03,afade=t=out:st=4.5:d=0.03");
  });
});

describe("graphe final", () => {
  it("sans plan de coupe ni musique : normalise seulement la voix", () => {
    expect(grapheFinal(FORMAT, 30, [], [])).toEqual({
      entrees: [],
      filtre:
        "[0:v]setpts=PTS-STARTPTS[v];[1:a]aformat=sample_rates=48000:channel_layouts=stereo[voix];[voix]loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]",
    });
  });

  it("superpose les plans de coupe à leur place et baisse la musique sous la voix", () => {
    const graphe = grapheFinal(
      FORMAT,
      60,
      [{ source: "proxy.mp4", debut: 57.7, duree: 2, position: 1 }],
      [
        { source: "lofi.mp3", dureeFichier: 174, debut: 0, fin: null, volumeDb: -20, baisseSousVoix: true },
        { source: "pluie.wav", dureeFichier: 10, debut: 5, fin: 30, volumeDb: -30, baisseSousVoix: false },
      ],
    );
    expect(graphe.entrees).toEqual(["-ss", "57.7", "-t", "2", "-i", "proxy.mp4", "-i", "lofi.mp3", "-i", "pluie.wav"]);
    const filtres = graphe.filtre.split(";");
    expect(filtres).toContain("[v0][c0]overlay=eof_action=pass:enable='between(t,1,3)'[v]");
    expect(filtres).toContain("[1:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit=2[voix][sc0]");
    expect(filtres).toContain("[m0r][sc0]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=300[m0]");
    expect(filtres.find((filtre) => filtre.startsWith("[3:a]"))).toContain("atrim=0:60,");
    expect(filtres.find((filtre) => filtre.startsWith("[4:a]"))).toContain("atrim=0:10,asetpts=PTS-STARTPTS,afade=t=in:d=1,afade=t=out:st=8.5:d=1.5,volume=-30dB,adelay=5000:all=1");
    expect(filtres).toContain("[m1r]anull[m1]");
    expect(filtres.at(-1)).toBe("[voix][m0][m1]amix=inputs=3:normalize=0:duration=first,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]");
  });
});
