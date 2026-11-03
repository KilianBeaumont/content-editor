import { dureePlan, type AssetBibliotheque, type GenreFichier, type ProblemePlan, type PropositionPlan } from "@editeur/shared";

export interface MediaProjet {
  genre: GenreFichier;
  duree: number | null;
}

export interface AssetDisponible {
  asset: AssetBibliotheque;
  valide: boolean;
}

export interface SourcesPlan {
  medias: Map<string, MediaProjet>;
  assets: Map<string, AssetDisponible>;
  assetsChoisis: string[];
  dureeViseeSecondes: number | null;
}

const TOLERANCE_FIN = 0.05;
const SEGMENT_COURT = 0.3;
const ECART_DUREE = 0.25;
const DOSSIERS_EXCLUS = ["travail/", "versions/", "exports/", "autorisation/"];
const TYPES_MUSIQUE = new Set(["musique", "ambiance"]);

function temps(secondes: number): string {
  const minutes = Math.floor(secondes / 60);
  const reste = (secondes - minutes * 60).toFixed(1).replace(".", ",").padStart(4, "0");
  return `${minutes}:${reste}`;
}

function utilisable(chemin: string): boolean {
  return !DOSSIERS_EXCLUS.some((dossier) => chemin.startsWith(dossier));
}

export function validerPlan(plan: PropositionPlan, sources: SourcesPlan): ProblemePlan[] {
  const problemes: ProblemePlan[] = [];
  const erreur = (message: string, segment: string | null = null) => problemes.push({ niveau: "erreur", message, segment });
  const avertissement = (message: string, segment: string | null = null) => problemes.push({ niveau: "avertissement", message, segment });

  if (plan.segments.length === 0) erreur("Le plan ne contient aucun segment.");

  const vus = new Set<string>();
  for (const segment of plan.segments) {
    if (vus.has(segment.id)) erreur(`L'identifiant ${segment.id} est utilisé deux fois.`, segment.id);
    vus.add(segment.id);

    const media = utilisable(segment.source) ? sources.medias.get(segment.source) : undefined;
    if (media === undefined || (media.genre !== "video" && media.genre !== "audio")) {
      erreur(`Source introuvable ou inutilisable : ${segment.source}.`, segment.id);
      continue;
    }
    if (segment.fin <= segment.debut) {
      erreur(`La fin (${temps(segment.fin)}) doit venir après le début (${temps(segment.debut)}).`, segment.id);
      continue;
    }
    if (media.duree !== null && segment.fin > media.duree + TOLERANCE_FIN) {
      erreur(`La fin (${temps(segment.fin)}) dépasse la durée du rush (${temps(media.duree)}).`, segment.id);
    }
    if (segment.fin - segment.debut < SEGMENT_COURT) avertissement("Segment très court : moins de 0,3 s.", segment.id);
  }

  plan.segments.forEach((segment, index) => {
    const chevauche = plan.segments
      .slice(0, index)
      .find((autre) => autre.source === segment.source && autre.debut < segment.fin && segment.debut < autre.fin);
    if (chevauche !== undefined) avertissement(`Reprend un passage déjà utilisé par ${chevauche.id}.`, segment.id);
  });

  if (plan.segments.length > 0 && !vus.has(plan.hook.segment)) {
    erreur(`L'accroche renvoie à un segment inconnu : ${plan.hook.segment}.`);
  }

  const total = dureePlan(plan);
  for (const musique of plan.musiques) {
    const nom = musique.reference;
    if (musique.origine === "projet") {
      const media = utilisable(nom) ? sources.medias.get(nom) : undefined;
      if (media === undefined || media.genre !== "audio") erreur(`Musique introuvable dans le projet : ${nom}.`);
    } else {
      const disponible = sources.assets.get(nom);
      if (disponible === undefined || !TYPES_MUSIQUE.has(disponible.asset.type)) {
        erreur(`Musique introuvable dans la bibliothèque : ${nom}.`);
      } else if (!disponible.valide) {
        erreur(`L'asset ${nom} est à vérifier dans la bibliothèque (fichier ou accord d'artiste).`);
      } else if (!sources.assetsChoisis.includes(nom)) {
        avertissement(`L'asset ${nom} n'est pas dans les assets choisis pour ce projet.`);
      }
    }
    if (musique.fin !== null && musique.fin <= musique.debut) erreur(`La musique ${nom} finit avant de commencer.`);
    if (plan.segments.length > 0 && musique.debut >= total) erreur(`La musique ${nom} commence après la fin de la vidéo.`);
  }

  const visee = sources.dureeViseeSecondes;
  if (visee !== null && plan.segments.length > 0 && Math.abs(total - visee) > visee * ECART_DUREE) {
    avertissement(`Durée du plan : ${temps(total)}, pour ${temps(visee)} visées.`);
  }

  return problemes;
}
