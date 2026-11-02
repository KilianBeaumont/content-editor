import { schemaSaisieAuteur, type Auteur, type ReponseListeAuteurs } from "@editeur/shared";
import type { FastifyPluginAsync } from "fastify";
import { creerAuteur, lireAuteur, listerAuteurs, modifierAuteur, supprimerAuteur } from "../auteurs/auteurs.ts";
import type { Contexte } from "../contexte.ts";

interface ParametresId {
  Params: { id: string };
}

export function routesAuteurs(contexte: Contexte): FastifyPluginAsync {
  return async (app) => {
    const creations = () => contexte.config.creations;

    app.get("/auteurs", async (): Promise<ReponseListeAuteurs> => listerAuteurs(creations()));

    app.get<ParametresId>("/auteurs/:id", async (requete): Promise<Auteur> => lireAuteur(creations(), requete.params.id));

    app.post("/auteurs", async (requete, reponse): Promise<Auteur> => {
      const auteur = await creerAuteur(creations(), schemaSaisieAuteur.parse(requete.body));
      reponse.code(201);
      return auteur;
    });

    app.put<ParametresId>("/auteurs/:id", async (requete): Promise<Auteur> =>
      modifierAuteur(creations(), requete.params.id, schemaSaisieAuteur.parse(requete.body)),
    );

    app.delete<ParametresId>("/auteurs/:id", async (requete): Promise<{ corbeille: string }> => ({
      corbeille: await supprimerAuteur(creations(), requete.params.id),
    }));
  };
}
