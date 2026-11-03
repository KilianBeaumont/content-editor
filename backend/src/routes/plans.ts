import {
  schemaPropositionPlan,
  schemaSaisiePropositionPlan,
  STATUTS_PLAN,
  tacheActive,
  type ReponsePlans,
  type Tache,
  type VersionPlan,
} from "@editeur/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { Contexte } from "../contexte.ts";
import { ErreurHttp } from "../erreurs.ts";
import { changerStatutPlan, listerPlans, modifierPlan } from "../plans/plans.ts";
import { lireProjet } from "../projets/projets.ts";
import { verifierRenduPossible } from "../rendu/apercu.ts";
import { cheminSur } from "../fichiers.ts";
import type { FileDeTaches } from "../taches/file.ts";

interface ParametresId {
  Params: { id: string };
}

interface ParametresVersion {
  Params: { id: string; version: string };
}

const schemaStatut = z.object({ statut: z.enum(STATUTS_PLAN) });

export function routesPlans(contexte: Contexte, file: FileDeTaches): FastifyPluginAsync {
  return async (app) => {
    const { config } = contexte;

    app.get<ParametresId>("/projets/:id/plans", async (requete): Promise<ReponsePlans> =>
      listerPlans(config.creations, requete.params.id, config.binaires.ffprobe),
    );

    app.put<ParametresVersion>("/projets/:id/plans/:version", async (requete): Promise<VersionPlan> =>
      modifierPlan(config.creations, requete.params.id, requete.params.version, schemaPropositionPlan.parse(requete.body), config.binaires.ffprobe),
    );

    app.post<ParametresVersion>("/projets/:id/plans/:version/statut", async (requete): Promise<VersionPlan> =>
      changerStatutPlan(config.creations, requete.params.id, requete.params.version, schemaStatut.parse(requete.body).statut, config.binaires.ffprobe),
    );

    app.post<ParametresVersion>("/projets/:id/plans/:version/apercu", async (requete, reponse): Promise<Tache> => {
      const { id, version } = requete.params;
      const projet = await lireProjet(config.creations, id);
      try {
        await verifierRenduPossible(cheminSur(config.creations, projet.chemin), version);
      } catch (erreur) {
        throw new ErreurHttp(409, erreur instanceof Error ? erreur.message : String(erreur));
      }
      const enCours = file
        .liste()
        .some((tache) => tache.type === "rendu-apercu" && tache.projet === id && tache.parametres.version === version && tacheActive(tache));
      if (enCours) throw new ErreurHttp(409, "Cet aperçu est déjà en cours de rendu.");
      reponse.code(202);
      return file.ajouter("rendu-apercu", `Rendu de l'aperçu ${version}`, id, { version });
    });

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
