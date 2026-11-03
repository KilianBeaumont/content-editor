import { randomUUID } from "node:crypto";
import { join } from "node:path";
import {
  cheminRetours,
  MOTIF_VERSION,
  type CommentaireRetour,
  type ModificationCommentaire,
  type ReponseRetour,
  type RetoursVersion,
  type SaisieCommentaire,
} from "@editeur/shared";
import { z } from "zod";
import { ErreurHttp } from "../erreurs.ts";
import { cheminSur, ecrireJsonAtomique, lireJsonAvecDefauts } from "../fichiers.ts";
import { lireProjet } from "../projets/projets.ts";
import { enSerie } from "../serie.ts";
import { listerVersions } from "./plans.ts";

const schemaRetours = z.object({
  version: z.string(),
  commentaires: z.array(
    z.object({
      id: z.string().default(() => randomUUID()),
      temps: z.number().nullable(),
      texte: z.string(),
      traite: z.boolean().default(false),
      traiteDans: z.string().nullable().default(null),
      reponse: z.string().nullable().default(null),
      creeLe: z.string().default(""),
    }),
  ),
}) satisfies z.ZodType<RetoursVersion, unknown>;

export function trierCommentaires(commentaires: CommentaireRetour[]): CommentaireRetour[] {
  return [...commentaires].sort((a, b) => (a.temps ?? -1) - (b.temps ?? -1) || a.creeLe.localeCompare(b.creeLe));
}

export async function lireRetours(dossierProjet: string, version: string): Promise<RetoursVersion> {
  const retours = await lireJsonAvecDefauts(join(dossierProjet, cheminRetours(version)), schemaRetours, { version, commentaires: [] });
  return { version, commentaires: trierCommentaires(retours.commentaires) };
}

async function dossierVersionRendue(creations: string, id: string, version: string): Promise<string> {
  const dossier = cheminSur(creations, (await lireProjet(creations, id)).chemin);
  if (!MOTIF_VERSION.test(version)) throw new ErreurHttp(404, `Version introuvable : ${version}`);
  const etat = (await listerVersions(dossier)).find((element) => element.version === version);
  if (etat === undefined) throw new ErreurHttp(404, `Version introuvable : ${version}`);
  if (!etat.apercu) throw new ErreurHttp(409, `La version ${version} n'a pas encore d'aperçu à commenter.`);
  return dossier;
}

function modifierRetours(
  dossier: string,
  version: string,
  transformation: (commentaires: CommentaireRetour[]) => CommentaireRetour[],
): Promise<RetoursVersion> {
  return enSerie(join(dossier, cheminRetours(version)), async () => {
    const { commentaires } = await lireRetours(dossier, version);
    const retours: RetoursVersion = { version, commentaires: trierCommentaires(transformation(commentaires)) };
    await ecrireJsonAtomique(join(dossier, cheminRetours(version)), retours);
    return retours;
  });
}

function verifierPresent(commentaires: CommentaireRetour[], id: string): void {
  if (!commentaires.some((element) => element.id === id)) throw new ErreurHttp(404, "Commentaire introuvable.");
}

export async function listerRetours(creations: string, id: string, version: string): Promise<RetoursVersion> {
  return lireRetours(await dossierVersionRendue(creations, id, version), version);
}

export async function ajouterCommentaire(creations: string, id: string, version: string, saisie: SaisieCommentaire): Promise<RetoursVersion> {
  const dossier = await dossierVersionRendue(creations, id, version);
  const commentaire: CommentaireRetour = {
    id: randomUUID(),
    temps: saisie.temps === null ? null : Math.round(saisie.temps * 10) / 10,
    texte: saisie.texte,
    traite: false,
    traiteDans: null,
    reponse: null,
    creeLe: new Date().toISOString(),
  };
  return modifierRetours(dossier, version, (commentaires) => [...commentaires, commentaire]);
}

export async function modifierCommentaire(
  creations: string,
  id: string,
  version: string,
  commentaire: string,
  modification: ModificationCommentaire,
): Promise<RetoursVersion> {
  const dossier = await dossierVersionRendue(creations, id, version);
  return modifierRetours(dossier, version, (commentaires) => {
    verifierPresent(commentaires, commentaire);
    return commentaires.map((element) =>
      element.id !== commentaire
        ? element
        : { ...element, texte: modification.texte, traite: modification.traite, ...(modification.traite ? {} : { traiteDans: null, reponse: null }) },
    );
  });
}

export async function supprimerCommentaire(creations: string, id: string, version: string, commentaire: string): Promise<RetoursVersion> {
  const dossier = await dossierVersionRendue(creations, id, version);
  return modifierRetours(dossier, version, (commentaires) => {
    verifierPresent(commentaires, commentaire);
    return commentaires.filter((element) => element.id !== commentaire);
  });
}

export function commentairesATraiter(retours: RetoursVersion): CommentaireRetour[] {
  return retours.commentaires.filter((commentaire) => !commentaire.traite);
}

export async function marquerTraites(
  dossier: string,
  depuis: string,
  aTraiter: CommentaireRetour[],
  reponses: ReponseRetour[],
  dans: string,
): Promise<number> {
  const parId = new Map<string, string>();
  for (const reponse of reponses) {
    const commentaire = aTraiter[reponse.commentaire];
    if (commentaire !== undefined) parId.set(commentaire.id, reponse.changement);
  }
  if (parId.size === 0) return 0;
  await modifierRetours(dossier, depuis, (commentaires) =>
    commentaires.map((element) => {
      const reponse = parId.get(element.id);
      return reponse === undefined ? element : { ...element, traite: true, traiteDans: dans, reponse };
    }),
  );
  return parId.size;
}
