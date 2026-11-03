import { z } from "zod";

export const ORIGINES_MUSIQUE = ["projet", "bibliotheque"] as const;
export type OrigineMusique = (typeof ORIGINES_MUSIQUE)[number];

export const STATUTS_PLAN = ["propose", "valide"] as const;
export type StatutPlan = (typeof STATUTS_PLAN)[number];

export const MODES_CADRAGE = ["recadre", "fond-flou"] as const;
export type ModeCadrage = (typeof MODES_CADRAGE)[number];

export interface EtatCadre {
  x: number;
  y: number;
  zoom: number;
}

export interface Cadrage {
  mode: ModeCadrage;
  debut: EtatCadre;
  fin: EtatCadre | null;
}

export interface Rectangle {
  gauche: number;
  haut: number;
  largeur: number;
  hauteur: number;
}

export function rectangleCadre(ratioSource: number, ratioSortie: number, etat: EtatCadre): Rectangle {
  const base = ratioSource > ratioSortie ? { largeur: ratioSortie / ratioSource, hauteur: 1 } : { largeur: 1, hauteur: ratioSource / ratioSortie };
  const largeur = base.largeur / etat.zoom;
  const hauteur = base.hauteur / etat.zoom;
  return {
    gauche: Math.min(1 - largeur, Math.max(0, etat.x - largeur / 2)),
    haut: Math.min(1 - hauteur, Math.max(0, etat.y - hauteur / 2)),
    largeur,
    hauteur,
  };
}

export const TRANSITIONS = ["coupe", "flash", "fondu"] as const;
export type Transition = (typeof TRANSITIONS)[number];

export const POSITIONS_TEXTE = ["haut", "centre", "bas"] as const;
export type PositionTexte = (typeof POSITIONS_TEXTE)[number];

export const APPARITIONS_TEXTE = ["pop", "fondu", "aucune"] as const;
export type ApparitionTexte = (typeof APPARITIONS_TEXTE)[number];

export interface TexteEcran {
  texte: string;
  debut: number;
  fin: number;
  position: PositionTexte;
  taillePourcent: number;
  couleur: string | null;
  apparition: ApparitionTexte;
}

export interface Bruitage {
  origine: OrigineMusique;
  reference: string;
  position: number;
  volumeDb: number;
  raison: string;
}

export interface SegmentPlan {
  id: string;
  source: string;
  debut: number;
  fin: number;
  role: string;
  citation: string;
  raison: string;
  decalageImage: number;
  cadrage: Cadrage | null;
  transition: Transition;
}

export interface PlanDeCoupe {
  source: string;
  debut: number;
  fin: number;
  position: number;
  raison: string;
  cadrage: Cadrage | null;
}

export interface MusiquePlan {
  origine: OrigineMusique;
  reference: string;
  debut: number;
  fin: number | null;
  volumeDb: number;
  baisseSousVoix: boolean;
  raison: string;
}

export interface ReponseRetour {
  commentaire: number;
  changement: string;
}

export interface PropositionPlan {
  resume: string;
  hook: { segment: string; explication: string };
  segments: SegmentPlan[];
  plansDeCoupe: PlanDeCoupe[];
  musiques: MusiquePlan[];
  bruitages: Bruitage[];
  textes: TexteEcran[];
  sousTitres: boolean;
  pointsAVerifier: string[];
  reponsesRetours: ReponseRetour[];
}

export interface PlanMontage extends PropositionPlan {
  version: string;
  statut: StatutPlan;
  creeLe: string;
  modifieLe: string | null;
}

export const TEXTE_PAR_DEFAUT: Omit<TexteEcran, "texte" | "debut" | "fin"> = { position: "haut", taillePourcent: 10, couleur: null, apparition: "pop" };

export interface ProblemePlan {
  niveau: "erreur" | "avertissement";
  message: string;
  segment: string | null;
}

export interface RenduApercu {
  version: string;
  fichier: string;
  creeLe: string;
  largeur: number;
  hauteur: number;
  dureePlan: number;
  duree: number | null;
  dureeRenduSecondes: number;
  controles: string[];
}

export interface VersionPlan {
  version: string;
  plan: PlanMontage | null;
  erreur: string | null;
  problemes: ProblemePlan[];
  apercu: boolean;
  rendu: RenduApercu | null;
}

export interface ReponsePlans {
  versions: VersionPlan[];
}

export interface PlageImage {
  debut: number;
  fin: number;
}

export function plagesImage(segments: Pick<SegmentPlan, "debut" | "fin" | "decalageImage">[]): PlageImage[] {
  return segments.map((segment, index) => ({
    debut: segment.debut + (index === 0 ? 0 : segment.decalageImage),
    fin: segment.fin + (segments[index + 1]?.decalageImage ?? 0),
  }));
}

export interface SaisiePropositionPlan {
  consigne: string;
  depuis: string | null;
}

