import {
  schemaModificationCommentaire,
  schemaPropositionPlan,
  schemaSaisieCommentaire,
  schemaSaisiePropositionPlan,
  STATUTS_PLAN,
  tacheActive,
  type Projet,
  type ReponsePlans,
  type RetoursVersion,
  type Tache,
  type VersionPlan,
} from "@editeur/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { Contexte } from "../contexte.ts";
import { ErreurHttp } from "../erreurs.ts";
import { cheminSur } from "../fichiers.ts";
import { changerStatutPlan, listerPlans, listerVersions, modifierPlan } from "../plans/plans.ts";
import { ajouterCommentaire, commentairesATraiter, listerRetours, modifierCommentaire, supprimerCommentaire } from "../plans/retours.ts";
import { definirVersionValidee, lireProjet } from "../projets/projets.ts";
import { verifierRenduPossible } from "../rendu/apercu.ts";
import type { FileDeTaches } from "../taches/file.ts";

interface ParametresId {
  Params: { id: string };
}

interface ParametresVersion {
  Params: { id: string; version: string };
}

interface ParametresCommentaire {
  Params: { id: string; version: string; commentaire: string };
}

const schemaStatut = z.object({ statut: z.enum(STATUTS_PLAN) });
const schemaValidation = z.object({ valide: z.boolean() });

export function routesPlans(contexte: Contexte, file: FileDeTaches): FastifyPluginAsync {
  return async (app) => {
    const { config } = contexte;
    const { ffprobe } = config.binaires;

    app.get<ParametresId>("/projets/:id/plans", async (requete): Promise<ReponsePlans> => listerPlans(config.creations, requete.params.id, ffprobe));

    app.put<ParametresVersion>("/projets/:id/plans/:version", async (requete): Promise<VersionPlan> =>
      modifierPlan(config.creations, requete.params.id, requete.params.version, schemaPropositionPlan.parse(requete.body), ffprobe),
    );

    app.post<ParametresVersion>("/projets/:id/plans/:version/statut", async (requete): Promise<VersionPlan> =>
      changerStatutPlan(config.creations, requete.params.id, requete.params.version, schemaStatut.parse(requete.body).statut, ffprobe),
    );

    app.get<ParametresVersion>("/projets/:id/plans/:version/retours", async (requete): Promise<RetoursVersion> =>
      listerRetours(config.creations, requete.params.id, requete.params.version),
    );

    app.post<ParametresVersion>("/projets/:id/plans/:version/retours", async (requete): Promise<RetoursVersion> =>
      ajouterCommentaire(config.creations, requete.params.id, requete.params.version, schemaSaisieCommentaire.parse(requete.body)),
    );

    app.put<ParametresCommentaire>("/projets/:id/plans/:version/retours/:commentaire", async (requete): Promise<RetoursVersion> => {
      const { id, version, commentaire } = requete.params;
      return modifierCommentaire(config.creations, id, version, commentaire, schemaModificationCommentaire.parse(requete.body));
    });

    app.delete<ParametresCommentaire>("/projets/:id/plans/:version/retours/:commentaire", async (requete): Promise<RetoursVersion> =>
      supprimerCommentaire(config.creations, requete.params.id, requete.params.version, requete.params.commentaire),
    );

    app.post<ParametresVersion>("/projets/:id/plans/:version/validation", async (requete): Promise<Projet> => {
      const { id, version } = requete.params;
      const { valide } = schemaValidation.parse(requete.body);
      const projet = await lireProjet(config.creations, id);
      const etat = (await listerVersions(cheminSur(config.creations, projet.chemin))).find((element) => element.version === version);
      if (etat === undefined) throw new ErreurHttp(404, `Version introuvable : ${version}`);
      if (!etat.apercu) throw new ErreurHttp(409, `La version ${version} n'a pas d'aperçu : rends-la avant de la valider.`);
      return definirVersionValidee(config.creations, id, valide ? version : null);
    });

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
      const { consigne, depuis } = schemaSaisiePropositionPlan.parse(requete.body ?? { consigne: "" });
      await lireProjet(config.creations, id);
      if (depuis !== null && commentairesATraiter(await listerRetours(config.creations, id, depuis)).length === 0) {
        throw new ErreurHttp(409, `Aucun commentaire à intégrer sur l'aperçu ${depuis}.`);
      }
      const enCours = file.liste().some((tache) => tache.type === "proposition-plan" && tache.projet === id && tacheActive(tache));
      if (enCours) throw new ErreurHttp(409, "Une proposition de plan est déjà en cours pour ce projet.");
      reponse.code(202);
      const libelle = depuis === null ? "Proposition du plan de montage" : `Version suivante d'après les commentaires sur ${depuis}`;
      return file.ajouter("proposition-plan", libelle, id, { consigne, depuis });
    });
  };
}
