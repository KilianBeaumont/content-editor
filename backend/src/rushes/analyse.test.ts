import type { InfosVideo } from "@editeur/shared";
import { describe, expect, it } from "vitest";
import { analyserNiveaux, argumentsProxy, echapperFiltre, estHdr, filtrePlanches, filtreProxy, intervallePlanches, lireNiveau } from "./analyse.ts";

const VIDEO: InfosVideo = { largeur: 3840, hauteur: 2160, codec: "hevc", imagesParSeconde: 59.94, transfert: null };

describe("proxy", () => {
  it("réduit à 640 px dans le bon sens et convertit le HDR en SDR", () => {
    expect(filtreProxy(VIDEO)).toBe("scale=640:-2:flags=bicubic,format=yuv420p,fps=30");
    expect(filtreProxy({ ...VIDEO, largeur: 1080, hauteur: 1920 })).toMatch(/^scale=-2:640:/);
    const hdr = { ...VIDEO, transfert: "arib-std-b67" };
    expect(estHdr(hdr)).toBe(true);
    expect(estHdr(VIDEO)).toBe(false);
    expect(estHdr(null)).toBe(false);
    expect(filtreProxy(hdr)).toContain("zscale=tin=arib-std-b67:");
    expect(filtreProxy(hdr)).toContain("tonemap=hable");
    expect(filtreProxy({ ...VIDEO, transfert: "smpte2084" })).toContain("zscale=tin=smpte2084:");
  });

  it("garde seulement la première piste vidéo et la première piste audio", () => {
    const args = argumentsProxy("rush.MOV", VIDEO, true, "proxy.mp4");
    expect(args.filter((arg, index) => args[index - 1] === "-map")).toEqual(["0:v:0", "0:a:0"]);
    expect(args.at(-1)).toBe("proxy.mp4");
    expect(argumentsProxy("rush.MOV", VIDEO, false, "proxy.mp4")).not.toContain("0:a:0");
  });
});

describe("niveaux sonores", () => {
  it("lit les niveaux de ffmpeg, silence numérique compris", () => {
    expect(lireNiveau("lavfi.astats.Overall.RMS_level=-23.456")).toBe(-23.5);
    expect(lireNiveau("lavfi.astats.Overall.RMS_level=-inf")).toBe(-100);
    expect(lireNiveau("frame:1    pts:1600    pts_time:0.1")).toBeNull();
  });

  it("repère les silences par rapport au bruit de fond et les pics espacés", () => {
    const voix = (n: number) => Array.from({ length: n }, (_, index) => -25 - (index % 3));
    const niveaux = [...Array<number>(8).fill(-45), ...voix(30), -44, -43, -45, ...voix(20), -44, ...voix(20), -8, ...voix(30), -10, -9, ...voix(5)];
    const analyse = analyserNiveaux(niveaux);
    expect(analyse.silences).toEqual([
      { debut: 0, fin: 0.8 },
      { debut: 3.8, fin: 4.1 },
    ]);
    expect(analyse.pics.map(({ temps }) => temps)).toEqual([8.2, 11.4]);
  });
});

describe("planches", () => {
  it("choisit un intervalle qui donne au plus 90 vignettes", () => {
    expect(intervallePlanches(60)).toBe(1);
    expect(intervallePlanches(163.5)).toBe(2);
    expect(intervallePlanches(2320)).toBe(30);
    expect(intervallePlanches(100000)).toBe(30);
  });

  it("écrit l'horaire avec une police explicite, chemin Windows échappé", () => {
    expect(echapperFiltre("C:\\Windows\\Fonts\\arial.ttf")).toBe("C\\:/Windows/Fonts/arial.ttf");
    expect(filtrePlanches(2, "C:/Windows/Fonts/arial.ttf")).toContain("drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf'");
    expect(filtrePlanches(2, null)).toBe("select='isnan(prev_selected_t)+gte(t-prev_selected_t,1.98)',scale=320:-2,tile=4x3:padding=4:color=black");
  });
});
