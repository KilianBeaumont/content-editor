import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { creerApp } from "./app.ts";
import { CONFIG_PAR_DEFAUT } from "./config.ts";
import type { Contexte } from "./contexte.ts";
import { initialiserCreations } from "./creations/initialisation.ts";

export interface EnvironnementTest {
  dossier: string;
  contexte: Contexte;
  app: FastifyInstance;
  nettoyer: () => Promise<void>;
}

export async function preparerEnvironnementTest(dossierInterface?: string): Promise<EnvironnementTest> {
  const dossier = await mkdtemp(join(tmpdir(), "editeur-test-"));
  const contexte: Contexte = {
    racineDepot: join(dossier, "depot"),
    config: { ...CONFIG_PAR_DEFAUT, creations: join(dossier, "creations") },
  };
  await mkdir(contexte.racineDepot);
  await initialiserCreations(contexte.config.creations);
  const app = await creerApp({ contexte, dossierInterface });
  return {
    dossier,
    contexte,
    app,
    nettoyer: async () => {
      await app.close();
      await rm(dossier, { recursive: true, force: true });
    },
  };
}
