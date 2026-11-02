import {
  schemaNouvelAsset,
  schemaSaisieAsset,
  TAILLE_MAX_ASSET,
  type ElementBibliotheque,
  type ReponseBibliotheque,
  type ReponseTeleversementAsset,
} from "@editeur/shared";
import type { FastifyPluginAsync } from "fastify";
import {
  ajouterAsset,
  lireAsset,
  listerBibliotheque,
  modifierAsset,
  supprimerAsset,
  televerserAsset,
} from "../bibliotheque/bibliotheque.ts";
import type { Contexte } from "../contexte.ts";
import { ErreurHttp } from "../erreurs.ts";

interface ParametresId {
  Params: { id: string };
}

interface ParametresEmplacement {
  Params: { chaine: string; type: string };
}

export function routesBibliotheque(contexte: Contexte): FastifyPluginAsync {
  return async (app) => {
    const creations = () => contexte.config.creations;

    app.get("/bibliotheque", async (): Promise<ReponseBibliotheque> => listerBibliotheque(creations()));

    app.get<ParametresId>("/bibliotheque/assets/:id", async (requete): Promise<ElementBibliotheque> =>
      lireAsset(creations(), requete.params.id),
    );

    app.post("/bibliotheque/assets", async (requete, reponse): Promise<ElementBibliotheque> => {
      const element = await ajouterAsset(creations(), schemaNouvelAsset.parse(requete.body));
      reponse.code(201);
      return element;
    });

    app.put<ParametresId>("/bibliotheque/assets/:id", async (requete): Promise<ElementBibliotheque> =>
      modifierAsset(creations(), requete.params.id, schemaSaisieAsset.parse(requete.body)),
    );

    app.delete<ParametresId>("/bibliotheque/assets/:id", async (requete): Promise<{ corbeille: string | null }> =>
      supprimerAsset(creations(), requete.params.id),
    );

    app.post<ParametresEmplacement>(
      "/bibliotheque/fichiers/:chaine/:type",
      async (requete): Promise<ReponseTeleversementAsset> => {
        const fichier = await requete.file({ limits: { fileSize: TAILLE_MAX_ASSET, files: 1 } });
        if (fichier === undefined) {
          throw new ErreurHttp(400, "Aucun fichier reçu.");
        }
        try {
          return await televerserAsset(
            creations(),
            requete.params.chaine,
            requete.params.type,
            fichier.filename,
            fichier.file,
          );
        } catch (erreur) {
          fichier.file.resume();
          throw erreur;
        }
      },
    );
  };
}
