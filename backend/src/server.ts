import { resolve } from "node:path";
import { creerApp } from "./app.ts";
import { lireConfigMachine, RACINE_DEPOT } from "./config.ts";
import { initialiserCreations } from "./creations/initialisation.ts";
import { codeErreur } from "./erreurs.ts";
import { FichierInvalideError } from "./fichiers.ts";

const HOTE = "127.0.0.1";
const PORT = Number(process.env.EDITEUR_PORT) || 4317;

function arreter(message: string): never {
  console.error(message);
  process.exit(1);
}

async function demarrer(): Promise<void> {
  const config = await lireConfigMachine(RACINE_DEPOT);
  const { crees } = await initialiserCreations(config.creations);
  console.log(`Dossier creations : ${config.creations}`);
  if (crees.length > 0) {
    console.log(`  ${crees.length} ${crees.length === 1 ? "élément créé" : "éléments créés"}.`);
  }

  const app = await creerApp({
    contexte: { racineDepot: RACINE_DEPOT, config },
    dossierInterface: resolve(RACINE_DEPOT, "frontend/dist"),
  });
  await app.listen({ host: HOTE, port: PORT });
  console.log(`Éditeur prêt : http://${HOTE}:${PORT}`);
}

try {
  await demarrer();
} catch (erreur) {
  if (erreur instanceof FichierInvalideError) {
    arreter(erreur.message);
  }
  if (codeErreur(erreur) === "EADDRINUSE") {
    arreter(`Le port ${PORT} est déjà utilisé : l'éditeur tourne peut-être déjà.`);
  }
  if (codeErreur(erreur) === "EACCES" || codeErreur(erreur) === "EPERM") {
    arreter(`Accès refusé : ${erreur instanceof Error ? erreur.message : String(erreur)}`);
  }
  console.error(erreur);
  process.exit(1);
}
