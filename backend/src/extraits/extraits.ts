import { randomUUID } from "node:crypto";
import { copyFile, link, mkdir, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  cheminAnalyseAudio,
  cheminPreparation,
  cheminProxy,
  cheminTranscription,
  dossierPlanches,
  dureePlan,
  LIBELLES_CHAINES,
  noteGlobale,
  schemaPropositionExtraits,
  type CandidatPropose,
  type Categorie,
  type Chaine,
  type Projet,
  type PropositionPlan,
  type PropositionsExtraits,
  type ReponseExtraits,
  type SaisieCreationExtrait,
  type SaisieProjet,
} from "@editeur/shared";
import { z } from "zod";
import { appelerClaude } from "../claude/appel.ts";
import type { Contexte } from "../contexte.ts";
import { codeErreur, ErreurHttp } from "../erreurs.ts";
import { cheminSur, ecrireJsonAtomique, existe, FichierInvalideError, lireJsonComplete } from "../fichiers.ts";
import { referencesInspiration } from "../inspiration/inspiration.ts";
import { lireParametres } from "../parametres.ts";
import { enregistrerProposition, lirePlan } from "../plans/plans.ts";
import { ecrireTranscriptionsCompactes, lireGuide, sectionPlanches } from "../plans/preparation.ts";
import { listerProjets } from "../projets/liste.ts";
import { creerProjet, lireProjet, modifierMetadata } from "../projets/projets.ts";
import { lireTranscription } from "../projets/transcriptions.ts";
import type { OutilsTache } from "../taches/file.ts";
import { recalerBornes } from "./recalage.ts";

export const SKILL_PROPOSER_EXTRAITS = ".claude/skills/proposer-extraits/SKILL.md";
const FICHIER_PROPOSITIONS = "travail/extraits/propositions.json";
const CONTEXTE_EXTRAITS = "travail/extraits/contexte.md";
const SCHEMA = z.toJSONSchema(schemaPropositionExtraits, { target: "draft-07" });
const NOMBRE_PAR_DEFAUT = 3;

const schemaCadre = z.object({ x: z.number(), y: z.number(), zoom: z.number() });
const schemaPropositions = z.object({
  version: z.string(),
  creeLe: z.string(),
  candidats: z.array(
    z.object({
      numero: z.number(),
      titre: z.string(),
      accroche: z.string(),
      justification: z.string(),
      notes: z.object({ accroche: z.number(), autonomie: z.number(), emotion: z.number(), densite: z.number(), chute: z.number() }),
      passages: z.array(
        z.object({
          source: z.string(),
          debut: z.number(),
          fin: z.number(),
          citation: z.string(),
          cadrage: z.object({ mode: z.enum(["recadre", "fond-flou"]), debut: schemaCadre, fin: schemaCadre.nullable() }).nullable(),
        }),
      ),
      noteGlobale: z.number(),
      duree: z.number(),
      recalages: z.array(z.object({ debut: z.number(), fin: z.number() })),
      projet: z.string().nullable(),
    }),
  ),
}) satisfies z.ZodType<PropositionsExtraits>;

export function categorieExtraits(chaine: Chaine): Categorie {
  return chaine === "creation" ? "court" : "extrait-recit";
}

async function lirePropositions(dossier: string): Promise<PropositionsExtraits | null> {
  try {
    return await lireJsonComplete(join(dossier, FICHIER_PROPOSITIONS), schemaPropositions, {});
  } catch (erreur) {
    if (codeErreur(erreur) === "ENOENT" || erreur instanceof FichierInvalideError) return null;
    throw erreur;
  }
}

