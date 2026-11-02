import {
  schemaAjoutFichiers,
  schemaModificationProjet,
  schemaSaisieProjet,
  TAILLE_MAX_PREUVE,
  type DetailProjet,
  type Projet,
  type ReponseCreationProjet,
  type ReponseFichiersProjet,
  type ReponseListeProjets,
  type ReponseModificationProjet,
  type VerificationExport,
} from "@editeur/shared";
import type { FastifyPluginAsync } from "fastify";
import type { Contexte } from "../contexte.ts";
import { ErreurHttp } from "../erreurs.ts";
import {
  ajouterFichiersProjet,
  creerProjet,
  enregistrerPreuveAutorisation,
  lireProjet,
  modifierProjet,
  supprimerProjet,
} from "../projets/projets.ts";
import { fichiersProjet, lireDetailProjet, listerProjets } from "../projets/liste.ts";
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

    app.get("/projets", async (): Promise<ReponseListeProjets> => listerProjets(creations()));

    app.get<ParametresId>("/projets/:id", async (requete): Promise<DetailProjet> => lireDetailProjet(creations(), requete.params.id));

    app.put<ParametresId>("/projets/:id", async (requete): Promise<ReponseModificationProjet> =>
      modifierProjet(creations(), requete.params.id, schemaModificationProjet.parse(requete.body)),
    );

    app.delete<ParametresId>("/projets/:id", async (requete): Promise<{ corbeille: string; avertissements: string[] }> =>
      supprimerProjet(creations(), requete.params.id),
    );

    app.post<ParametresId>("/projets/:id/fichiers", async (requete): Promise<Projet> =>
      ajouterFichiersProjet(creations(), requete.params.id, schemaAjoutFichiers.parse(requete.body).fichiers),
    );

    app.get<ParametresId>("/projets/:id/fichiers", async (requete): Promise<ReponseFichiersProjet> =>
      fichiersProjet(creations(), requete.params.id, contexte.config.binaires.ffprobe),
    );

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
