import { tacheActive, type EtatModeleWhisper, type Tache } from "@editeur/shared";
import type { FastifyPluginAsync } from "fastify";
import type { Contexte } from "../contexte.ts";
import { ErreurHttp } from "../erreurs.ts";
import { etatModele } from "../media/whisper.ts";
import { lireParametres } from "../parametres.ts";
import type { FileDeTaches } from "../taches/file.ts";

export function routesWhisper(contexte: Contexte, file: FileDeTaches): FastifyPluginAsync {
  return async (app) => {
    const modele = async () => (await lireParametres(contexte.config.creations)).transcription.modele;

    app.get("/whisper/modele", async (): Promise<EtatModeleWhisper> => etatModele(contexte.config.modeles, await modele()));

    app.post("/whisper/modele/telecharger", async (_requete, reponse): Promise<Tache> => {
      const nom = await modele();
      const enCours = file.liste().some((tache) => tache.type === "telechargement-modele" && tacheActive(tache));
      if (enCours) throw new ErreurHttp(409, "Un téléchargement de modèle est déjà en cours.");
      reponse.code(202);
      return file.ajouter("telechargement-modele", `Téléchargement du modèle ${nom}`, null, { modele: nom });
    });

    app.post("/whisper/essai", async (_requete, reponse): Promise<Tache> => {
      reponse.code(202);
      return file.ajouter("essai-transcription", "Essai de whisper.cpp", null, {});
    });
  };
}
