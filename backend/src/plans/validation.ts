import { dureePlan, plagesImage, type AssetBibliotheque, type Cadrage, type GenreFichier, type OrigineMusique, type ProblemePlan, type PropositionPlan } from "@editeur/shared";

export interface MediaProjet {
  genre: GenreFichier;
  duree: number | null;
  largeur?: number | null;
  hauteur?: number | null;
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
  formatVertical?: boolean;
}

const TOLERANCE_FIN = 0.05;
const SEGMENT_COURT = 0.3;
const ECART_DUREE = 0.25;
const DOSSIERS_EXCLUS = ["travail/", "versions/", "exports/", "autorisation/"];
const TYPES_MUSIQUE = new Set(["musique", "ambiance"]);
const TYPES_BRUITAGE = new Set(["son", "ambiance"]);

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

  const plages = plagesImage(plan.segments);
  plan.segments.forEach((segment, index) => {
    const precedent = plan.segments[index - 1];
    if (segment.decalageImage !== 0) {
      if (precedent === undefined) {
        erreur("Le premier segment ne peut pas avoir de décalage d'image.", segment.id);
        return;
      }
      if (-segment.decalageImage >= precedent.fin - precedent.debut) {
        erreur(`L'image arrive en avance de plus que toute la durée de ${precedent.id}.`, segment.id);
      }
      if (segment.decalageImage >= segment.fin - segment.debut) {
        erreur(`L'image de ${precedent.id} reste plus longtemps que tout ce segment.`, segment.id);
      }
    }
    const plage = plages[index];
    const media = sources.medias.get(segment.source);
    if (plage === undefined || media === undefined || segment.fin <= segment.debut) return;
    if (plage.debut < -TOLERANCE_FIN) erreur("Avec le décalage, l'image commence avant le début du rush.", segment.id);
    if (media.duree !== null && segment.fin <= media.duree + TOLERANCE_FIN && plage.fin > media.duree + TOLERANCE_FIN) {
      erreur("Avec le décalage du segment suivant, l'image dépasse la fin du rush.", segment.id);
    }
  });

  const sansCadrage = (source: string, cadrage: Cadrage | null): string | null => {
    const media = sources.medias.get(source);
    if (cadrage !== null || media?.genre !== "video" || !media.largeur || !media.hauteur || sources.formatVertical === undefined) return null;
    const vertical = media.hauteur > media.largeur;
    if (vertical === sources.formatVertical) return null;
    return vertical
      ? "Image verticale dans une vidéo horizontale, sans cadrage : bandes noires sur les côtés."
      : "Image horizontale dans une vidéo verticale, sans cadrage : bandes noires en haut et en bas. Ajoute un cadrage (recadré ou fond flou).";
  };
  for (const segment of plan.segments) {
    const message = sansCadrage(segment.source, segment.cadrage);
    if (message !== null) avertissement(message, segment.id);
  }
  plan.plansDeCoupe.forEach((coupe, index) => {
    const message = sansCadrage(coupe.source, coupe.cadrage);
    if (message !== null) avertissement(`Plan de coupe ${index + 1} : ${message}`);
  });

  if (plan.segments.length > 0 && !vus.has(plan.hook.segment)) {
    erreur(`L'accroche renvoie à un segment inconnu : ${plan.hook.segment}.`);
  }

  const total = dureePlan(plan);
  plan.plansDeCoupe.forEach((coupe, index) => {
    const nom = `Plan de coupe ${index + 1}`;
    const media = utilisable(coupe.source) ? sources.medias.get(coupe.source) : undefined;
    if (media === undefined || media.genre !== "video") {
      erreur(`${nom} : vidéo introuvable ou inutilisable : ${coupe.source}.`);
      return;
    }
    if (coupe.fin <= coupe.debut) {
      erreur(`${nom} : la fin doit venir après le début.`);
      return;
    }
    if (media.duree !== null && coupe.fin > media.duree + TOLERANCE_FIN) erreur(`${nom} : la fin dépasse la durée de la vidéo (${temps(media.duree)}).`);
    if (plan.segments.length > 0 && coupe.position + (coupe.fin - coupe.debut) > total + TOLERANCE_FIN) {
      erreur(`${nom} : dépasse la fin de la vidéo finale (${temps(total)}).`);
    }
  });
  const verifierAudio = (origine: OrigineMusique, nom: string, libelle: string, types: Set<string>) => {
    if (origine === "projet") {
      const media = utilisable(nom) ? sources.medias.get(nom) : undefined;
      if (media === undefined || media.genre !== "audio") erreur(`${libelle} introuvable dans le projet : ${nom}.`);
      return;
    }
    const disponible = sources.assets.get(nom);
    if (disponible === undefined || !types.has(disponible.asset.type)) {
      erreur(`${libelle} introuvable dans la bibliothèque : ${nom}.`);
    } else if (!disponible.valide) {
      erreur(`L'asset ${nom} est à vérifier dans la bibliothèque (fichier ou accord d'artiste).`);
    } else if (!sources.assetsChoisis.includes(nom)) {
      avertissement(`L'asset ${nom} n'est pas dans les assets choisis pour ce projet.`);
    }
  };
  for (const musique of plan.musiques) {
    const nom = musique.reference;
    verifierAudio(musique.origine, nom, "Musique", TYPES_MUSIQUE);
    if (musique.fin !== null && musique.fin <= musique.debut) erreur(`La musique ${nom} finit avant de commencer.`);
    if (plan.segments.length > 0 && musique.debut >= total) erreur(`La musique ${nom} commence après la fin de la vidéo.`);
  }

  for (const bruitage of plan.bruitages) {
    verifierAudio(bruitage.origine, bruitage.reference, "Bruitage", TYPES_BRUITAGE);
    if (plan.segments.length > 0 && bruitage.position >= total) erreur(`Le bruitage ${bruitage.reference} tombe après la fin de la vidéo.`);
  }
  plan.textes.forEach((texte, index) => {
    const nom = `Texte ${index + 1} (« ${texte.texte} »)`;
    if (texte.texte.trim() === "") erreur(`Texte ${index + 1} : le texte est vide.`);
    if (texte.fin <= texte.debut) erreur(`${nom} : la fin doit venir après le début.`);
    else if (plan.segments.length > 0 && texte.debut >= total) erreur(`${nom} : commence après la fin de la vidéo.`);
    else if (plan.segments.length > 0 && texte.fin > total + TOLERANCE_FIN) avertissement(`${nom} : dépasse la fin de la vidéo, il sera coupé.`);
    if (texte.position === "bas" && plan.sousTitres) avertissement(`${nom} : en bas, il risque de chevaucher les sous-titres.`);
  });

  const visee = sources.dureeViseeSecondes;
  if (visee !== null && plan.segments.length > 0 && Math.abs(total - visee) > visee * ECART_DUREE) {
    avertissement(`Durée du plan : ${temps(total)}, pour ${temps(visee)} visées.`);
  }

  return problemes;
}
