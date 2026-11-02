import { join, resolve } from "node:path";
import { schemaConfigMachine, type ConfigMachine } from "@editeur/shared";
import { z } from "zod";
import { codeErreur } from "./erreurs.ts";
import { lireTexte } from "./fichiers.ts";

export const RACINE_DEPOT = resolve(import.meta.dirname, "../..");
export const FICHIER_CONFIG = "config.local.json";

export const CONFIG_PAR_DEFAUT: ConfigMachine = {
  creations: "../creations",
  binaires: {
    ffmpeg: "ffmpeg",
    ffprobe: "ffprobe",
    claude: "claude",
    whisper: "whisper-cli",
  },
};

export class ConfigInvalideError extends Error {}

async function lireFichierConfig(chemin: string): Promise<unknown> {
  try {
    return JSON.parse(await lireTexte(chemin));
  } catch (erreur) {
    if (codeErreur(erreur) === "ENOENT") {
      return {};
    }
    if (erreur instanceof SyntaxError) {
      throw new ConfigInvalideError(`${FICHIER_CONFIG} n'est pas un JSON valide : ${erreur.message}`);
    }
    throw erreur;
  }
}

export async function lireConfigMachine(racineDepot: string): Promise<ConfigMachine> {
  const fichier = await lireFichierConfig(join(racineDepot, FICHIER_CONFIG));
  const partiel = z
    .object({ creations: z.unknown(), binaires: z.record(z.string(), z.unknown()).optional() })
    .partial()
    .safeParse(fichier);
  if (!partiel.success) {
    throw new ConfigInvalideError(`${FICHIER_CONFIG} doit contenir un objet JSON.`);
  }

  const fusion = {
    creations: partiel.data.creations ?? CONFIG_PAR_DEFAUT.creations,
    binaires: { ...CONFIG_PAR_DEFAUT.binaires, ...partiel.data.binaires },
  };
  const resultat = schemaConfigMachine.safeParse(fusion);
  if (!resultat.success) {
    throw new ConfigInvalideError(`${FICHIER_CONFIG} invalide :\n${z.prettifyError(resultat.error)}`);
  }

  return { ...resultat.data, creations: resolve(racineDepot, resultat.data.creations) };
}