export interface CommentaireRetour {
  id: string;
  temps: number | null;
  texte: string;
  traite: boolean;
  traiteDans: string | null;
  reponse: string | null;
  creeLe: string;
}

export interface RetoursVersion {
  version: string;
  commentaires: CommentaireRetour[];
}

export interface SaisieCommentaire {
  temps: number | null;
  texte: string;
}

export interface ModificationCommentaire {
  texte: string;
  traite: boolean;
}

export function cheminRetours(version: string): string {
  return `versions/${version}/retours.json`;
}

export interface Situation {
  segment: string;
  tempsSource: number;
  source: string;
}

export function situer(segments: Pick<SegmentPlan, "id" | "source" | "debut" | "fin">[], temps: number): Situation | null {
  let depart = 0;
  for (const segment of segments) {
    const duree = segment.fin - segment.debut;
    if (temps < depart + duree) return { segment: segment.id, source: segment.source, tempsSource: segment.debut + Math.max(0, temps - depart) };
    depart += duree;
  }
  const dernier = segments.at(-1);
  return dernier === undefined ? null : { segment: dernier.id, source: dernier.source, tempsSource: dernier.fin };
}

export const MOTIF_VERSION = /^v[1-9]\d*$/;

export function cheminPlan(version: string): string {
  return `versions/${version}/plan.json`;
}

export function cheminApercu(version: string): string {
  return `versions/${version}/apercu.mp4`;
}

export function cheminRendu(version: string): string {
  return `versions/${version}/rendu.json`;
}

export function numeroVersion(version: string): number {
  return Number(version.slice(1));
}

export function dureePlan(plan: Pick<PropositionPlan, "segments">): number {
  return plan.segments.reduce((total, segment) => total + Math.max(0, segment.fin - segment.debut), 0);
}

const texte = (max: number) => z.string().max(max);

const schemaEtatCadre = z.object({
  x: z.number().min(0).max(1).describe("Centre horizontal de la fenêtre dans l'image source : 0 bord gauche, 0,5 milieu, 1 bord droit."),
  y: z.number().min(0).max(1).describe("Centre vertical de la fenêtre : 0 haut, 0,5 milieu, 1 bas."),
  zoom: z.number().min(1).max(4).describe("1 : la plus grande fenêtre aux proportions de la vidéo finale ; 1,5 : 1,5 fois plus près ; jusqu'à 4."),
});

export const schemaCadrage = z
  .object({
    mode: z.enum(MODES_CADRAGE).describe("recadre : une fenêtre de l'image remplit l'écran ; fond-flou : l'image entière sur un fond flou (debut et fin ignorés)."),
    debut: schemaEtatCadre.describe("La fenêtre au début du segment."),
    fin: schemaEtatCadre.nullable().describe("La fenêtre à la fin du segment pour un mouvement progressif (zoom, panoramique), ou null pour un cadre fixe."),
  })
  .nullable()
  .default(null)
  .describe("Cadrage de l'image. null : l'image entière, avec des bandes noires si ses proportions diffèrent de la vidéo finale.");

