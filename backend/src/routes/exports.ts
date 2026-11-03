import { SORTIES, tacheActive, type ReponseDescription, type ReponseExports, type ReponseExportsGlobaux, type Tache } from "@editeur/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { Contexte } from "../contexte.ts";
import { ErreurHttp } from "../erreurs.ts";
import { cheminSur } from "../fichiers.ts";
import { lirePlan } from "../plans/plans.ts";
import { lireProjet } from "../projets/projets.ts";
import { descriptionProjet } from "../rendu/description.ts";
import { listerExports, listerTousLesExports, marquerPublie, verifierExportPossible } from "../rendu/export.ts";
import type { FileDeTaches } from "../taches/file.ts";

interface ParametresId {
  Params: { id: string };
}

interface ParametresSortie {
  Params: { id: string; sortie: string };
}

const schemaExport = z.object({ sortie: z.enum(SORTIES) });
const schemaPublication = z.object({ publie: z.boolean() });

export function routesExports(contexte: Contexte, file: FileDeTaches): FastifyPluginAsync {
  return async (app) => {
    const creations = () => contexte.config.creations;

    app.get("/exports", async (): Promise<ReponseExportsGlobaux> => listerTousLesExports(creations()));

    app.get<ParametresId>("/projets/:id/exports", async (requete): Promise<ReponseExports> => listerExports(creations(), requete.params.id));

    app.post<ParametresId>("/projets/:id/exports", async (requete, reponse): Promise<Tache> => {
      const { id } = requete.params;
      const { sortie } = schemaExport.parse(requete.body);
      const projet = await lireProjet(creations(), id);
      try {
        await verifierExportPossible(creations(), projet, sortie);
      } catch (erreur) {
        throw new ErreurHttp(409, erreur instanceof Error ? erreur.message : String(erreur));
      }
      const enCours = file.liste().some((tache) => tache.type === "export-final" && tache.projet === id && tache.parametres.sortie === sortie && tacheActive(tache));
      if (enCours) throw new ErreurHttp(409, "Cet export est déjà en cours.");
      reponse.code(202);
      return file.ajouter("export-final", `Export final (${projet.metadata.versionValidee ?? ""})`, id, { sortie });
    });

    app.get<ParametresId>("/projets/:id/description", async (requete): Promise<ReponseDescription> => {
      const projet = await lireProjet(creations(), requete.params.id);
      const version = projet.metadata.versionValidee;
      const plan = version === null ? null : await lirePlan(cheminSur(creations(), projet.chemin), version);
      return { texte: await descriptionProjet(creations(), projet, plan) };
    });

    app.post<ParametresSortie>("/projets/:id/exports/:sortie/publication", async (requete): Promise<ReponseExports> => {
      const sortie = z.enum(SORTIES).parse(requete.params.sortie);
      return marquerPublie(creations(), requete.params.id, sortie, schemaPublication.parse(requete.body).publie);
    });
  };
}
