import { schemaSaisieCreationExtrait, tacheActive, type Projet, type ReponseExtraits, type Tache } from "@editeur/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { Contexte } from "../contexte.ts";
import { ErreurHttp } from "../erreurs.ts";
import { creerExtrait, listerExtraits } from "../extraits/extraits.ts";
import { lireProjet } from "../projets/projets.ts";
import type { FileDeTaches } from "../taches/file.ts";

interface ParametresId {
  Params: { id: string };
}

const schemaProposition = z.object({ consigne: z.string().trim().max(4000).default("") });

export function routesExtraits(contexte: Contexte, file: FileDeTaches): FastifyPluginAsync {
  return async (app) => {
    const creations = () => contexte.config.creations;

    app.get<ParametresId>("/projets/:id/extraits", async (requete): Promise<ReponseExtraits> => listerExtraits(creations(), requete.params.id));

    app.post<ParametresId>("/projets/:id/extraits/proposer", async (requete, reponse): Promise<Tache> => {
      const { id } = requete.params;
      const { consigne } = schemaProposition.parse(requete.body ?? {});
      const projet = await lireProjet(creations(), id);
      if (projet.metadata.versionValidee === null) throw new ErreurHttp(409, "Valide d'abord une version de la vidéo longue (onglet Aperçu).");
      if (file.liste().some((tache) => tache.type === "proposition-extraits" && tache.projet === id && tacheActive(tache))) {
        throw new ErreurHttp(409, "Une proposition d'extraits est déjà en cours pour ce projet.");
      }
      reponse.code(202);
      return file.ajouter("proposition-extraits", "Proposition d'extraits courts", id, { consigne });
    });

    app.post<ParametresId>("/projets/:id/extraits/creer", async (requete): Promise<Projet> =>
      creerExtrait(creations(), requete.params.id, schemaSaisieCreationExtrait.parse(requete.body)),
    );
  };
}