export const schemaPropositionPlan = z.object({
  resume: texte(3000).describe("La stratégie de montage en quelques phrases, lisible par l'utilisateur."),
  hook: z.object({
    segment: z.string().describe("Identifiant du segment qui sert d'accroche (en général le premier)."),
    explication: texte(1000).describe("Pourquoi cette accroche retient le spectateur dès les premières secondes."),
  }),
  segments: z
    .array(
      z.object({
        id: z.string().regex(/^s\d+$/).describe("Identifiant unique : s1, s2, s3…"),
        source: z.string().min(1).describe("Chemin du rush, relatif au dossier du projet, par exemple rushes/clip.mp4."),
        debut: z.number().min(0).describe("Début dans le rush, en secondes."),
        fin: z.number().min(0).describe("Fin dans le rush, en secondes."),
        role: texte(60).describe("Rôle dans la structure : accroche, mise en place, moment fort, transition, conclusion…"),
        citation: texte(1000).describe("Ce qui est dit pendant le segment, tiré de la transcription (vide s'il n'y a pas de parole)."),
        raison: texte(1000).describe("Pourquoi ce passage est gardé à cet endroit."),
        cadrage: schemaCadrage,
        transition: z
          .enum(TRANSITIONS)
          .default("coupe")
          .describe("Entrée dans ce segment : coupe franche, flash blanc bref (pour souligner un changement, un moment fort) ou fondu depuis le noir."),
        decalageImage: z
          .number()
          .min(-5)
          .max(5)
          .default(0)
          .describe(
            "Décalage de la coupe image par rapport à la coupe son au début de ce segment, en secondes. 0 : coupe franche. Négatif : l'image de ce segment apparaît en avance, pendant que le son du segment précédent continue. Positif : l'image du segment précédent reste un moment sur le son de ce segment. Toujours 0 pour le premier segment.",
          ),
      }),
    )
    .describe("Les segments dans l'ordre de la vidéo finale."),
  plansDeCoupe: z
    .array(
      z.object({
        source: z.string().min(1).describe("Chemin d'une vidéo du projet, relatif au dossier du projet."),
        debut: z.number().min(0).describe("Début de l'image empruntée, en secondes dans cette vidéo."),
        fin: z.number().min(0).describe("Fin de l'image empruntée, en secondes dans cette vidéo."),
        position: z.number().min(0).describe("Instant de la vidéo finale où l'image apparaît, en secondes."),
        raison: texte(500),
        cadrage: schemaCadrage,
      }),
    )
    .default([])
    .describe("Images seules (sans leur son) posées par-dessus le son des segments, par exemple pour montrer ce dont on parle."),
  musiques: z.array(
    z.object({
      origine: z.enum(ORIGINES_MUSIQUE).describe("projet : fichier du dossier du projet ; bibliotheque : asset de la bibliothèque."),
      reference: z.string().min(1).describe("Chemin relatif au projet (origine projet) ou identifiant de l'asset (origine bibliotheque)."),
      debut: z.number().min(0).describe("Début sur la timeline de la vidéo finale, en secondes."),
      fin: z.number().min(0).nullable().describe("Fin sur la timeline de la vidéo finale, ou null jusqu'à la fin."),
      volumeDb: z.number().min(-60).max(0).describe("Volume de la musique en dB (0 = volume d'origine)."),
      baisseSousVoix: z.boolean().describe("Baisser automatiquement la musique quand quelqu'un parle."),
      raison: texte(500),
    }),
  ),
  bruitages: z
    .array(
      z.object({
        origine: z.enum(ORIGINES_MUSIQUE).describe("projet : fichier son du projet ; bibliotheque : asset de type son de la bibliothèque."),
        reference: z.string().min(1).describe("Chemin relatif au projet ou identifiant de l'asset."),
        position: z.number().min(0).describe("Instant de la vidéo finale où le son démarre, en secondes."),
        volumeDb: z.number().min(-40).max(6).describe("Volume du son en dB (0 = volume d'origine)."),
        raison: texte(300),
      }),
    )
    .default([])
    .describe("Sons ponctuels (whoosh, pop, impact…) posés sur la vidéo, chacun lié à un événement visible."),
  textes: z
    .array(
      z.object({
        texte: z.string().min(1).max(80).describe("Le texte affiché, court (un à cinq mots) : titre, chiffre, mot-clé."),
        debut: z.number().min(0).describe("Apparition sur la vidéo finale, en secondes."),
        fin: z.number().min(0).describe("Disparition sur la vidéo finale, en secondes."),
        position: z.enum(POSITIONS_TEXTE).describe("haut, centre ou bas de l'image (le bas est aussi la zone des sous-titres)."),
        taillePourcent: z.number().min(3).max(25).describe("Hauteur du texte en % de la hauteur de l'image (8 à 14 pour un titre)."),
        couleur: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().describe("Couleur #RRVVBB, ou null pour la couleur d'accent des sous-titres."),
        apparition: z.enum(APPARITIONS_TEXTE).describe("pop : grossit brièvement en apparaissant ; fondu ; aucune."),
      }),
    )
    .default([])
    .describe("Textes à l'écran, avec la police des sous-titres."),
  sousTitres: z
    .boolean()
    .default(false)
    .describe("true pour incruster des sous-titres mot à mot, tirés de la transcription (recommandé pour les formats courts, regardés souvent sans le son)."),
  pointsAVerifier: z
    .array(texte(500))
    .describe("Doutes ou informations manquantes à signaler à l'utilisateur (guide de style vide, passage peu clair…)."),
  reponsesRetours: z
    .array(
      z.object({
        commentaire: z.number().int().min(0).describe("Position du commentaire dans retours.json, à partir de 0."),
        changement: texte(1000).describe("Ce qui a été changé pour en tenir compte."),
      }),
    )
    .describe("Vide pour une première proposition."),
}) satisfies z.ZodType<PropositionPlan, unknown>;

export const schemaPlanMontage = schemaPropositionPlan.extend({
  version: z.string().regex(MOTIF_VERSION),
  statut: z.enum(STATUTS_PLAN),
  creeLe: z.string(),
  modifieLe: z.string().nullable(),
}) satisfies z.ZodType<PlanMontage, unknown>;

export const schemaSaisiePropositionPlan = z.object({
  consigne: z.string().trim().max(4000),
  depuis: z.string().regex(MOTIF_VERSION).nullable().default(null),
}) satisfies z.ZodType<SaisiePropositionPlan, unknown>;

export const schemaSaisieCommentaire = z.object({
  temps: z.number().min(0).nullable(),
  texte: z.string().trim().min(1, "Le commentaire est vide.").max(2000),
}) satisfies z.ZodType<SaisieCommentaire>;

export const schemaModificationCommentaire = z.object({
  texte: z.string().trim().min(1, "Le commentaire est vide.").max(2000),
  traite: z.boolean(),
}) satisfies z.ZodType<ModificationCommentaire>;
