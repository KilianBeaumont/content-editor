import type { ReponseTaches, Tache } from "@editeur/shared";
import type { FastifyPluginAsync } from "fastify";
import type { FileDeTaches } from "../taches/file.ts";

interface ParametresId {
  Params: { id: string };
}

const BATTEMENT_MS = 25_000;

export function routesTaches(file: FileDeTaches): FastifyPluginAsync {
  return async (app) => {
    app.get("/taches", async (): Promise<ReponseTaches> => ({ taches: file.liste() }));

    app.get("/taches/flux", (requete, reponse) => {
      reponse.hijack();
      reponse.raw.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
      const desabonner = file.abonner((taches) => {
        const message: ReponseTaches = { taches };
        reponse.raw.write(`data: ${JSON.stringify(message)}\n\n`);
      });
      const battement = setInterval(() => reponse.raw.write(": battement\n\n"), BATTEMENT_MS);
      requete.raw.on("close", () => {
        desabonner();
        clearInterval(battement);
      });
    });

    app.post<ParametresId>("/taches/:id/annuler", async (requete): Promise<Tache> => file.annuler(requete.params.id));

    app.post<ParametresId>("/taches/:id/relancer", async (requete): Promise<Tache> => file.relancer(requete.params.id));

    app.delete("/taches/terminees", async (): Promise<ReponseTaches> => {
      file.oublierTerminees();
      return { taches: file.liste() };
    });
  };
}
