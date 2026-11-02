import type { ReponseListeArtistes, StatutAccord } from "@editeur/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { lireJson, messageErreur } from "../../api.ts";
import { Message } from "../../composants/Message.tsx";

export function BadgeAccord({ statut }: { statut: StatutAccord }) {
  return statut.valide ? (
    <span className="badge badge-ok">✓ Accord valide</span>
  ) : (
    <span className="badge badge-alerte" title={statut.problemes.join("\n")}>
      ✗ Accord incomplet
    </span>
  );
}

function ListeArtistes() {
  const [liste, setListe] = useState<ReponseListeArtistes | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    lireJson<ReponseListeArtistes>("/api/artistes")
      .then(setListe)
      .catch((e: unknown) => setErreur(messageErreur(e)));
  }, []);

  return (
    <section className="section">
      <div className="entete-section">
        <h2>Artistes</h2>
        <Link className="bouton bouton-principal" to="/auteurs-artistes/artistes/nouveau">
          + Nouvel artiste
        </Link>
      </div>
      <p className="section-intro">
        Les visuels d'un artiste ne peuvent être exportés que si sa fiche contient un accord daté et une preuve.
      </p>
      {erreur && <Message type="erreur">{erreur}</Message>}
      {liste === null && !erreur && <p>Chargement…</p>}
      {liste !== null && liste.artistes.length === 0 && <p className="note">Aucun artiste pour l'instant.</p>}
      {liste !== null && liste.artistes.length > 0 && (
        <table className="tableau">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Accord</th>
              <th>Monétisation</th>
              <th>Réutilisation</th>
              <th>Vidéos</th>
            </tr>
          </thead>
          <tbody>
            {liste.artistes.map((artiste) => (
              <tr key={artiste.id}>
                <td>
                  <Link to={`/auteurs-artistes/artistes/${artiste.id}`}>{artiste.fiche.nom}</Link>
                </td>
                <td>
                  <BadgeAccord statut={artiste.statut} />
                </td>
                <td>{artiste.fiche.accord.monetisation ? "Oui" : "Non"}</td>
                <td>{artiste.fiche.accord.reutilisationAutorisee ? "Oui" : "Non"}</td>
                <td>{artiste.fiche.videos.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {liste !== null && liste.illisibles.length > 0 && (
        <Message type="alerte">
          Fiches illisibles dans <code>artistes/</code>, à corriger à la main :
          <ul>
            {liste.illisibles.map((illisible) => (
              <li key={illisible.id}>
                <strong>{illisible.id}</strong> : {illisible.erreur}
              </li>
            ))}
          </ul>
        </Message>
      )}
    </section>
  );
}

export function AuteursArtistes() {
  return (
    <>
      <h1>Auteurs et artistes</h1>
      <ListeArtistes />
      <section className="section">
        <h2>Auteurs</h2>
        <p className="a-venir">Les fiches d'auteurs arrivent à l'étape 4 de la phase 1.</p>
      </section>
    </>
  );
}
