import { join, resolve } from "node:path";
import { schemaConfigMachine, type ConfigMachine } from "@editeur/shared";
import { ecrireJsonAtomique, lireJsonAvecDefauts } from "./fichiers.ts";

export const RACINE_DEPOT = resolve(import.meta.dirname, "../..");
export const FICHIER_CONFIG = "config.local.json";

export const CONFIG_PAR_DEFAUT: ConfigMachine = {
  creations: "../creations",
  modeles: "../outils/whisper/modeles",
  binaires: {
    ffmpeg: "ffmpeg",
    ffprobe: "ffprobe",
    claude: "claude",
    whisper: "whisper-cli",
  },
};

export async function lireConfigMachine(racineDepot: string): Promise<ConfigMachine> {
  const config = await lireJsonAvecDefauts(join(racineDepot, FICHIER_CONFIG), schemaConfigMachine, CONFIG_PAR_DEFAUT);
  return { ...config, creations: resolve(racineDepot, config.creations), modeles: resolve(racineDepot, config.modeles) };
}

export async function ecrireConfigMachine(racineDepot: string, config: ConfigMachine): Promise<ConfigMachine> {
  const resolue = { ...config, creations: resolve(racineDepot, config.creations), modeles: resolve(racineDepot, config.modeles) };
  await ecrireJsonAtomique(join(racineDepot, FICHIER_CONFIG), resolue);
  return resolue;
}
