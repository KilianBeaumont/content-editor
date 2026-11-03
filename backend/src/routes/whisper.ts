import { tacheActive, type EtatModeleWhisper, type Tache } from "@editeur/shared";
import type { FastifyPluginAsync } from "fastify";
import type { Contexte } from "../contexte.ts";
import { ErreurHttp } from "../erreurs.ts";
import { DEPOT_MODELES, DEPOT_VAD, etatModele, FICHIER_VAD, fichierModele } from "../media/whisper.ts";
import { lireParametres } from "../parametres.ts";
import type { FileDeTaches } from "../taches/file.ts";

export function routesWhisper(contexte: Contexte, file: FileDeTaches): FastifyPluginAsync {
  return async (app) => {
    const modele = async () => (await lireParametres(contexte.config.creations)).transcription.modele;

    app.get("/whisper/modele", async (): Promise<EtatModeleWhisper> => etatModele(contexte.config.modeles, await modele()));

    app.post("/whisper/modele/telecharger", async (_requete, reponse): Promise<Tache[]> => {
      const nom = await modele();
      const etat = await etatModele(contexte.config.modeles, nom);
      const enCours = file.liste().some((tache) => tache.type === "telechargement-modele" && tacheActive(tache));
      if (enCours) throw new ErreurHttp(409, "Un téléchargement de modèle est déjà en cours.");
      const taches: Tache[] = [];
      if (!etat.present) {
        taches.push(
          file.ajouter("telechargement-modele", `Téléchargement du modèle ${nom}`, null, { fichier: fichierModele(nom), depot: DEPOT_MODELES }),
        );
      }
      if (!etat.vad.present) {
        taches.push(
          file.ajouter("telechargement-modele", "Téléchargement de la détection de la parole", null, { fichier: FICHIER_VAD, depot: DEPOT_VAD }),
        );
      }
      reponse.code(202);
      return taches;
    });

    app.post("/whisper/essai", async (_requete, reponse): Promise<Tache> => {
      reponse.code(202);
      return file.ajouter("essai-transcription", "Essai de whisper.cpp", null, {});
    });
  };
}
