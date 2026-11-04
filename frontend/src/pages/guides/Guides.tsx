import { estCategorieVerticale, GUIDE_ANIMATIONS, LIBELLES_SUJETS_GUIDE, type ReponseGuides, type ResumeGuide } from "@editeur/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { lireJson, messageErreur } from "../../api.ts";
import { Message } from "../../composants/Message.tsx";

function CarteGuide({ guide, detail }: { guide: ResumeGuide; detail: string }) {
  return (
    <Link className="carte-asset" to={`/guides/${guide.categorie}`}>
      <strong className="carte-titre">{LIBELLES_SUJETS_GUIDE[guide.categorie]}</strong>
      <span className="note">{detail}</span>
      <span className="note">
        {guide.videos === 0
          ? "aucune vidéo d'inspiration"
          : `${guide.videos} vidéo${guide.videos > 1 ? "s" : ""} d'inspiration, ${guide.analysees} analysée${guide.analysees > 1 ? "s" : ""}`}
      </span>
    </Link>
  );
}

export function Guides() {
  const [guides, setGuides] = useState<ReponseGuides["guides"] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    lireJson<ReponseGuides>("/api/guides")
      .then((reponse) => setGuides(reponse.guides))
      .catch((e: unknown) => setErreur(messageErreur(e)));
  }, []);

  return (
    <>
      <h1>Guides</h1>
      <p className="section-intro">
        Pour chaque catégorie : ton guide de style, tes accroches, et les vidéos que tu aimes. Chaque vidéo d'inspiration est analysée
        (rythme, coupes, débit, techniques) et Claude s'en sert pour proposer tes plans de montage.
      </p>
      {erreur && <Message type="erreur">{erreur}</Message>}
      {guides === null && !erreur && <p>Chargement…</p>}
      <div className="grille-cartes">
        {(guides ?? []).map((guide) =>
          guide.categorie === GUIDE_ANIMATIONS ? null : (
            <CarteGuide key={guide.categorie} guide={guide} detail={estCategorieVerticale(guide.categorie) ? "format vertical 9:16" : "format horizontal 16:9"} />
          ),
        )}
      </div>
      <section className="section">
        <h2>Animations</h2>
        <p className="section-intro">
          Des vidéos de motion design que tu aimes (textes animés, titres, étiquettes, transitions). Leur analyse décortique chaque mouvement
          (entrées, sorties, rebonds, décalages, typographie) et sert à créer ou améliorer les animations Remotion de l'outil ; Claude s'en sert
          aussi pour choisir les animations des textes dans tes plans.
        </p>
        <div className="grille-cartes">
          {(guides ?? [])
            .filter((guide) => guide.categorie === GUIDE_ANIMATIONS)
            .map((guide) => (
              <CarteGuide key={guide.categorie} guide={guide} detail="textes et composants animés" />
            ))}
        </div>
      </section>
    </>
  );
}
