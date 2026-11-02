import { schemaSaisieArtiste, type Artiste, type ReponseListeArtistes } from "@editeur/shared";
import type { FastifyPluginAsync } from "fastify";
import {
  creerArtiste,
  enregistrerPreuve,
  lireArtiste,
  listerArtistes,
  modifierArtiste,
  supprimerArtiste,
} from "../artistes/artistes.ts";
import type { Contexte } from "../contexte.ts";
import { ErreurHttp } from "../erreurs.ts";

const TAILLE_MAX_PREUVE = 50 * 1024 * 1024;

interface ParametresId {
  Params: { id: string };
}

export function routesArtistes(contexte: Contexte): FastifyPluginAsync {
  return async (app) => {
    const creations = () => contexte.config.creations;

    app.get("/artistes", async (): Promise<ReponseListeArtistes> => listerArtistes(creations()));

    app.get<ParametresId>("/artistes/:id", async (requete): Promise<Artiste> => lireArtiste(creations(), requete.params.id));

    app.post("/artistes", async (requete, reponse): Promise<Artiste> => {
      const artiste = await creerArtiste(creations(), schemaSaisieArtiste.parse(requete.body));
      reponse.code(201);
      return artiste;
    });

    app.put<ParametresId>("/artistes/:id", async (requete): Promise<Artiste> =>
      modifierArtiste(creations(), requete.params.id, schemaSaisieArtiste.parse(requete.body)),
    );

    app.delete<ParametresId>("/artistes/:id", async (requete): Promise<{ corbeille: string }> => ({
      corbeille: await supprimerArtiste(creations(), requete.params.id),
    }));

    app.post<ParametresId>("/artistes/:id/preuve", async (requete): Promise<Artiste> => {
      const fichier = await requete.file({ limits: { fileSize: TAILLE_MAX_PREUVE, files: 1 } });
      if (fichier === undefined) {
        throw new ErreurHttp(400, "Aucun fichier reçu.");
      }
      try {
        return await enregistrerPreuve(creations(), requete.params.id, fichier.filename, fichier.file);
      } catch (erreur) {
        fichier.file.resume();
        throw erreur;
      }
    });
  };
}
