import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { cheminPlan, dureePlan, schemaPropositionPlan } from "@editeur/shared";
import { z } from "zod";
import { appelerClaude, SessionIntrouvableError, type OptionsAppelClaude, type ResultatAppelClaude } from "../claude/appel.ts";
import type { Contexte } from "../contexte.ts";
import { cheminSur, existe } from "../fichiers.ts";
import { lireParametres } from "../parametres.ts";
import { enregistrerSessionClaude, lireProjet } from "../projets/projets.ts";
import type { OutilsTache } from "../taches/file.ts";
import { enregistrerProposition, lirePlan, sourcesPlan, versionAProposer } from "./plans.ts";
import { CONTEXTE_PLAN, preparerProposition, type RetoursAIntegrer } from "./preparation.ts";
import { commentairesATraiter, lireRetours, marquerTraites } from "./retours.ts";
import { validerPlan } from "./validation.ts";

export const SKILL_PROPOSER_PLAN = ".claude/skills/proposer-plan/SKILL.md";
export const SKILL_INTEGRER_RETOURS = ".claude/skills/integrer-retours/SKILL.md";
const CONSIGNES_COMBINEES = "travail/plan/consignes.md";
const SCHEMA_PROPOSITION = z.toJSONSchema(schemaPropositionPlan, { target: "draft-07" });

function promptProposition(version: string, remplace: boolean, consigne: string, depuis: string | null): string {
  const lignes = [
    depuis === null
      ? `Propose le plan de montage de la version ${version} de ce projet, en suivant tes consignes de montage.`
      : `Produis le plan de la version ${version} en intégrant les commentaires de l'utilisateur sur l'aperçu ${depuis}, en suivant tes consignes.`,
    `Tout ce qu'il faut savoir est dans ${CONTEXTE_PLAN} : lis-le en premier, puis les transcriptions qu'il indique.`,
  ];
  if (remplace) lignes.push(`Une proposition existe déjà dans ${cheminPlan(version)} : l'utilisateur en veut une autre.`);
  if (consigne !== "") lignes.push("L'utilisateur a donné une consigne pour cette proposition (dans contexte.md) : elle est prioritaire.");
  lignes.push("Réponds uniquement par le plan structuré.");
  return lignes.join("\n");
}

function temps(secondes: number): string {
  return `${Math.floor(secondes / 60)}:${String(Math.round(secondes % 60)).padStart(2, "0")}`;
}

async function fichierConsignes(racineDepot: string, dossier: string, depuis: string | null): Promise<string> {
  const skills = depuis === null ? [SKILL_PROPOSER_PLAN] : [SKILL_PROPOSER_PLAN, SKILL_INTEGRER_RETOURS];
  for (const skill of skills) {
    if (!(await existe(join(racineDepot, skill)))) throw new Error(`Consignes de montage introuvables : ${skill}.`);
  }
  if (skills.length === 1) return join(racineDepot, SKILL_PROPOSER_PLAN);
  const textes = await Promise.all(skills.map((skill) => readFile(join(racineDepot, skill), "utf8")));
  const cible = join(dossier, CONSIGNES_COMBINEES);
  await mkdir(dirname(cible), { recursive: true });
  await writeFile(cible, textes.join("\n\n---\n\n"), "utf8");
  return cible;
}

export async function proposerPlan(contexte: Contexte, id: string, consigne: string, depuis: string | null, outils: OutilsTache): Promise<string> {
  const { config, racineDepot } = contexte;
  const projet = await lireProjet(config.creations, id);
  const dossier = cheminSur(config.creations, projet.chemin);
  const consignes = await fichierConsignes(racineDepot, dossier, depuis);

  outils.progression(null, "Préparation des fichiers pour Claude");
  let retours: RetoursAIntegrer | null = null;
  if (depuis !== null) {
    const plan = await lirePlan(dossier, depuis);
    const commentaires = commentairesATraiter(await lireRetours(dossier, depuis));
    if (plan === null) throw new Error(`Plan introuvable : ${depuis}.`);
    if (commentaires.length === 0) throw new Error(`Aucun commentaire à intégrer sur l'aperçu ${depuis}.`);
    retours = { version: depuis, plan, commentaires };
  }
  const { version, remplace } = await versionAProposer(dossier);
  const preparation = await preparerProposition(config.creations, projet, config.binaires.ffprobe, version, consigne, retours);
  if (preparation.transcriptions === 0) throw new Error("Aucune transcription : transcris d'abord les rushes (section Analyse des rushes).");

  const { claude } = await lireParametres(config.creations);
  const base: Omit<OptionsAppelClaude, "session"> = {
    commande: config.binaires.claude,
    modele: claude.modele,
    dossier,
    consignes,
    prompt: promptProposition(version, remplace, consigne, depuis),
    schema: SCHEMA_PROPOSITION,
    signal: outils.signal,
    surEtape: (etape) => outils.progression(null, etape),
  };
  const ancienne = projet.metadata.sessionClaude;
  let reponse: ResultatAppelClaude;
  try {
    reponse = await appelerClaude({ ...base, session: ancienne === null ? { id: randomUUID(), reprise: false } : { id: ancienne, reprise: true } });
  } catch (erreur) {
    if (!(erreur instanceof SessionIntrouvableError)) throw erreur;
    outils.progression(null, "Nouvelle session Claude (l'ancienne n'existe pas sur cette machine)");
    reponse = await appelerClaude({ ...base, session: { id: randomUUID(), reprise: false } });
  }

  const proposition = schemaPropositionPlan.safeParse(reponse.sortie);
  if (!proposition.success) throw new Error(`Le plan renvoyé par Claude n'est pas conforme :\n${z.prettifyError(proposition.error)}`);
  outils.progression(1, "Enregistrement du plan");
  const plan = await enregistrerProposition(dossier, proposition.data);
  await enregistrerSessionClaude(config.creations, id, reponse.session);
  const traites = retours === null ? 0 : await marquerTraites(dossier, retours.version, retours.commentaires, plan.reponsesRetours, plan.version);

  const problemes = validerPlan(plan, await sourcesPlan(config.creations, projet, config.binaires.ffprobe));
  const erreurs = problemes.filter((probleme) => probleme.niveau === "erreur").length;
  const avertissements = problemes.length - erreurs;
  const bilan = [erreurs > 0 ? `${erreurs} à corriger` : "", avertissements > 0 ? `${avertissements} avertissement${avertissements > 1 ? "s" : ""}` : ""]
    .filter((element) => element !== "")
    .join(", ");
  const segments = `${plan.segments.length} segment${plan.segments.length > 1 ? "s" : ""}`;
  const reponses = retours === null ? "" : `, ${traites} commentaire${traites > 1 ? "s" : ""} sur ${retours.commentaires.length} traité${traites > 1 ? "s" : ""}`;
  return `Plan ${plan.version} proposé : ${segments}, ${temps(dureePlan(plan))}${reponses}${bilan === "" ? "" : ` (${bilan})`}.`;
}
