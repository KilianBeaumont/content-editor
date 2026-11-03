import type { AnalyseAudio, InfosMedia, ProfilInspiration, Transcription } from "@editeur/shared";

const arrondi = (valeur: number, decimales = 2) => Math.round(valeur * 10 ** decimales) / 10 ** decimales;

function mediane(valeurs: number[]): number | null {
  if (valeurs.length === 0) return null;
  const triees = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(triees.length / 2);
  return triees.length % 2 === 1 ? (triees[milieu] ?? null) : ((triees[milieu - 1] ?? 0) + (triees[milieu] ?? 0)) / 2;
}

export function lireCoupe(ligne: string): number | null {
  const resultat = /pts_time:([\d.]+)/.exec(ligne);
  return resultat === null ? null : Number(resultat[1]);
}

export function calculerProfil(media: InfosMedia, coupes: number[], transcription: Transcription | null, audio: AnalyseAudio | null): ProfilInspiration {
  const duree = media.duree;
  const bornes = duree === null ? coupes : [0, ...coupes.filter((coupe) => coupe > 0 && coupe < duree), duree];
  const plans = bornes.slice(1).map((fin, index) => fin - (bornes[index] ?? 0)).filter((longueur) => longueur > 0);
  const mots = transcription?.segments.reduce((total, segment) => total + segment.mots.length, 0) ?? 0;
  const parole = transcription?.segments.reduce((total, segment) => total + Math.max(0, segment.fin - segment.debut), 0) ?? 0;
  const premierSegment = transcription?.segments[0];
  const silences = audio?.silences.map((silence) => silence.fin - silence.debut) ?? [];
  const parMinute = (nombre: number) => (duree === null || duree === 0 ? null : arrondi((nombre / duree) * 60, 1));
  return {
    duree,
    largeur: media.video?.largeur ?? null,
    hauteur: media.video?.hauteur ?? null,
    imagesParSeconde: media.video?.imagesParSeconde ?? null,
    coupes: coupes.length,
    coupesParMinute: parMinute(coupes.length),
    dureeMoyennePlan: duree === null || plans.length === 0 ? null : arrondi(plans.reduce((total, plan) => total + plan, 0) / plans.length),
    dureeMedianePlan: duree === null ? null : (() => {
      const valeur = mediane(plans);
      return valeur === null ? null : arrondi(valeur);
    })(),
    plusLongPlan: duree === null || plans.length === 0 ? null : arrondi(Math.max(...plans)),
    premiereCoupe: coupes[0] ?? null,
    mots,
    motsParMinute: transcription === null ? null : parMinute(mots),
    premierMot: premierSegment?.mots[0]?.debut ?? premierSegment?.debut ?? null,
    partParole: transcription === null || duree === null || duree === 0 ? null : arrondi(Math.min(1, parole / duree)),
    plusLongSilence: silences.length === 0 ? null : arrondi(Math.max(...silences), 1),
  };
}

function nombre(valeur: number | null, unite = "", decimales = 1): string {
  return valeur === null ? "?" : `${valeur.toFixed(decimales).replace(".", ",")}${unite}`;
}

export function resumerProfil(profil: ProfilInspiration): string {
  const format = profil.largeur !== null && profil.hauteur !== null ? `${profil.largeur}x${profil.hauteur}` : "format inconnu";
  return [
    `${nombre(profil.duree, " s")} (${format})`,
    `${profil.coupes} coupes, ${nombre(profil.coupesParMinute)} par minute`,
    `plans de ${nombre(profil.dureeMedianePlan, " s")} en médiane (le plus long : ${nombre(profil.plusLongPlan, " s")})`,
    `première coupe à ${nombre(profil.premiereCoupe, " s")}`,
    `${nombre(profil.motsParMinute, "", 0)} mots par minute, premier mot à ${nombre(profil.premierMot, " s")}`,
    `parole ${profil.partParole === null ? "?" : `${Math.round(profil.partParole * 100)} %`} du temps, plus long silence ${nombre(profil.plusLongSilence, " s")}`,
  ].join(" · ");
}
