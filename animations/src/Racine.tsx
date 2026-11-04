import { Composition, registerRoot } from "remotion";
import { ID_TEXTE, dureeEnImages, type ProprietesCompositionTexte } from "./compositions.ts";
import { TexteAnime } from "./TexteAnime.tsx";

const EXEMPLE: ProprietesCompositionTexte = {
  texte: { texte: "Trois *outils* indispensables", debut: 0, fin: 2.5, position: "haut", taillePourcent: 10, couleur: null, apparition: "pop", fond: "aucun" },
  style: { couleur: "#FFFFFF", couleurAccent: "#FFD43B", police: null },
  largeur: 1080,
  hauteur: 1920,
  ips: 30,
};

function CompositionTexte({ texte, style }: ProprietesCompositionTexte) {
  return <TexteAnime texte={texte} style={style} />;
}

function Racine() {
  return (
    <Composition
      id={ID_TEXTE}
      component={CompositionTexte}
      defaultProps={EXEMPLE}
      width={EXEMPLE.largeur}
      height={EXEMPLE.hauteur}
      fps={EXEMPLE.ips}
      durationInFrames={dureeEnImages(EXEMPLE.texte, EXEMPLE.ips)}
      calculateMetadata={({ props }) => ({ width: props.largeur, height: props.hauteur, fps: props.ips, durationInFrames: dureeEnImages(props.texte, props.ips) })}
    />
  );
}

registerRoot(Racine);