export async function listerExtraits(creations: string, id: string): Promise<ReponseExtraits> {
  const projet = await lireProjet(creations, id);
  const enfants = [];
  for (const resume of (await listerProjets(creations)).projets) {
    if (resume.id === id) continue;
    const autre = await lireProjet(creations, resume.id);
    if (autre.metadata.parent === id) enfants.push({ id: autre.id, titre: autre.metadata.titre.fr });
  }
  return {
    propositions: await lirePropositions(cheminSur(creations, projet.chemin)),
    enfants,
    nombreDemande: projet.metadata.nombreFormatsCourts ?? NOMBRE_PAR_DEFAUT,
  };
}

function temps(secondes: number): string {
  const minutes = Math.floor(secondes / 60);
  return `${minutes}:${(secondes - minutes * 60).toFixed(1).padStart(4, "0")}`;
}

function cellule(texte: string): string {
  return texte.replaceAll("|", "/").replaceAll(/\s*\n\s*/g, " ").trim() || "—";
}

export async function proposerExtraits(contexte: Contexte, id: string, consigne: string, outils: OutilsTache): Promise<string> {
  const { config, racineDepot } = contexte;
  const projet = await lireProjet(config.creations, id);
  const dossier = cheminSur(config.creations, projet.chemin);
  const version = projet.metadata.versionValidee;
  if (version === null) throw new Error("Valide d'abord une version de la vidéo longue (onglet Aperçu) : les extraits en sont tirés.");
  const plan = await lirePlan(dossier, version);
  if (plan === null) throw new Error(`Le plan de la version validée ${version} est introuvable.`);
  const consignes = join(racineDepot, SKILL_PROPOSER_EXTRAITS);
  if (!(await existe(consignes))) throw new Error(`Consignes introuvables : ${SKILL_PROPOSER_EXTRAITS}.`);

  outils.progression(null, "Préparation des fichiers pour Claude");
  const { transcrites, planches } = await ecrireTranscriptionsCompactes(config.creations, projet);
  if (transcrites.size === 0) throw new Error("Aucune transcription : analyse d'abord les rushes.");
  const nombre = projet.metadata.nombreFormatsCourts ?? NOMBRE_PAR_DEFAUT;
  const categorie = categorieExtraits(projet.metadata.chaine);
  let depart = 0;
  const lignesPlan = plan.segments.map((segment) => {
    const ligne = `| ${segment.id} | ${temps(depart)} | ${segment.source} | ${segment.debut.toFixed(2)}-${segment.fin.toFixed(2)} | ${cellule(segment.citation)} |`;
    depart += segment.fin - segment.debut;
    return ligne;
  });
  const lignes = [
    `# Extraits courts à tirer de : ${projet.metadata.titre.fr}`,
    "",
    `- Chaîne : ${LIBELLES_CHAINES[projet.metadata.chaine]}`,
    `- Nombre d'extraits demandés : ${nombre}`,
    "- Format : vertical 9:16, pour TikTok, Reels et Shorts (15 à 60 secondes en général)",
    `- Intention de la vidéo longue : ${cellule(projet.metadata.consignes.intention)}`,
    ...(consigne === "" ? [] : [`- **Consigne de l'utilisateur pour ces extraits** : ${cellule(consigne)}`]),
    "",
    `## La vidéo longue validée (${version}, ${temps(dureePlan(plan))})`,
    "",
    "| Segment | Dans la vidéo | Rush | Passage (s) | Ce qui est dit |",
    "| --- | --- | --- | --- | --- |",
    ...lignesPlan,
    "",
    "## Transcriptions des rushes",
    "",
    ...[...transcrites].map(([chemin, compacte]) => `- ${chemin} : ${compacte}`),
    "",
    ...(planches.size === 0 ? [] : sectionPlanches(planches)),
    `## Guide de style des formats courts (guides/${categorie}/style.md)`,
    "",
    await lireGuide(config.creations, `guides/${categorie}/style.md`),
    "",
    `## Accroches (guides/${categorie}/hooks.md)`,
    "",
    await lireGuide(config.creations, `guides/${categorie}/hooks.md`),
    "",
    ...(await referencesInspiration(config.creations, categorie)),
  ];
  await mkdir(dirname(join(dossier, CONTEXTE_EXTRAITS)), { recursive: true });
  await writeFile(join(dossier, CONTEXTE_EXTRAITS), lignes.join("\n"), "utf8");

  const { claude } = await lireParametres(config.creations);
  const reponse = await appelerClaude({
    commande: config.binaires.claude,
    modele: claude.modele,
    dossier,
    consignes,
    prompt: `Propose ${nombre} extraits courts tirés de cette vidéo, en suivant tes consignes. Tout est dans ${CONTEXTE_EXTRAITS} : lis-le en premier, puis les transcriptions et les planches utiles. Réponds uniquement par la proposition structurée.`,
    schema: SCHEMA,
    session: { id: randomUUID(), reprise: false },
    signal: outils.signal,
    surEtape: (etape) => outils.progression(null, etape),
  });
  const proposition = schemaPropositionExtraits.safeParse(reponse.sortie);
  if (!proposition.success) throw new Error(`La proposition renvoyée par Claude n'est pas conforme :\n${z.prettifyError(proposition.error)}`);

  outils.progression(1, "Recalage des bornes");
  const transcriptions = new Map<string, Awaited<ReturnType<typeof lireTranscription>> | null>();
  const transcriptionDe = async (source: string) => {
    if (!transcriptions.has(source)) transcriptions.set(source, await lireTranscription(config.creations, id, source).catch(() => null));
    return transcriptions.get(source) ?? null;
  };
  const candidats: CandidatPropose[] = [];
  for (const candidat of proposition.data.candidats) {
    const passages = [];
    const recalages = [];
    for (const passage of candidat.passages) {
      if (!(await existe(cheminSur(dossier, passage.source)))) continue;
      const transcription = await transcriptionDe(passage.source);
      const mots = transcription?.segments.flatMap((segment) => segment.mots) ?? [];
      const bornes = recalerBornes(passage, mots, transcription?.duree ?? null);
      passages.push({ ...passage, ...bornes });
      recalages.push({ debut: Math.round((bornes.debut - passage.debut) * 100) / 100, fin: Math.round((bornes.fin - passage.fin) * 100) / 100 });
    }
    if (passages.length === 0) continue;
    candidats.push({
      ...candidat,
      passages,
      numero: candidats.length + 1,
      noteGlobale: noteGlobale(candidat.notes),
      duree: Math.round(passages.reduce((total, passage) => total + passage.fin - passage.debut, 0) * 10) / 10,
      recalages,
      projet: null,
    });
  }
  const classes = [...candidats].sort((a, b) => b.noteGlobale - a.noteGlobale).map((candidat, index) => ({ ...candidat, numero: index + 1 }));
  const propositions: PropositionsExtraits = { version, creeLe: new Date().toISOString(), candidats: classes };
  await ecrireJsonAtomique(join(dossier, FICHIER_PROPOSITIONS), propositions);
  return `${candidats.length} extrait${candidats.length > 1 ? "s" : ""} proposé${candidats.length > 1 ? "s" : ""} à partir de ${version}.`;
}

