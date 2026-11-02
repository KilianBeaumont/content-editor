import { z } from "zod";

z.config(z.locales.fr());

export type { ReponseConfigMachine, ReponseErreur, ReponseSante } from "./api.ts";
export { CATEGORIES, LIBELLES_CATEGORIES, type Categorie } from "./categories.ts";
export {
  PARAMETRES_PAR_DEFAUT,
  schemaConfigMachine,
  schemaParametres,
  type BinairesMachine,
  type ConfigMachine,
  type Parametres,
  type PreReglageVideo,
} from "./config.ts";
export type {
  DiagnosticBinaire,
  FenetreLimite,
  LimitesClaude,
  NomBinaire,
  ReponseDiagnostic,
  ResultatTestClaude,
} from "./diagnostic.ts";
export { slug } from "./slug.ts";
