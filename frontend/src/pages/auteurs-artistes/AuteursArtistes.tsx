import type { FicheIllisible, ReponseListeArtistes, ReponseListeAuteurs, StatutAccord } from "@editeur/shared";
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

function useListe<T>(url: string): { liste: T | null; erreur: string | null } {
  const [liste, setListe] = useState<T | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    lireJson<T>(url)
      .then(setListe)
      .catch((e: unknown) => setErreur(messageErreur(e)));
  }, [url]);

  return { liste, erreur };
}

function FichesIllisibles({ dossier, illisibles }: { dossier: string; illisibles: FicheIllisible[] }) {
  if (illisibles.length === 0) return null;
  return (
    <Message type="alerte">
      Fiches illisibles dans <code>{dossier}/</code>, à corriger à la main :
      <ul>
        {illisibles.map((illisible) => (
          <li key={illisible.id}>
            <strong>{illisible.id}</strong> : {illisible.erreur}
          </li>
        ))}
      </ul>
    </Message>
  );
}

function ListeArtistes() {
  const { liste, erreur } = useListe<ReponseListeArtistes>("/api/artistes");

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
      {liste !== null && <FichesIllisibles dossier="artistes" illisibles={liste.illisibles} />}
    </section>
  );
}

function ListeAuteurs() {
  const { liste, erreur } = useListe<ReponseListeAuteurs>("/api/auteurs");

  return (
    <section className="section">
      <div className="entete-section">
        <h2>Auteurs et autrices</h2>
        <Link className="bouton bouton-principal" to="/auteurs-artistes/auteurs/nouveau">
          + Nouvel auteur
        </Link>
      </div>
      <p className="section-intro">
        L'autorisation de chaque récit (avec sa preuve) se renseigne dans le projet du récit.
      </p>
      {erreur && <Message type="erreur">{erreur}</Message>}
      {liste === null && !erreur && <p>Chargement…</p>}
      {liste !== null && liste.auteurs.length === 0 && <p className="note">Aucun auteur pour l'instant.</p>}
      {liste !== null && liste.auteurs.length > 0 && (
        <table className="tableau">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Liens</th>
              <th>Récits</th>
            </tr>
          </thead>
          <tbody>
            {liste.auteurs.map((auteur) => (
              <tr key={auteur.id}>
                <td>
                  <Link to={`/auteurs-artistes/auteurs/${auteur.id}`}>{auteur.fiche.nom}</Link>
                </td>
                <td>{Object.keys(auteur.fiche.liens).join(", ")}</td>
                <td>{auteur.fiche.recits.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {liste !== null && <FichesIllisibles dossier="auteurs" illisibles={liste.illisibles} />}
    </section>
  );
}

export function AuteursArtistes() {
  return (
    <>
      <h1>Auteurs et artistes</h1>
      <ListeAuteurs />
      <ListeArtistes />
    </>
  );
}
