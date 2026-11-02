import { mkdir } from "node:fs/promises";
import { basename, dirname } from "node:path";
import { cheminSur, renommer } from "./fichiers.ts";

export async function mettreALaCorbeille(
  creations: string,
  cheminRelatif: string,
  categorie: string,
  maintenant = new Date(),
): Promise<string> {
  const source = cheminSur(creations, cheminRelatif);
  const horodatage = maintenant.toISOString().replace(/[:.]/g, "-");
  const relatifCible = `corbeille/${categorie}/${basename(source)}_${horodatage}`;
  const cible = cheminSur(creations, relatifCible);
  await mkdir(dirname(cible), { recursive: true });
  await renommer(source, cible);
  return relatifCible;
}
