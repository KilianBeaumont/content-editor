import { describe, expect, it } from "vitest";
import {
  argumentsClipAudio,
  cadenceExport,
  debitCibleKbps,
  decouper,
  encodageFinal,
  encodageIntermediaire,
  filtreImage,
  filtreLoudnorm,
  formatApercu,
  grapheAudio,
  grapheVideo,
  lireMesureLoudnorm,
  fenetre,
  type ProfilImage,
  type SourceImage,
} from "./graphe.ts";
import { segmentsContigus } from "./moteur.ts";

const src = (transfert: string | null, largeur: number | null = null, hauteur: number | null = null): SourceImage => ({ chemin: "rush.mp4", transfert, largeur, hauteur });

const APERCU: ProfilImage = { format: formatApercu("vlog"), ips: 30, placebo: false, acceleration: false, hdr: false };

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
    expect(filtreImage(placebo, src("arib-std-b67"))).toContain("tonemapping=bt.2390");
    expect(filtreImage(placebo, src(null))).not.toContain("tonemapping");
    expect(filtreImage(APERCU, src("arib-std-b67"))).toContain("zscale=tin=arib-std-b67");
    expect(filtreImage(APERCU, src(null))).toBe(
      "scale=640:360:force_original_aspect_ratio=decrease:flags=bicubic,format=yuv420p,pad=640:360:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30",
    );
  });

  it("découpe le son avec des fondus contre les clics", () => {
    const args = argumentsClipAudio("rush.mp4", 3.72, 4.53, "a001.wav");
    expect(args[args.indexOf("-af") + 1]).toBe("apad=whole_dur=4.53,afade=t=in:d=0.03,afade=t=out:st=4.5:d=0.03");
  });
});

describe("export HDR (HLG)", () => {
  const HDR: ProfilImage = { format: { largeur: 3840, hauteur: 2160 }, ips: 60, placebo: true, acceleration: true, hdr: true };

  it("garde le HDR en HLG 10 bits et y place les sources SDR", () => {
    expect(filtreImage(HDR, src("arib-std-b67"))).toContain("color_trc=arib-std-b67:range=tv:format=yuv420p10le");
    expect(filtreImage(HDR, src(null))).not.toContain("tonemapping");
    const classique = { ...HDR, placebo: false };
    expect(filtreImage(classique, src("arib-std-b67"))).toBe(
      "scale=3840:2160:force_original_aspect_ratio=decrease:flags=bicubic,format=yuv420p10le,pad=3840:2160:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=60",
    );
    expect(filtreImage(classique, src(null))).toContain("zscale=tin=bt709:min=bt709:pin=bt709:t=linear:npl=203,format=gbrpf32le,zscale=p=bt2020:t=arib-std-b67");
  });

  it("encode en HEVC Main 10 marqué BT.2020 / HLG, avec un débit HDR", () => {
    const final = encodageFinal("hevc_nvenc", HDR.format, 60);
    expect(final).toEqual(expect.arrayContaining(["hevc_nvenc", "main10", "p010le", "hvc1", "bt2020nc", "arib-std-b67", "75000k"]));
    expect(encodageIntermediaire("libx265", 60)).toEqual(expect.arrayContaining(["libx265", "yuv420p10le", "arib-std-b67"]));
    expect(encodageFinal("h264_nvenc", HDR.format, 60)).toEqual(expect.arrayContaining(["h264_nvenc", "bt709", "60000k"]));
  });

  it("superpose les plans de coupe en 10 bits", () => {
    const graphe = grapheVideo(HDR, [{ source: src("arib-std-b67"), debut: 1, duree: 2, position: 3, cadrage: null }], 2);
    expect(graphe.filtre).toContain("overlay=eof_action=pass:format=yuv420p10:enable=");
  });
});

describe("cadrage", () => {
  const VERTICAL: ProfilImage = { format: { largeur: 360, hauteur: 640 }, ips: 30, placebo: false, acceleration: false, hdr: false };
  const cadre = (x: number, zoom: number) => ({ x, y: 0.5, zoom });

  it("calcule la plus grande fenêtre aux proportions de la sortie, puis la resserre", () => {
    expect(fenetre({ largeur: 640, hauteur: 360 }, VERTICAL.format, 1)).toEqual({ largeur: 202, hauteur: 360 });
    expect(fenetre({ largeur: 640, hauteur: 360 }, VERTICAL.format, 2)).toEqual({ largeur: 102, hauteur: 180 });
    expect(fenetre({ largeur: 1080, hauteur: 1920 }, { largeur: 1920, hauteur: 1080 }, 1)).toEqual({ largeur: 1080, hauteur: 608 });
  });

  it("recadre en fixe ou avec un mouvement adouci, et pose l'image entière sur un fond flou", () => {
    const fixe = filtreImage(VERTICAL, src(null, 640, 360), { mode: "recadre", debut: cadre(0.3, 1), fin: null }, 4);
    expect(fixe).toBe("format=yuv420p,fps=30,crop=w=202:h=360:x='max(0,min(iw-202,0.3*iw-101))':y='max(0,min(ih-360,0.5*ih-180))',scale=360:640:flags=bicubic,setsar=1,format=yuv420p");
    const mouvement = filtreImage(VERTICAL, src(null, 640, 360), { mode: "recadre", debut: cadre(0.3, 1), fin: cadre(0.7, 1.6) }, 4);
    expect(mouvement).toContain("x='max(0,min(iw-202,(0.3+0.4*(3*pow(min(1,max(0,t/4)),2)-2*pow(min(1,max(0,t/4)),3)))*iw-101))'");
    expect(mouvement).toContain("zoompan=z='(1+0.6*(3*pow(min(1,max(0,it/4)),2)-2*pow(min(1,max(0,it/4)),3)))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=360x640:fps=30");
    const flou = filtreImage(VERTICAL, src(null, 640, 360), { mode: "fond-flou", debut: cadre(0.5, 1), fin: null }, 4, "c0");
    expect(flou).toContain("split[ac0][bc0]");
    expect(flou).toContain("[fondc0][avantc0]overlay=(W-w)/2:(H-h)/2");
    expect(filtreImage(VERTICAL, src(null), { mode: "recadre", debut: cadre(0.5, 1), fin: null }, 4)).toContain("pad=360:640");
  });

  it("ne met pas de fondu sonore entre deux segments qui se suivent dans le rush", () => {
    const segment = (source: string, debut: number, fin: number) => ({ id: "s", source, debut, fin, role: "", citation: "", raison: "", decalageImage: 0, cadrage: null });
    expect(segmentsContigus(segment("a.mp4", 1, 3), segment("a.mp4", 3, 5))).toBe(true);
    expect(segmentsContigus(segment("a.mp4", 1, 3), segment("a.mp4", 3.5, 5))).toBe(false);
    expect(segmentsContigus(segment("a.mp4", 1, 3), segment("b.mp4", 3, 5))).toBe(false);
    expect(segmentsContigus(undefined, segment("a.mp4", 3, 5))).toBe(false);
    const args = argumentsClipAudio("a.mp4", 1, 2, "a.wav", { entree: false, sortie: true });
    expect(args[args.indexOf("-af") + 1]).toBe("apad=whole_dur=2,afade=t=out:st=1.97:d=0.03");
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
    const graphe = grapheVideo(APERCU, [{ source: src(null), debut: 57.7, duree: 2, position: 1, cadrage: null }], 2);
    expect(graphe.entrees).toEqual(["-ss", "57.7", "-t", "2", "-i", "rush.mp4"]);
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
