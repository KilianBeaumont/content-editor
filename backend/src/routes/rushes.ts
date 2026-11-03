import { schemaSaisieRepere, type ReponseLancementPreparations, type ReponseReperes } from "@editeur/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { Contexte } from "../contexte.ts";
import { lancerPreparations } from "../rushes/preparation.ts";
import { ajouterRepere, listerReperes, supprimerRepere } from "../rushes/reperes.ts";
import type { FileDeTaches } from "../taches/file.ts";

interface ParametresId {
  Params: { id: string };
}

interface ParametresRepere {
  Params: { id: string; repere: string };
}

const schemaLancement = z.object({ fichiers: z.array(z.string()).nullable() });

export function routesRushes(contexte: Contexte, file: FileDeTaches): FastifyPluginAsync {
  return async (app) => {
    const creations = () => contexte.config.creations;

    app.post<ParametresId>("/projets/:id/preparations", async (requete, reponse): Promise<ReponseLancementPreparations> => {
      const { fichiers } = schemaLancement.parse(requete.body ?? { fichiers: null });
      reponse.code(202);
      return { ajoutees: await lancerPreparations(creations(), file, requete.params.id, fichiers) };
    });

    app.get<ParametresId>("/projets/:id/reperes", async (requete): Promise<ReponseReperes> => listerReperes(creations(), requete.params.id));

    app.post<ParametresId>("/projets/:id/reperes", async (requete): Promise<ReponseReperes> =>
      ajouterRepere(creations(), requete.params.id, schemaSaisieRepere.parse(requete.body)),
    );

    app.delete<ParametresRepere>("/projets/:id/reperes/:repere", async (requete): Promise<ReponseReperes> =>
      supprimerRepere(creations(), requete.params.id, requete.params.repere),
    );
  };
}
