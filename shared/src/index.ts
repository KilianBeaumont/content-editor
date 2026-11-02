import { z } from "zod";

z.config(z.locales.fr());

export type { ReponseConfigMachine, ReponseErreur, ReponseSante } from "./api.ts";
export {
  EXTENSIONS_PREUVE,
  FICHE_ARTISTE_VIDE,
  schemaFicheArtiste,
  schemaSaisieArtiste,
  TAILLE_MAX_PREUVE,
  type AccordArtiste,
  type Artiste,
  type FicheArtiste,
  type ReponseListeArtistes,
  type SaisieArtiste,
  type StatutAccord,
} from "./artistes.ts";
export {
  FICHE_AUTEUR_VIDE,
  schemaFicheAuteur,
  schemaSaisieAuteur,
  type Auteur,
  type FicheAuteur,
  type ReponseListeAuteurs,
  type SaisieAuteur,
} from "./auteurs.ts";
export type { FicheIllisible } from "./fiches.ts";
export {
  ASSET_PAR_DEFAUT,
  CHAINES_BIBLIOTHEQUE,
  EXTENSIONS_AUDIO,
  EXTENSIONS_BIBLIOTHEQUE,
  EXTENSIONS_IMAGE,
  EXTENSIONS_POLICE,
  EXTENSIONS_VIDEO,
  LANGUES_ASSET,
  LIBELLES_CHAINES_BIBLIOTHEQUE,
  LIBELLES_LANGUES,
  LIBELLES_SOURCES_ASSET,
  schemaAssetBibliotheque,
  schemaNouvelAsset,
  schemaSaisieAsset,
  SOURCES_ASSET,
  TAILLE_MAX_ASSET,
  TYPES,
  TYPES_ASSET,
  type AssetBibliotheque,
  type ChaineBibliotheque,
  type ElementBibliotheque,
  type EntreeInvalide,
  type LangueAsset,
  type NouvelAsset,
  type ReponseBibliotheque,
  type ReponseTeleversementAsset,
  type SaisieAsset,
  type SourceAsset,
  type StatutAsset,
  type TypeAsset,
} from "./bibliotheque.ts";
export { CATEGORIES,LIBELLES_CATEGORIES, type Categorie } from "./categories.ts";
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
