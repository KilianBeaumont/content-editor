import { dureeEnImages, TexteAnime } from "@editeur/animations";
import type { StyleTextes, TexteEcran } from "@editeur/shared";
import { Player } from "@remotion/player";

const IMAGES_PAR_SECONDE = 30;

export default function ApercuTexte({ texte, style, vertical }: { texte: TexteEcran; style: StyleTextes; vertical: boolean }) {
  return (
    <div className={vertical ? "apercu-texte apercu-texte-vertical" : "apercu-texte"}>
      <Player
        component={TexteAnime}
        inputProps={{ texte, style }}
        durationInFrames={dureeEnImages(texte, IMAGES_PAR_SECONDE) + IMAGES_PAR_SECONDE / 2}
        fps={IMAGES_PAR_SECONDE}
        compositionWidth={vertical ? 1080 : 1920}
        compositionHeight={vertical ? 1920 : 1080}
        style={{ width: "100%" }}
        autoPlay
        loop
        controls
        acknowledgeRemotionLicense
      />
    </div>
  );
}
