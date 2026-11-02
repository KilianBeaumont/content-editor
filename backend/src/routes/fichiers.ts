import { stat } from "node:fs/promises";
import type { FastifyPluginAsync } from "fastify";
import type { Contexte } from "../contexte.ts";
import { codeErreur, ErreurHttp } from "../erreurs.ts";
import { cheminSur } from "../fichiers.ts";

interface ParametresFichier {
  Params: { "*": string };
}

export function routesFichiers(contexte: Contexte): FastifyPluginAsync {
  return async (app) => {
    app.get<ParametresFichier>("/fichiers/*", async (requete, reponse) => {
      const relatif = requete.params["*"];
      const absolu = cheminSur(contexte.config.creations, relatif);
      try {
        if (!(await stat(absolu)).isFile()) {
          throw new ErreurHttp(404, `Fichier introuvable : ${relatif}`);
        }
      } catch (erreur) {
        if (codeErreur(erreur) === "ENOENT") {
          throw new ErreurHttp(404, `Fichier introuvable : ${relatif}`);
        }
        throw erreur;
      }
      return reponse.sendFile(relatif, contexte.config.creations);
    });
  };
}
