import {
  schemaConfigMachine,
  schemaParametres,
  type ConfigMachine,
  type Parametres,
  type ReponseConfigMachine,
  type ReponseDiagnostic,
  type ResultatTestClaude,
} from "@editeur/shared";
import type { FastifyPluginAsync } from "fastify";
import { testerConnexionClaude } from "../claude/test-connexion.ts";
import { ecrireConfigMachine } from "../config.ts";
import type { Contexte } from "../contexte.ts";
import { initialiserCreations } from "../creations/initialisation.ts";
import { diagnostiquerBinaires } from "../diagnostic.ts";
import { ecrireParametres, lireParametres } from "../parametres.ts";

export function routesParametres(contexte: Contexte): FastifyPluginAsync {
  return async (app) => {
    app.get("/parametres", async (): Promise<Parametres> => lireParametres(contexte.config.creations));

    app.put("/parametres", async (requete): Promise<Parametres> => {
      const parametres = schemaParametres.parse(requete.body);
      await ecrireParametres(contexte.config.creations, parametres);
      return parametres;
    });

    app.get("/config-machine", async (): Promise<ConfigMachine> => contexte.config);

    app.put("/config-machine", async (requete): Promise<ReponseConfigMachine> => {
      const demandee = schemaConfigMachine.parse(requete.body);
      const config = await ecrireConfigMachine(contexte.racineDepot, demandee);
      const { crees } = await initialiserCreations(config.creations);
      contexte.config = config;
      return { config, crees };
    });

    app.get("/diagnostic", async (): Promise<ReponseDiagnostic> => ({
      binaires: await diagnostiquerBinaires(contexte.config.binaires),
    }));

    app.post("/diagnostic/claude", async (): Promise<ResultatTestClaude> => {
      const parametres = await lireParametres(contexte.config.creations);
      return testerConnexionClaude(contexte.config.binaires.claude, parametres.claude.modele);
    });
  };
}
