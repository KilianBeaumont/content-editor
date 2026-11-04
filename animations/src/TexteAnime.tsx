import { morceauxTexte, type StyleTextes, type TexteEcran } from "@editeur/shared";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { AbsoluteFill, cancelRender, continueRender, delayRender, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

const HAUTEUR: Record<TexteEcran["position"], number> = { haut: 0.2, centre: 0.5, bas: 0.8 };
const LETTRES_PAR_SECONDE = 28;
const SORTIE = 0.2;

interface Mot {
  texte: string;
  accent: boolean;
}

function signature(texte: string): string {
  let valeur = 5381;
  for (let index = 0; index < texte.length; index += 97) valeur = ((valeur << 5) + valeur + texte.charCodeAt(index)) | 0;
  return `${(valeur >>> 0).toString(36)}${texte.length.toString(36)}`;
}

function usePolice(url: string | null): { famille: string; prete: boolean } {
  const famille = url === null ? "sans-serif" : `police-${signature(url)}`;
  const [poignee] = useState(() => (url === null ? null : delayRender("Chargement de la police des textes")));
  const [prete, setPrete] = useState(url === null);
  useEffect(() => {
    if (url === null) return;
    const face = new FontFace(famille, `url("${url}")`);
    face
      .load()
      .then((chargee) => {
        document.fonts.add(chargee);
        setPrete(true);
        if (poignee !== null) continueRender(poignee);
      })
      .catch((erreur: unknown) => cancelRender(erreur instanceof Error ? erreur : new Error(String(erreur))));
  }, [url, famille, poignee]);
  return { famille: url === null ? "sans-serif" : `"${famille}", sans-serif`, prete };
}

function tailleAjustee(liste: Mot[], famille: string, taille: number, largeurDisponible: number, prete: boolean): number {
  const contexte = prete ? document.createElement("canvas").getContext("2d") : null;
  if (contexte === null) return taille;
  contexte.font = `${taille}px ${famille}`;
  const plusLarge = Math.max(0, ...liste.map((mot) => contexte.measureText(mot.texte).width));
  return plusLarge > largeurDisponible ? taille * (largeurDisponible / plusLarge) : taille;
}

function clair(couleur: string): boolean {
  const [r, v, b] = [1, 3, 5].map((position) => parseInt(couleur.slice(position, position + 2), 16) / 255);
  return 0.2126 * (r ?? 1) + 0.7152 * (v ?? 1) + 0.0722 * (b ?? 1) > 0.6;
}

function mots(texte: string): Mot[] {
  return morceauxTexte(texte).flatMap((morceau) =>
    morceau.texte
      .split(/\s+/)
      .filter((mot) => mot !== "")
      .map((mot) => ({ texte: mot, accent: morceau.accent })),
  );
}

export function TexteAnime({ texte, style }: { texte: TexteEcran; style: StyleTextes }) {
  const image = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const { famille, prete } = usePolice(style.police);
  const liste = mots(texte.texte);
  const tailleVoulue = (texte.taillePourcent / 100) * height;
  const marges = texte.fond === "aucun" ? 0.14 : 0.76;
  const taille = useMemo(() => tailleAjustee(liste, famille, tailleVoulue, width * 0.86 - tailleVoulue * marges, prete), [texte.texte, famille, tailleVoulue, width, marges, prete]);
  const anime = texte.apparition !== "aucune";

  const sortie = Math.max(1, Math.round(SORTIE * fps));
  const finale = anime ? interpolate(image, [durationInFrames - sortie, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  const respiration = anime ? interpolate(image, [0, durationInFrames], [1, 1.04]) : 1;
  const ressort = spring({ frame: image, fps, config: { damping: 11, stiffness: 170, mass: 0.6 } });
  const entree =
    texte.apparition === "pop"
      ? { echelle: interpolate(ressort, [0, 1], [0.4, 1]), rotation: interpolate(ressort, [0, 1], [-4, 0]), opacite: Math.min(1, image / 3) }
      : texte.apparition === "fondu"
        ? { echelle: 1, rotation: 0, opacite: interpolate(image, [0, 0.3 * fps], [0, 1], { extrapolateRight: "clamp" }) }
        : { echelle: 1, rotation: 0, opacite: texte.apparition === "aucune" ? 1 : Math.min(1, image / 2) };

  const fondCouleur = texte.fond === "accent" ? style.couleurAccent : "rgba(0, 0, 0, 0.62)";
  const couleurBase = texte.fond === "accent" ? (clair(style.couleurAccent) ? "#111111" : "#FFFFFF") : (texte.couleur ?? style.couleur);
  const couleurAccent = texte.fond === "accent" ? couleurBase : style.couleurAccent;
  const contour = texte.fond === "aucun" ? { WebkitTextStroke: `${taille * 0.07}px #000000`, paintOrder: "stroke fill" } : {};

  const boite: CSSProperties = {
    display: "inline",
    padding: texte.fond === "aucun" ? 0 : "0.12em 0.38em",
    borderRadius: "0.22em",
    background: texte.fond === "aucun" ? "transparent" : fondCouleur,
    boxDecorationBreak: "clone",
    WebkitBoxDecorationBreak: "clone",
    lineHeight: texte.fond === "aucun" ? 1.08 : 1.35,
  };

  let lettresAvant = 0;
  const lettresVisibles = Math.floor((image / fps) * LETTRES_PAR_SECONDE);
  const contenu = liste.map((mot, index) => {
    const delai = index * Math.max(2, Math.round(fps * 0.1));
    const ressortMot = spring({ frame: image - delai, fps, config: { damping: 12, stiffness: 190, mass: 0.5 } });
    const douceur = spring({ frame: image - index * 2, fps, config: { damping: 200 }, durationInFrames: Math.round(0.45 * fps) });
    let transformation = "";
    let opacite = 1;
    let flou = 0;
    if (texte.apparition === "mot-a-mot") {
      transformation = `translateY(${interpolate(ressortMot, [0, 1], [0.35, 0])}em) scale(${interpolate(ressortMot, [0, 1], [0.5, 1])})`;
      opacite = Math.min(1, Math.max(0, (image - delai) / 2));
    } else if (texte.apparition === "glisse") {
      transformation = `translateY(${interpolate(douceur, [0, 1], [0.6, 0])}em)`;
      opacite = douceur;
      flou = interpolate(douceur, [0, 1], [taille * 0.08, 0]);
    }
    const lettres =
      texte.apparition === "machine"
        ? [...mot.texte].map((lettre, rang) => (
            <span key={rang} style={{ opacity: lettresAvant + rang < lettresVisibles ? 1 : 0 }}>
              {lettre}
            </span>
          ))
        : mot.texte;
    lettresAvant += [...mot.texte].length + 1;
    return (
      <span key={index}>
        <span
          style={{
            display: "inline-block",
            transform: transformation,
            opacity: opacite,
            filter: flou > 0.1 ? `blur(${flou}px)` : undefined,
            color: mot.accent ? couleurAccent : couleurBase,
          }}
        >
          {lettres}
        </span>
        {index < liste.length - 1 ? " " : ""}
      </span>
    );
  });

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: "7%",
          right: "7%",
          top: `${HAUTEUR[texte.position] * 100}%`,
          transform: `translateY(-50%) scale(${entree.echelle * respiration * (0.94 + 0.06 * finale)}) rotate(${entree.rotation}deg)`,
          opacity: entree.opacite * finale,
          textAlign: "center",
          fontFamily: famille,
          fontSize: taille,
          textShadow: texte.fond === "aucun" ? `0 ${taille * 0.05}px ${taille * 0.14}px rgba(0, 0, 0, 0.55)` : undefined,
          overflowWrap: "break-word",
          ...contour,
        }}
      >
        <span style={boite}>{contenu}</span>
      </div>
    </AbsoluteFill>
  );
}
