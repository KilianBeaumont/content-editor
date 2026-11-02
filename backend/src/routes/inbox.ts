import type { ReponseEnvoiInbox, ReponseInbox } from "@editeur/shared";
import type { FastifyPluginAsync } from "fastify";
import type { Contexte } from "../contexte.ts";
import { ErreurHttp } from "../erreurs.ts";
import { enregistrerDansInbox, listerInbox, mettreInboxALaCorbeille } from "../inbox/inbox.ts";

interface ParametresFichier {
  Params: { "*": string };
}

export function routesInbox(contexte: Contexte): FastifyPluginAsync {
  return async (app) => {
    const creations = () => contexte.config.creations;
    const ffprobe = () => contexte.config.binaires.ffprobe;

    app.get("/inbox", async (): Promise<ReponseInbox> => listerInbox(creations(), ffprobe()));

    app.post("/inbox", async (requete): Promise<ReponseEnvoiInbox> => {
      const fichier = await requete.file({ limits: { fileSize: Number.MAX_SAFE_INTEGER, files: 1 } });
      if (fichier === undefined) {
        throw new ErreurHttp(400, "Aucun fichier reçu.");
      }
      const longueur = Number(requete.headers["content-length"]);
      try {
        return {
          fichier: await enregistrerDansInbox(
            creations(),
            ffprobe(),
            fichier.filename,
            fichier.file,
            Number.isFinite(longueur) ? longueur : null,
          ),
        };
      } catch (erreur) {
        fichier.file.resume();
        throw erreur;
      }
    });

    app.delete<ParametresFichier>("/inbox/fichiers/*", async (requete): Promise<{ corbeille: string }> => ({
      corbeille: await mettreInboxALaCorbeille(creations(), requete.params["*"]),
    }));
  };
}
