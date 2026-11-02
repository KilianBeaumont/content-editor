import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CATEGORIES, CHAINES_BIBLIOTHEQUE, PARAMETRES_PAR_DEFAUT, TYPES, TYPES_ASSET } from "@editeur/shared";
import { codeErreur } from "../erreurs.ts";
import { modeleHooks, modeleStyle } from "./modeles.ts";

function dossiers(): string[] {
  const liste = ["inbox", "artistes", "auteurs", "chaine-creation", "chaine-recits", "corbeille"];
  for (const categorie of CATEGORIES) {
    liste.push(`guides/${categorie}/inspiration/videos`, `guides/${categorie}/inspiration/analyses`);
  }
  for (const chaine of CHAINES_BIBLIOTHEQUE) {
    liste.push(...TYPES_ASSET.map((type) => `bibliotheque/${chaine}/${TYPES[type].dossier}`));
  }
  return liste;
}

function fichiers(): Array<{ chemin: string; contenu: string }> {
  const liste = [
    { chemin: "parametres.json", contenu: `${JSON.stringify(PARAMETRES_PAR_DEFAUT, null, 2)}\n` },
    { chemin: "bibliotheque/catalogue.json", contenu: `${JSON.stringify({ assets: [] }, null, 2)}\n` },
  ];
  for (const categorie of CATEGORIES) {
    liste.push(
      { chemin: `guides/${categorie}/style.md`, contenu: modeleStyle(categorie) },
      { chemin: `guides/${categorie}/hooks.md`, contenu: modeleHooks(categorie) },
    );
  }
  return liste;
}

export interface RapportInitialisation {
  crees: string[];
}

export async function initialiserCreations(racine: string): Promise<RapportInitialisation> {
  const crees: string[] = [];

  for (const dossier of dossiers()) {
    const premierCree = await mkdir(join(racine, dossier), { recursive: true });
    if (premierCree !== undefined) {
      crees.push(`${dossier}/`);
    }
  }

  for (const { chemin, contenu } of fichiers()) {
    try {
      await writeFile(join(racine, chemin), contenu, { encoding: "utf8", flag: "wx" });
      crees.push(chemin);
    } catch (erreur) {
      if (codeErreur(erreur) !== "EEXIST") {
        throw erreur;
      }
    }
  }

  return { crees };
}
