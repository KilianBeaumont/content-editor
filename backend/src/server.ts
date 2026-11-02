import { resolve } from "node:path";
import { creerApp } from "./app.ts";

const HOTE = "127.0.0.1";
const PORT = 4317;

const app = await creerApp({
  dossierInterface: resolve(import.meta.dirname, "../../frontend/dist"),
});

try {
  await app.listen({ host: HOTE, port: PORT });
  console.log(`Éditeur prêt : http://${HOTE}:${PORT}`);
} catch (erreur) {
  if (erreur instanceof Error && "code" in erreur && erreur.code === "EADDRINUSE") {
    console.error(`Le port ${PORT} est déjà utilisé : l'éditeur tourne peut-être déjà.`);
  } else {
    console.error(erreur);
  }
  process.exit(1);
}
