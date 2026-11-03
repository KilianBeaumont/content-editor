import { estCategorieVerticale, LIBELLES_CATEGORIES, type ReponseGuides } from "@editeur/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { lireJson, messageErreur } from "../../api.ts";
import { Message } from "../../composants/Message.tsx";

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
        {(guides ?? []).map((guide) => (
          <Link key={guide.categorie} className="carte-asset" to={`/guides/${guide.categorie}`}>
            <strong className="carte-titre">{LIBELLES_CATEGORIES[guide.categorie]}</strong>
            <span className="note">{estCategorieVerticale(guide.categorie) ? "format vertical 9:16" : "format horizontal 16:9"}</span>
            <span className="note">
              {guide.videos === 0
                ? "aucune vidéo d'inspiration"
                : `${guide.videos} vidéo${guide.videos > 1 ? "s" : ""} d'inspiration, ${guide.analysees} analysée${guide.analysees > 1 ? "s" : ""}`}
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
