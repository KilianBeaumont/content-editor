import { z } from "zod";
import { CATEGORIES, type Categorie } from "./categories.ts";
import type { FichierMedia } from "./inbox.ts";

export const CHAINES = ["creation", "recits"] as const;
export type Chaine = (typeof CHAINES)[number];

export const LIBELLES_CHAINES: Record<Chaine, string> = {
  creation: "Création",
  recits: "Récits",
};

export const DOSSIERS_CHAINES: Record<Chaine, string> = {
  creation: "chaine-creation",
  recits: "chaine-recits",
};

export const CATEGORIES_PAR_CHAINE: Record<Chaine, readonly Categorie[]> = {
  creation: ["vlog", "court", "micro-histoire", "timelapse"],
  recits: ["recit", "court", "micro-histoire", "extrait-recit", "podcast"],
};

export const SORTIES = ["youtube", "formats-courts", "instagram", "youtube-piste-en", "podcast-fr", "podcast-en"] as const;
export type Sortie = (typeof SORTIES)[number];

interface DefinitionSortie {
  libelle: string;
  aide: string;
  chaines: readonly Chaine[];
  anglais: boolean;
}

export const DEFINITIONS_SORTIES: Record<Sortie, DefinitionSortie> = {
  youtube: { libelle: "YouTube", aide: "Vidéo longue 16:9", chaines: CHAINES, anglais: false },
  "formats-courts": { libelle: "Formats courts", aide: "9:16 pour TikTok, Reels et Shorts", chaines: CHAINES, anglais: false },
  instagram: { libelle: "Instagram", aide: "Post ou carrousel 4:5", chaines: CHAINES, anglais: false },
  "youtube-piste-en": {
    libelle: "Piste audio EN",
    aide: "MP3 à ajouter comme piste anglaise dans YouTube Studio",
    chaines: ["recits"],
    anglais: true,
  },
  "podcast-fr": { libelle: "Podcast FR", aide: "MP3 de l'épisode en français", chaines: ["recits"], anglais: false },
  "podcast-en": { libelle: "Podcast EN", aide: "MP3 de l'épisode en anglais", chaines: ["recits"], anglais: true },
};

export const SORTIES_PAR_DEFAUT: Record<Categorie, readonly Sortie[]> = {
  vlog: ["youtube", "formats-courts"],
  recit: ["youtube", "youtube-piste-en", "podcast-fr", "podcast-en", "formats-courts"],
  court: ["formats-courts"],
  "micro-histoire": ["formats-courts"],
  "extrait-recit": ["formats-courts"],
  timelapse: ["formats-courts"],
  podcast: ["podcast-fr", "podcast-en"],
};

export const PLATEFORMES_AUTORISATION = ["youtube", "spotify", "deezer", "apple-podcasts", "tiktok", "instagram"] as const;
export type PlateformeAutorisation = (typeof PLATEFORMES_AUTORISATION)[number];

export const LIBELLES_PLATEFORMES: Record<PlateformeAutorisation, string> = {
  youtube: "YouTube",
  spotify: "Spotify",
  deezer: "Deezer",
  "apple-podcasts": "Apple Podcasts",
  tiktok: "TikTok",
  instagram: "Instagram",
};

export function destinationsPossibles(chaine: Chaine, anglais: boolean, artistes: readonly string[]): string[] {
  const destinations = ["rushes", "assets", "texte"];
  if (chaine === "recits") {
    destinations.splice(1, 0, "voix/fr", ...(anglais ? ["voix/en"] : []));
  }
  return [...destinations, ...artistes.map((artiste) => `assets/${artiste}`)];
}

export interface Consignes {
  intention: string;
  dureeViseeMinutes: number | null;
  aGarder: string;
  aEviter: string;
}

export interface AuteurProjet {
  id: string | null;
  nom: string;
  source: string;
  estUtilisateur: boolean;
}

export interface SaisieAutorisation {
  obtenue: boolean;
  date: string | null;
  lecture: boolean;
  traductionAnglaise: boolean;
  monetisation: boolean;
  plateformes: PlateformeAutorisation[];
}

export interface AutorisationProjet extends SaisieAutorisation {
  preuve: string | null;
}

export interface FichierChoisi {
  chemin: string;
  destination: string;
  note: string;
}

export interface FichierProjet {
  chemin: string;
  origine: string;
  note: string;
}

export interface SaisieProjet {
  chaine: Chaine;
  categorie: Categorie;
  titre: { fr: string; en: string | null };
  datePublicationPrevue: string;
  anglais: boolean;
  sorties: Sortie[];
  nombreFormatsCourts: number | null;
  consignes: Consignes;
  fichiers: FichierChoisi[];
  auteur: AuteurProjet | null;
  autorisation: SaisieAutorisation | null;
  artistes: string[];
  assetsBibliotheque: string[];
  futurRoman: boolean;
  vocabulaire: string;
}

export interface MetadataProjet {
  categorie: Categorie;
  chaine: Chaine;
  titre: { fr: string; en: string | null };
  description: { fr: string; en: string };
  auteur: AuteurProjet | null;
  autorisation: AutorisationProjet | null;
  artistes: string[];
  assetsBibliotheque: string[];
  langues: string[];
  sorties: Sortie[];
  nombreFormatsCourts: number | null;
  consignes: Consignes;
  fichiers: FichierProjet[];
  versionValidee: string | null;
  datePublicationPrevue: string;
  sessionClaude: string | null;
  creeLe: string;
  futurRoman: boolean;
  vocabulaire: string;
  parent: string | null;
}

export interface Projet {
  id: string;
  chemin: string;
  metadata: MetadataProjet;
}

export interface ReponseCreationProjet {
  projet: Projet;
  avertissements: string[];
}

