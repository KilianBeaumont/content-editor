import { z } from "zod";

z.config(z.locales.fr());

export type { ReponseErreur, ReponseSante } from "./api.ts";
export { CATEGORIES, LIBELLES_CATEGORIES, type Categorie } from "./categories.ts";
export {
  PARAMETRES_PAR_DEFAUT,
  schemaConfigMachine,
  type BinairesMachine,
  type ConfigMachine,
  type Parametres,
  type PreReglageVideo,
} from "./config.ts";
export { slug } from "./slug.ts";
