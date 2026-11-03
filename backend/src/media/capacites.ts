import { executer } from "../processus.ts";

export type EncodeurH264 = "h264_nvenc" | "h264_videotoolbox" | "libx264";

export interface CapacitesFfmpeg {
  encodeur: EncodeurH264;
  placebo: boolean;
}

const DELAI_MS = 20_000;
const ENCODEURS_MATERIELS: EncodeurH264[] = process.platform === "darwin" ? ["h264_videotoolbox"] : ["h264_nvenc"];
const cache = new Map<string, Promise<CapacitesFfmpeg>>();

async function fonctionne(ffmpeg: string, args: string[]): Promise<boolean> {
  try {
    const resultat = await executer(ffmpeg, ["-v", "error", "-nostdin", ...args], { delaiMs: DELAI_MS });
    return resultat.code === 0 && !resultat.delaiDepasse;
  } catch {
    return false;
  }
}

async function detecter(ffmpeg: string): Promise<CapacitesFfmpeg> {
  let encodeur: EncodeurH264 = "libx264";
  for (const candidat of ENCODEURS_MATERIELS) {
    if (await fonctionne(ffmpeg, ["-f", "lavfi", "-i", "color=c=black:s=256x256:d=0.1", "-frames:v", "2", "-c:v", candidat, "-f", "null", "-"])) {
      encodeur = candidat;
      break;
    }
  }
  const placebo = await fonctionne(ffmpeg, [
    "-init_hw_device",
    "vulkan",
    "-f",
    "lavfi",
    "-i",
    "color=c=black:s=64x64:d=0.1",
    "-vf",
    "libplacebo=w=32:h=32:format=yuv420p",
    "-frames:v",
    "1",
    "-f",
    "null",
    "-",
  ]);
  return { encodeur, placebo };
}

export function capacitesFfmpeg(ffmpeg: string): Promise<CapacitesFfmpeg> {
  let capacites = cache.get(ffmpeg);
  if (capacites === undefined) {
    capacites = detecter(ffmpeg);
    cache.set(ffmpeg, capacites);
  }
  return capacites;
}