const texte = (max: number) => z.string().trim().max(max);

const schemaConsignes = z.object({
  intention: texte(4000),
  dureeViseeMinutes: z.number().positive().max(600).nullable(),
  aGarder: texte(4000),
  aEviter: texte(4000),
}) satisfies z.ZodType<Consignes>;

const schemaAuteur = z.object({
  id: z.string().nullable(),
  nom: texte(100),
  source: z.union([z.literal(""), z.url({ protocol: /^https?$/ })]),
  estUtilisateur: z.boolean(),
}) satisfies z.ZodType<AuteurProjet>;

const schemaSaisieAutorisation = z.object({
  obtenue: z.boolean(),
  date: z.iso.date().nullable(),
  lecture: z.boolean(),
  traductionAnglaise: z.boolean(),
  monetisation: z.boolean(),
  plateformes: z.array(z.enum(PLATEFORMES_AUTORISATION)),
}) satisfies z.ZodType<SaisieAutorisation>;

export const schemaSaisieProjet = z.object({
  chaine: z.enum(CHAINES),
  categorie: z.enum(CATEGORIES),
  titre: z.object({ fr: texte(150).min(1), en: texte(150).nullable() }),
  datePublicationPrevue: z.iso.date(),
  anglais: z.boolean(),
  sorties: z.array(z.enum(SORTIES)).min(1, "Choisis au moins une sortie."),
  nombreFormatsCourts: z.number().int().min(1).max(20).nullable(),
  consignes: schemaConsignes,
  fichiers: z.array(
    z.object({ chemin: z.string().min(1), destination: z.string().min(1), note: texte(1000) }),
  ),
  auteur: schemaAuteur.nullable(),
  autorisation: schemaSaisieAutorisation.nullable(),
  artistes: z.array(z.string()),
  assetsBibliotheque: z.array(z.string()),
  futurRoman: z.boolean(),
  vocabulaire: texte(2000),
}) satisfies z.ZodType<SaisieProjet>;

export const schemaMetadataProjet = z.object({
  categorie: z.enum(CATEGORIES),
  chaine: z.enum(CHAINES),
  titre: z.object({ fr: z.string(), en: z.string().nullable() }),
  description: z.object({ fr: z.string(), en: z.string() }),
  auteur: schemaAuteur.extend({ source: z.string() }).nullable(),
  autorisation: schemaSaisieAutorisation.extend({ preuve: z.string().nullable() }).nullable(),
  artistes: z.array(z.string()),
  assetsBibliotheque: z.array(z.string()),
  langues: z.array(z.string()),
  sorties: z.array(z.enum(SORTIES)),
  nombreFormatsCourts: z.number().nullable(),
  consignes: schemaConsignes,
  fichiers: z.array(z.object({ chemin: z.string(), origine: z.string(), note: z.string() })),
  versionValidee: z.string().nullable(),
  datePublicationPrevue: z.iso.date(),
  sessionClaude: z.string().nullable(),
  creeLe: z.string(),
  futurRoman: z.boolean(),
  vocabulaire: z.string(),
  parent: z.string().nullable(),
}) satisfies z.ZodType<MetadataProjet>;

export const PLATEFORMES_PAR_SORTIE: Record<Sortie, readonly PlateformeAutorisation[]> = {
  youtube: ["youtube"],
  "youtube-piste-en": ["youtube"],
  "formats-courts": ["tiktok", "instagram", "youtube"],
  instagram: ["instagram"],
  "podcast-fr": ["spotify", "deezer", "apple-podcasts"],
  "podcast-en": ["spotify", "deezer", "apple-podcasts"],
};

export interface ProblemeExport {
  niveau: "blocage" | "avertissement";
  message: string;
  sorties: Sortie[];
}

export interface VerificationExport {
  exportable: boolean;
  sortiesBloquees: Sortie[];
  problemes: ProblemeExport[];
}

export const ETAPES_PROJET = ["fichiers", "analyse", "plan", "apercu", "valide", "exporte"] as const;
export type EtapeProjet = (typeof ETAPES_PROJET)[number];

export const LIBELLES_ETAPES: Record<EtapeProjet, string> = {
  fichiers: "Fichiers rangés",
  analyse: "Analysé",
  plan: "Plan proposé",
  apercu: "Aperçu prêt",
  valide: "Validé",
  exporte: "Exporté",
};

export interface ResumeProjet {
  id: string;
  chemin: string;
  chaine: Chaine;
  categorie: Categorie;
  titre: { fr: string; en: string | null };
  datePublicationPrevue: string;
  etape: EtapeProjet;
  sorties: Sortie[];
  nombreFichiers: number;
}

export interface ProjetIllisible {
  chemin: string;
  erreur: string;
}

export interface ReponseListeProjets {
  projets: ResumeProjet[];
  illisibles: ProjetIllisible[];
}

export interface DetailProjet extends Projet {
  etape: EtapeProjet;
}

export interface ReponseFichiersProjet {
  fichiers: FichierMedia[];
  ffprobeDisponible: boolean;
}

export interface ModificationProjet extends Omit<SaisieProjet, "chaine" | "fichiers"> {
  description: { fr: string; en: string };
  notes: Record<string, string>;
}

export interface ReponseModificationProjet {
  projet: Projet;
  avertissements: string[];
}

export const schemaModificationProjet = schemaSaisieProjet.omit({ chaine: true, fichiers: true }).extend({
  description: z.object({ fr: texte(5000), en: texte(5000) }),
  notes: z.record(z.string(), texte(1000)),
}) satisfies z.ZodType<ModificationProjet>;

export const schemaAjoutFichiers = z.object({
  fichiers: schemaSaisieProjet.shape.fichiers.min(1, "Choisis au moins un fichier."),
});
