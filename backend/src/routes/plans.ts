import { schemaSaisiePropositionPlan, tacheActive, type ReponsePlans, type Tache } from "@editeur/shared";
import type { FastifyPluginAsync } from "fastify";
import type { Contexte } from "../contexte.ts";
import { ErreurHttp } from "../erreurs.ts";
import { listerPlans } from "../plans/plans.ts";
import { lireProjet } from "../projets/projets.ts";
import type { FileDeTaches } from "../taches/file.ts";

interface ParametresId {
  Params: { id: string };
}

export function routesPlans(contexte: Contexte, file: FileDeTaches): FastifyPluginAsync {
  return async (app) => {
    const { config } = contexte;

    app.get<ParametresId>("/projets/:id/plans", async (requete): Promise<ReponsePlans> =>
      listerPlans(config.creations, requete.params.id, config.binaires.ffprobe),
    );

    app.post<ParametresId>("/projets/:id/plans/proposer", async (requete, reponse): Promise<Tache> => {
      const { id } = requete.params;
      const { consigne } = schemaSaisiePropositionPlan.parse(requete.body ?? { consigne: "" });
      await lireProjet(config.creations, id);
      const enCours = file.liste().some((tache) => tache.type === "proposition-plan" && tache.projet === id && tacheActive(tache));
      if (enCours) throw new ErreurHttp(409, "Une proposition de plan est déjà en cours pour ce projet.");
      reponse.code(202);
      return file.ajouter("proposition-plan", "Proposition du plan de montage", id, { consigne });
    });
  };
}
