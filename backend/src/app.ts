import { existsSync } from "node:fs";
import { join } from "node:path";
import fastifyStatic from "@fastify/static";
import type { ReponseErreur } from "@editeur/shared";
import Fastify, { type FastifyInstance } from "fastify";
import { routesSante } from "./routes/sante.ts";

export interface OptionsApp {
  dossierInterface?: string;
}

export async function creerApp(options: OptionsApp = {}): Promise<FastifyInstance> {
  const app = Fastify();

  await app.register(routesSante, { prefix: "/api" });

  const dossier = options.dossierInterface;
  const servirInterface = dossier !== undefined && existsSync(join(dossier, "index.html"));
  if (servirInterface) {
    await app.register(fastifyStatic, { root: dossier });
  }

  app.setNotFoundHandler((requete, reponse) => {
    if (servirInterface && requete.method === "GET" && !requete.url.startsWith("/api/")) {
      return reponse.sendFile("index.html");
    }
    const erreur: ReponseErreur = { erreur: "Introuvable" };
    return reponse.code(404).send(erreur);
  });

  return app;
}
