import { describe, expect, it } from "vitest";
import { analyserSortieFfprobe } from "./ffprobe.ts";

describe("analyserSortieFfprobe", () => {
  it("tient compte de la rotation d'une vidéo de téléphone", () => {
    const sortie = JSON.stringify({
      format: { duration: "12.5" },
      streams: [
        {
          codec_type: "video",
          codec_name: "hevc",
          width: 1920,
          height: 1080,
          avg_frame_rate: "30000/1001",
          color_transfer: "arib-std-b67",
          side_data_list: [{ rotation: -90 }],
        },
        { codec_type: "audio", codec_name: "aac", channels: 2, sample_rate: "48000" },
      ],
    });
    expect(analyserSortieFfprobe(sortie)).toEqual({
      duree: 12.5,
      video: { largeur: 1080, hauteur: 1920, codec: "hevc", imagesParSeconde: 29.97, transfert: "arib-std-b67" },
      audio: { codec: "aac", canaux: 2, frequence: 48000 },
    });
  });

  it("ignore la pochette d'un MP3 et les valeurs absentes", () => {
    const sortie = JSON.stringify({
      format: { duration: "N/A" },
      streams: [
        { codec_type: "audio", codec_name: "mp3", channels: 2 },
        { codec_type: "video", codec_name: "mjpeg", width: 500, height: 500, disposition: { attached_pic: 1 } },
      ],
    });
    expect(analyserSortieFfprobe(sortie)).toEqual({
      duree: null,
      video: null,
      audio: { codec: "mp3", canaux: 2, frequence: null },
    });
  });
});
