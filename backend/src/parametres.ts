import { join } from "node:path";
import { PARAMETRES_PAR_DEFAUT, schemaParametres, type Parametres } from "@editeur/shared";
import { ecrireJsonAtomique, lireJsonAvecDefauts } from "./fichiers.ts";

const FICHIER_PARAMETRES = "parametres.json";

export function lireParametres(creations: string): Promise<Parametres> {
  return lireJsonAvecDefauts(join(creations, FICHIER_PARAMETRES), schemaParametres, PARAMETRES_PAR_DEFAUT);
}

export function ecrireParametres(creations: string, parametres: Parametres): Promise<void> {
  return ecrireJsonAtomique(join(creations, FICHIER_PARAMETRES), parametres);
}
