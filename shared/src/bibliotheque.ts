import { z } from "zod";

export const CHAINES_BIBLIOTHEQUE = ["commun", "creation", "recits"] as const;
export type ChaineBibliotheque = (typeof CHAINES_BIBLIOTHEQUE)[number];

export const TYPES_ASSET = ["police", "image", "video", "musique", "ambiance", "son", "voix"] as const;
export type TypeAsset = (typeof TYPES_ASSET)[number];

export const SOURCES_ASSET = ["utilisateur", "artiste", "externe"] as const;
export type SourceAsset = (typeof SOURCES_ASSET)[number];

export const LANGUES_ASSET = ["fr", "en"] as const;
export type LangueAsset = (typeof LANGUES_ASSET)[number];

export const EXTENSIONS_IMAGE = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"] as const;
export const EXTENSIONS_AUDIO = [".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac"] as const;
export const EXTENSIONS_VIDEO = [".mp4", ".mov", ".webm", ".mkv"] as const;
export const EXTENSIONS_POLICE = [".ttf", ".otf", ".woff", ".woff2"] as const;

interface DefinitionType {
  libelle: string;
  dossier: string;
  aide: string;
  extensions: readonly string[];
  langue: "obligatoire" | "facultative" | "sans";
}

export const TYPES: Record<TypeAsset, DefinitionType> = {
  police: {
    libelle: "Police",
    dossier: "polices",
    aide: "Polices de l'identité graphique.",
    extensions: EXTENSIONS_POLICE,
    langue: "sans",
  },
  image: {
    libelle: "Image",
    dossier: "images",
    aide: "Logos, illustrations, fonds, modèles de miniatures.",
    extensions: EXTENSIONS_IMAGE,
    langue: "facultative",
  },
  video: {
    libelle: "Vidéo",
    dossier: "videos",
    aide: "Génériques, transitions, animations.",
    extensions: EXTENSIONS_VIDEO,
    langue: "facultative",
  },
  musique: {
    libelle: "Musique",
    dossier: "musiques",
    aide: "Musiques de fond ou de générique.",
    extensions: EXTENSIONS_AUDIO,
    langue: "sans",
  },
  ambiance: {
    libelle: "Ambiance sonore",
    dossier: "ambiances",
    aide: "Pluie, vent, taverne, forêt : en boucle sous la narration.",
    extensions: EXTENSIONS_AUDIO,
    langue: "sans",
  },
  son: {
    libelle: "Son ponctuel",
    dossier: "sons",
    aide: "Bruitages courts utilisés de temps en temps : whoosh, pop, impact.",
    extensions: EXTENSIONS_AUDIO,
    langue: "sans",
  },
  voix: {
    libelle: "Voix",
    dossier: "voix",
    aide: "Phrases enregistrées qui reviennent d'une vidéo à l'autre : intro, outro, « abonne-toi ».",
    extensions: EXTENSIONS_AUDIO,
    langue: "obligatoire",
  },
};

export const EXTENSIONS_BIBLIOTHEQUE: readonly string[] = [
  ...EXTENSIONS_IMAGE,
  ...EXTENSIONS_AUDIO,
  ...EXTENSIONS_VIDEO,
  ...EXTENSIONS_POLICE,
];

export const LIBELLES_CHAINES_BIBLIOTHEQUE: Record<ChaineBibliotheque, string> = {
  commun: "Commun aux deux chaînes",
  creation: "Création",
  recits: "Récits",
};

export const LIBELLES_SOURCES_ASSET: Record<SourceAsset, string> = {
  utilisateur: "Moi",
  artiste: "Un artiste",
  externe: "Source externe (banque de sons, musique libre…)",
};

export const LIBELLES_LANGUES: Record<LangueAsset, string> = {
  fr: "Français",
  en: "Anglais",
};

export const TAILLE_MAX_ASSET = 4 * 1024 * 1024 * 1024;

export interface AssetBibliotheque {
  id: string;
  type: TypeAsset;
  chaine: ChaineBibliotheque;
  chemin: string;
  description: string;
  etiquettes: string[];
  langue: LangueAsset | null;
  source: SourceAsset;
  artiste: string | null;
  licence: string;
  utilisations: string[];
}

export interface SaisieAsset {
  description: string;
  etiquettes: string[];
  langue: LangueAsset | null;
  source: SourceAsset;
  artiste: string | null;
  licence: string;
}

export interface NouvelAsset extends SaisieAsset {
  chemin: string;
}

export interface StatutAsset {
  valide: boolean;
  problemes: string[];
}

export interface ElementBibliotheque {
  asset: AssetBibliotheque;
  statut: StatutAsset;
}

export interface EntreeInvalide {
  position: number;
  id: string | null;
  erreur: string;
}

export interface ReponseBibliotheque {
  elements: ElementBibliotheque[];
  invalides: EntreeInvalide[];
  nonCatalogues: string[];
}

export interface ReponseTeleversementAsset {
  chemin: string;
}

const MOTIF_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const schemaSaisieAsset = z.object({
  description: z.string().trim().max(1000),
  etiquettes: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(30),
  langue: z.enum(LANGUES_ASSET).nullable(),
  source: z.enum(SOURCES_ASSET),
  artiste: z.string().regex(MOTIF_ID).nullable(),
  licence: z.string().trim().max(1000),
}) satisfies z.ZodType<SaisieAsset>;

export const schemaNouvelAsset = schemaSaisieAsset.extend({
  chemin: z.string().min(1).max(500),
}) satisfies z.ZodType<NouvelAsset>;

export const schemaAssetBibliotheque = z.object({
  id: z.string().regex(MOTIF_ID, "Identifiant non conforme : minuscules sans accents, mots séparés par des tirets."),
  type: z.enum(TYPES_ASSET),
  chaine: z.enum(CHAINES_BIBLIOTHEQUE),
  chemin: z.string().min(1),
  description: z.string(),
  etiquettes: z.array(z.string()),
  langue: z.enum(LANGUES_ASSET).nullable(),
  source: z.enum(SOURCES_ASSET),
  artiste: z.string().nullable(),
  licence: z.string(),
  utilisations: z.array(z.string()),
}) satisfies z.ZodType<AssetBibliotheque>;

export const ASSET_PAR_DEFAUT: Omit<AssetBibliotheque, "id" | "type" | "chaine" | "chemin"> = {
  description: "",
  etiquettes: [],
  langue: null,
  source: "utilisateur",
  artiste: null,
  licence: "",
  utilisations: [],
};
