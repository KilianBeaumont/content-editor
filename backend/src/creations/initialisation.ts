import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CATEGORIES, CHAINES_BIBLIOTHEQUE, GUIDE_ANIMATIONS, PARAMETRES_PAR_DEFAUT, SUJETS_GUIDE, TYPES, TYPES_ASSET } from "@editeur/shared";
import { codeErreur } from "../erreurs.ts";
import { MODELE_STYLE_ANIMATIONS, modeleHooks, modeleStyle } from "./modeles.ts";

function dossiers(): string[] {
  const liste = ["inbox", "artistes", "auteurs", "chaine-creation", "chaine-recits", "corbeille"];
  for (const sujet of SUJETS_GUIDE) {
    liste.push(`guides/${sujet}/inspiration/videos`, `guides/${sujet}/inspiration/analyses`);
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
  liste.push({ chemin: `guides/${GUIDE_ANIMATIONS}/style.md`, contenu: MODELE_STYLE_ANIMATIONS });
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
