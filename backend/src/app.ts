import { existsSync } from "node:fs";
import { join } from "node:path";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import type { ReponseErreur } from "@editeur/shared";
import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import type { Contexte } from "./contexte.ts";
import { codeErreur, ErreurHttp } from "./erreurs.ts";
import { CheminInterditError, FichierInvalideError } from "./fichiers.ts";
import { routesArtistes } from "./routes/artistes.ts";
import { routesAuteurs } from "./routes/auteurs.ts";
import { routesBibliotheque } from "./routes/bibliotheque.ts";
import { routesInbox } from "./routes/inbox.ts";
import { routesProjets } from "./routes/projets.ts";
import { routesTaches } from "./routes/taches.ts";
import { routesTranscriptions } from "./routes/transcriptions.ts";
import { routesWhisper } from "./routes/whisper.ts";
import { executeurs } from "./taches/executeurs.ts";
import { FileDeTaches } from "./taches/file.ts";
import { routesFichiers } from "./routes/fichiers.ts";
import { routesParametres } from "./routes/parametres.ts";
import { routesExports } from "./routes/exports.ts";
import { routesPlans } from "./routes/plans.ts";
import { routesRushes } from "./routes/rushes.ts";
import { routesSante } from "./routes/sante.ts";

export interface OptionsApp {
  contexte: Contexte;
  dossierInterface?: string;
}

const MESSAGES_FASTIFY: Record<string, string> = {
  FST_REQ_FILE_TOO_LARGE: "Fichier trop volumineux.",
  FST_INVALID_MULTIPART_CONTENT_TYPE: "La requête doit contenir un fichier.",
  FST_ERR_CTP_INVALID_MEDIA_TYPE: "Type de contenu non pris en charge.",
  FST_ERR_CTP_EMPTY_JSON_BODY: "Le corps JSON est vide.",
  FST_ERR_CTP_INVALID_JSON_BODY: "Le corps de la requête n'est pas un JSON valide.",
};

const CODES_ENVOI_INTERROMPU = new Set(["ECONNRESET", "FST_MP_PREMATURE_CLOSE"]);

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
  const app = Fastify({ forceCloseConnections: true });
  const { contexte } = options;
  const taches = new FileDeTaches(() => join(contexte.config.creations, "taches.json"), executeurs(contexte));
  await taches.charger();

  app.setErrorHandler((err, _requete, reponse) => {
    if (err instanceof ErreurHttp) {
      return reponse.code(err.statut).send(erreur(err.message));
    }
    if (err instanceof z.ZodError) {
      return reponse.code(400).send(erreur(`Données invalides :\n${z.prettifyError(err)}`));
    }
    if (err instanceof CheminInterditError) {
      return reponse.code(400).send(erreur(err.message));
    }
    if (err instanceof FichierInvalideError) {
      return reponse.code(500).send(erreur(err.message));
    }
    if (CODES_ENVOI_INTERROMPU.has(codeErreur(err) ?? "")) {
      console.warn("Envoi interrompu : le navigateur a coupé la connexion (page fermée ou rechargée, ou envoi annulé).");
      return reponse.code(400).send(erreur("Envoi interrompu."));
    }
    const statut = codeHttp(err);
    if (statut !== undefined && statut < 500) {
      const message = MESSAGES_FASTIFY[codeErreur(err) ?? ""] ?? (err instanceof Error ? err.message : "Requête invalide");
      return reponse.code(statut).send(erreur(message));
    }
    console.error(err);
    return reponse.code(500).send(erreur(`Erreur interne : ${err instanceof Error ? err.message : String(err)}`));
  });

  await app.register(fastifyMultipart);

  const dossier = options.dossierInterface;
  const servirInterface = dossier !== undefined && existsSync(join(dossier, "index.html"));
  await app.register(fastifyStatic, {
    root: servirInterface ? dossier : options.contexte.config.creations,
    serve: servirInterface,
    wildcard: false,
  });

  await app.register(routesSante, { prefix: "/api" });
  await app.register(routesParametres(options.contexte), { prefix: "/api" });
  await app.register(routesArtistes(options.contexte), { prefix: "/api" });
  await app.register(routesAuteurs(options.contexte), { prefix: "/api" });
  await app.register(routesBibliotheque(options.contexte), { prefix: "/api" });
  await app.register(routesInbox(options.contexte), { prefix: "/api" });
  await app.register(routesProjets(options.contexte), { prefix: "/api" });
  await app.register(routesTaches(taches), { prefix: "/api" });
  await app.register(routesTranscriptions(options.contexte, taches), { prefix: "/api" });
  await app.register(routesWhisper(options.contexte, taches), { prefix: "/api" });
  await app.register(routesPlans(options.contexte, taches), { prefix: "/api" });
  await app.register(routesExports(options.contexte, taches), { prefix: "/api" });
  await app.register(routesRushes(options.contexte, taches), { prefix: "/api" });
  await app.register(routesFichiers(options.contexte), { prefix: "/api" });

  app.setNotFoundHandler(async (requete, reponse) => {
    if (servirInterface && requete.method === "GET" && !requete.url.startsWith("/api/")) {
      return reponse.sendFile("index.html");
    }
    return reponse.code(404).send(erreur("Introuvable"));
  });

  return app;
}
