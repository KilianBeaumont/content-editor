import type { ReponseSante } from "@editeur/shared";
import type { FastifyPluginAsync } from "fastify";

export const routesSante: FastifyPluginAsync = async (app) => {
  app.get("/sante", async (): Promise<ReponseSante> => ({ ok: true }));
};
