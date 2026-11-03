import type { ReponseLancementTranscriptions, ReponseTranscriptions, Transcription } from "@editeur/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { Contexte } from "../contexte.ts";
import { corrigerTranscription, lancerTranscriptions, lireTranscription, listerTranscriptions } from "../projets/transcriptions.ts";
import type { FileDeTaches } from "../taches/file.ts";

interface ParametresId {
  Params: { id: string };
}

interface ParametresFichier {
  Params: { id: string; "*": string };
}

const schemaLancement = z.object({ fichiers: z.array(z.string()).nullable() });
const schemaCorrections = z.object({
  corrections: z.array(z.object({ debut: z.number(), texte: z.string().max(5000).nullable() })).min(1),
});

export function routesTranscriptions(contexte: Contexte, file: FileDeTaches): FastifyPluginAsync {
  return async (app) => {
    const creations = () => contexte.config.creations;

    app.get<ParametresId>("/projets/:id/transcriptions", async (requete): Promise<ReponseTranscriptions> =>
      listerTranscriptions(creations(), requete.params.id),
    );

    app.get<ParametresFichier>("/projets/:id/transcriptions/*", async (requete): Promise<Transcription> =>
      lireTranscription(creations(), requete.params.id, requete.params["*"]),
    );

    app.put<ParametresFichier>("/projets/:id/transcriptions/*", async (requete): Promise<Transcription> =>
      corrigerTranscription(creations(), requete.params.id, requete.params["*"], schemaCorrections.parse(requete.body).corrections),
    );

    app.post<ParametresId>("/projets/:id/transcriptions", async (requete, reponse): Promise<ReponseLancementTranscriptions> => {
      const { fichiers } = schemaLancement.parse(requete.body ?? { fichiers: null });
      reponse.code(202);
      return { ajoutees: await lancerTranscriptions(creations(), file, requete.params.id, fichiers) };
    });
  };
}
