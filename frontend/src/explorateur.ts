import { envoyerJson } from "./api.ts";

export const NOM_EXPLORATEUR = navigator.userAgent.includes("Mac") ? "le Finder" : "l'Explorateur";

export async function afficherExport(projet: string, sortie: string): Promise<void> {
  await envoyerJson("POST", `/api/projets/${projet}/exports/${sortie}/afficher`);
}
