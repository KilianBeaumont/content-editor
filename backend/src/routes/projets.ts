import {
  schemaSaisieProjet,
  TAILLE_MAX_PREUVE,
  type Projet,
  type ReponseCreationProjet,
  type VerificationExport,
} from "@editeur/shared";
import type { FastifyPluginAsync } from "fastify";
import type { Contexte } from "../contexte.ts";
import { ErreurHttp } from "../erreurs.ts";
import { creerProjet, enregistrerPreuveAutorisation, lireProjet } from "../projets/projets.ts";
import { verifierExportable } from "../projets/verification.ts";

interface ParametresId {
  Params: { id: string };
}

export function routesProjets(contexte: Contexte): FastifyPluginAsync {
  return async (app) => {
    const creations = () => contexte.config.creations;

    app.post("/projets", async (requete, reponse): Promise<ReponseCreationProjet> => {
      const creation = await creerProjet(creations(), schemaSaisieProjet.parse(requete.body));
      reponse.code(201);
      return creation;
    });

    app.get<ParametresId>("/projets/:id", async (requete): Promise<Projet> => lireProjet(creations(), requete.params.id));

    app.get<ParametresId>("/projets/:id/verification", async (requete): Promise<VerificationExport> =>
      verifierExportable(creations(), await lireProjet(creations(), requete.params.id)),
    );

    app.post<ParametresId>("/projets/:id/autorisation/preuve", async (requete): Promise<Projet> => {
      const fichier = await requete.file({ limits: { fileSize: TAILLE_MAX_PREUVE, files: 1 } });
      if (fichier === undefined) {
        throw new ErreurHttp(400, "Aucun fichier reçu.");
      }
      try {
        return await enregistrerPreuveAutorisation(creations(), requete.params.id, fichier.filename, fichier.file);
      } catch (erreur) {
        fichier.file.resume();
        throw erreur;
      }
    });
  };
}
