import { existsSync } from "node:fs";
import { join } from "node:path";
import fastifyStatic from "@fastify/static";
import type { ReponseErreur } from "@editeur/shared";
import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import type { Contexte } from "./contexte.ts";
import { CheminInterditError, FichierInvalideError } from "./fichiers.ts";
import { routesParametres } from "./routes/parametres.ts";
import { routesSante } from "./routes/sante.ts";

export interface OptionsApp {
  contexte: Contexte;
  dossierInterface?: string;
}

function erreur(message: string): ReponseErreur {
  return { erreur: message };
}

function codeHttp(err: unknown): number | undefined {
  if (typeof err === "object" && err !== null && "statusCode" in err && typeof err.statusCode === "number") {
    return err.statusCode;
  }
  return undefined;
}

export async function creerApp(options: OptionsApp): Promise<FastifyInstance> {
  const app = Fastify();

  app.setErrorHandler((err, _requete, reponse) => {
    if (err instanceof z.ZodError) {
      return reponse.code(400).send(erreur(`Données invalides :\n${z.prettifyError(err)}`));
    }
    if (err instanceof CheminInterditError) {
      return reponse.code(400).send(erreur(err.message));
    }
    if (err instanceof FichierInvalideError) {
      return reponse.code(500).send(erreur(err.message));
    }
    const statut = codeHttp(err);
    if (statut !== undefined && statut < 500) {
      return reponse.code(statut).send(erreur(err instanceof Error ? err.message : "Requête invalide"));
    }
    console.error(err);
    const message = err instanceof Error ? err.message : String(err);
    return reponse.code(500).send(erreur(`Erreur interne : ${message}`));
  });

  await app.register(routesSante, { prefix: "/api" });
  await app.register(routesParametres(options.contexte), { prefix: "/api" });

  const dossier = options.dossierInterface;
  const servirInterface = dossier !== undefined && existsSync(join(dossier, "index.html"));
  if (servirInterface) {
    await app.register(fastifyStatic, { root: dossier });
  }

  app.setNotFoundHandler((requete, reponse) => {
    if (servirInterface && requete.method === "GET" && !requete.url.startsWith("/api/")) {
      return reponse.sendFile("index.html");
    }
    return reponse.code(404).send(erreur("Introuvable"));
  });

  return app;
}
