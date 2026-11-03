import { schemaSaisieGuide, type GuideCategorie, type ReponseGuides, type VideoInspiration } from "@editeur/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { Contexte } from "../contexte.ts";
import { ErreurHttp } from "../erreurs.ts";
import { categorieValide, ecrireGuide, lancerAnalyses, lireGuide, listerGuides, supprimerInspiration, televerserInspiration } from "../inspiration/inspiration.ts";
import type { FileDeTaches } from "../taches/file.ts";

interface ParametresCategorie {
  Params: { categorie: string };
}

interface ParametresVideo {
  Params: { categorie: string; nom: string };
}

const schemaAnalyses = z.object({ noms: z.array(z.string()).nullable() });

export function routesGuides(contexte: Contexte, file: FileDeTaches): FastifyPluginAsync {
  return async (app) => {
    const creations = () => contexte.config.creations;

    app.get("/guides", async (): Promise<ReponseGuides> => listerGuides(creations()));

    app.get<ParametresCategorie>("/guides/:categorie", async (requete): Promise<GuideCategorie> =>
      lireGuide(creations(), categorieValide(requete.params.categorie)),
    );

    app.put<ParametresCategorie>("/guides/:categorie", async (requete): Promise<GuideCategorie> =>
      ecrireGuide(creations(), categorieValide(requete.params.categorie), schemaSaisieGuide.parse(requete.body)),
    );

    app.post<ParametresCategorie>("/guides/:categorie/videos", async (requete): Promise<VideoInspiration> => {
      const categorie = categorieValide(requete.params.categorie);
      const fichier = await requete.file({ limits: { fileSize: Number.MAX_SAFE_INTEGER, files: 1 } });
      if (fichier === undefined) throw new ErreurHttp(400, "Aucun fichier reçu.");
      try {
        return await televerserInspiration(creations(), categorie, fichier.filename, fichier.file);
      } catch (erreur) {
        fichier.file.resume();
        throw erreur;
      }
    });

    app.delete<ParametresVideo>("/guides/:categorie/videos/:nom", async (requete): Promise<{ corbeille: string }> =>
      supprimerInspiration(creations(), categorieValide(requete.params.categorie), requete.params.nom),
    );

    app.post<ParametresCategorie>("/guides/:categorie/analyses", async (requete, reponse): Promise<{ ajoutees: number }> => {
      const { noms } = schemaAnalyses.parse(requete.body ?? { noms: null });
      reponse.code(202);
      return { ajoutees: await lancerAnalyses(creations(), file, categorieValide(requete.params.categorie), noms) };
    });
  };
}