async function lierFichier(source: string, cible: string): Promise<void> {
  if (!(await existe(source)) || (await existe(cible))) return;
  await mkdir(dirname(cible), { recursive: true });
  try {
    await link(source, cible);
  } catch {
    await copyFile(source, cible);
  }
}

async function lierRush(parent: string, enfant: string, chemin: string): Promise<void> {
  await lierFichier(join(parent, chemin), join(enfant, chemin));
  for (const relatif of [cheminProxy(chemin), cheminPreparation(chemin), cheminAnalyseAudio(chemin), cheminTranscription(chemin)]) {
    await lierFichier(join(parent, relatif), join(enfant, relatif));
  }
  const planches = dossierPlanches(chemin);
  try {
    for (const nom of await readdir(join(parent, planches))) await lierFichier(join(parent, planches, nom), join(enfant, planches, nom));
  } catch (erreur) {
    if (codeErreur(erreur) !== "ENOENT") throw erreur;
  }
}

export async function creerExtrait(creations: string, id: string, saisie: SaisieCreationExtrait): Promise<Projet> {
  const parent = await lireProjet(creations, id);
  const dossierParent = cheminSur(creations, parent.chemin);
  const propositions = await lirePropositions(dossierParent);
  const candidat = propositions?.candidats.find((element) => element.numero === saisie.numero);
  if (propositions === null || candidat === undefined) throw new ErreurHttp(404, `Extrait introuvable : n° ${saisie.numero}.`);
  if (candidat.projet !== null) throw new ErreurHttp(409, `Cet extrait a déjà son projet : ${candidat.projet}.`);
  const { metadata } = parent;

  const entree: SaisieProjet = {
    chaine: metadata.chaine,
    categorie: categorieExtraits(metadata.chaine),
    titre: { fr: saisie.titre, en: null },
    datePublicationPrevue: metadata.datePublicationPrevue,
    anglais: false,
    sorties: ["formats-courts"],
    nombreFormatsCourts: 1,
    consignes: { intention: `${candidat.accroche} ${candidat.justification}`.trim(), dureeViseeMinutes: null, aGarder: "", aEviter: "" },
    fichiers: [],
    auteur: metadata.auteur,
    autorisation:
      metadata.autorisation === null
        ? null
        : {
            obtenue: metadata.autorisation.obtenue,
            date: metadata.autorisation.date,
            lecture: metadata.autorisation.lecture,
            traductionAnglaise: metadata.autorisation.traductionAnglaise,
            monetisation: metadata.autorisation.monetisation,
            plateformes: metadata.autorisation.plateformes,
          },
    artistes: metadata.artistes,
    assetsBibliotheque: metadata.assetsBibliotheque,
    futurRoman: metadata.futurRoman,
    vocabulaire: metadata.vocabulaire,
  };
  const { projet: enfant } = await creerProjet(creations, entree);
  const dossierEnfant = cheminSur(creations, enfant.chemin);

  const sources = [...new Set(candidat.passages.map((passage) => passage.source))];
  for (const source of sources) await lierRush(dossierParent, dossierEnfant, source);
  const preuve = metadata.autorisation?.preuve ?? null;
  if (preuve !== null) await lierFichier(join(dossierParent, preuve), join(dossierEnfant, preuve));

  const misAJour = await modifierMetadata(creations, enfant.id, (actuel) => ({
    ...actuel,
    parent: parent.id,
    autorisation: actuel.autorisation === null ? null : { ...actuel.autorisation, preuve },
    fichiers: sources.map((source) => ({ chemin: source, origine: `${parent.chemin}/${source}`, note: `Lié au projet ${parent.id}` })),
  }));

  const proposition: PropositionPlan = {
    resume: `Extrait de « ${metadata.titre.fr} » (${propositions.version}). ${candidat.justification}`,
    hook: { segment: "s1", explication: candidat.accroche },
    segments: candidat.passages.map((passage, index) => ({
      id: `s${index + 1}`,
      source: passage.source,
      debut: passage.debut,
      fin: passage.fin,
      role: index === 0 ? "accroche" : "suite",
      citation: passage.citation,
      raison: index === 0 ? candidat.justification : "",
      decalageImage: 0,
      cadrage: passage.cadrage,
    })),
    plansDeCoupe: [],
    musiques: [],
    sousTitres: true,
    pointsAVerifier: [],
    reponsesRetours: [],
  };
  await enregistrerProposition(dossierEnfant, proposition);
  await ecrireJsonAtomique(join(dossierParent, FICHIER_PROPOSITIONS), {
    ...propositions,
    candidats: propositions.candidats.map((element) => (element.numero === candidat.numero ? { ...element, projet: enfant.id } : element)),
  });
  return misAJour;
}
