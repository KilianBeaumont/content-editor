import {
  LIBELLES_CATEGORIES,
  LIBELLES_CHAINES,
  LIBELLES_ETAPES,
  type ReponseInbox,
  type ReponseListeProjets,
  type ResumeProjet,
  tacheActive,
} from "@editeur/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { envoyerJson, lireJson, messageErreur } from "../api.ts";
import { Message } from "../composants/Message.tsx";
import { ListeTaches, useTaches } from "../composants/Taches.tsx";

const JOUR = 24 * 3600 * 1000;

function aujourdhui(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function echeance(date: string): string {
  const jours = Math.round((Date.parse(date) - Date.parse(aujourdhui())) / JOUR);
  if (jours === 0) return "aujourd'hui";
  if (jours === 1) return "demain";
  if (jours > 1) return `dans ${jours} jours`;
  return jours === -1 ? "hier" : `il y a ${-jours} jours`;
}

export function formaterDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long" });
}

export function BadgeEtape({ etape }: { etape: ResumeProjet["etape"] }) {
  return <span className={`badge badge-etape badge-etape-${etape}`}>{LIBELLES_ETAPES[etape]}</span>;
}

export function TableauDeBord() {
  const [liste, setListe] = useState<ReponseListeProjets | null>(null);
  const [inbox, setInbox] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const { taches } = useTaches();
  const actives = taches.filter(tacheActive);
  const recentes = taches.filter((tache) => !tacheActive(tache)).slice(0, 5);

  useEffect(() => {
    lireJson<ReponseListeProjets>("/api/projets")
      .then(setListe)
      .catch((e: unknown) => setErreur(`Backend injoignable : ${messageErreur(e)}`));
    lireJson<ReponseInbox>("/api/inbox")
      .then((reponse) => setInbox(reponse.fichiers.length))
      .catch(() => setInbox(null));
  }, []);

  const jour = aujourdhui();
  const enCours = (liste?.projets ?? []).filter((projet) => projet.etape !== "exporte");
  const prochaines = enCours.filter((projet) => projet.datePublicationPrevue >= jour).slice(0, 5);
  const enRetard = enCours.filter((projet) => projet.datePublicationPrevue < jour);

  return (
    <>
      <div className="entete-section">
        <h1>Tableau de bord</h1>
        <span className="ligne-actions">
          <Link className="bouton" to="/inbox">
            Inbox{inbox !== null && ` (${inbox})`}
          </Link>
          <Link className="bouton bouton-principal" to="/nouveau-projet">
            + Nouveau projet
          </Link>
        </span>
      </div>

      {erreur && <Message type="erreur">{erreur}</Message>}
      {liste === null && !erreur && <p>Chargement…</p>}

      {liste !== null && (
        <>
          <section className="section">
            <h2>Prochaines publications</h2>
            {prochaines.length === 0 ? (
              <p className="note">Aucune publication prévue.</p>
            ) : (
              <ul className="liste-publications">
                {prochaines.map((projet) => (
                  <li key={projet.id}>
                    <span className="publication-date">
                      {formaterDate(projet.datePublicationPrevue)}
                      <span className="note"> · {echeance(projet.datePublicationPrevue)}</span>
                    </span>
                    <Link to={`/projets/${projet.id}`}>{projet.titre.fr}</Link>
                    <span className="badge">{LIBELLES_CHAINES[projet.chaine]}</span>
                    <BadgeEtape etape={projet.etape} />
                  </li>
                ))}
              </ul>
            )}
            {enRetard.length > 0 && (
              <Message type="alerte">
                {enRetard.length === 1 ? "1 projet a dépassé" : `${enRetard.length} projets ont dépassé`} sa date de publication sans
                être exporté : {enRetard.map((projet) => projet.titre.fr).join(", ")}.
              </Message>
            )}
          </section>

          <section className="section">
            <h2>Projets en cours</h2>
            {enCours.length === 0 ? (
              <p className="note">
                Aucun projet en cours. Dépose des rushes dans l'<Link to="/inbox">inbox</Link>, puis crée un projet.
              </p>
            ) : (
              <table className="tableau">
                <thead>
                  <tr>
                    <th>Projet</th>
                    <th>Chaîne</th>
                    <th>Catégorie</th>
                    <th>Publication</th>
                    <th>Étape</th>
                  </tr>
                </thead>
                <tbody>
                  {enCours.map((projet) => (
                    <tr key={projet.id}>
                      <td>
                        <Link to={`/projets/${projet.id}`}>{projet.titre.fr}</Link>
                      </td>
                      <td>{LIBELLES_CHAINES[projet.chaine]}</td>
                      <td>{LIBELLES_CATEGORIES[projet.categorie]}</td>
                      <td>{formaterDate(projet.datePublicationPrevue)}</td>
                      <td>
                        <BadgeEtape etape={projet.etape} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {liste.illisibles.length > 0 && (
              <Message type="alerte">
                Dossiers de projet illisibles, à corriger à la main :
                <ul>
                  {liste.illisibles.map((illisible) => (
                    <li key={illisible.chemin}>
                      <code>{illisible.chemin}</code> : {illisible.erreur}
                    </li>
                  ))}
                </ul>
              </Message>
            )}
          </section>

          <section className="section">
            <h2>Tâches en cours</h2>
            <ListeTaches taches={actives} vide="Aucune tâche en cours." />
            {recentes.length > 0 && (
              <>
                <div className="entete-section">
                  <h3>Terminées récemment</h3>
                  <button type="button" className="bouton bouton-discret" onClick={() => void envoyerJson("DELETE", "/api/taches/terminees")}>
                    Effacer l'historique
                  </button>
                </div>
                <ListeTaches taches={recentes} vide="" />
              </>
            )}
          </section>
        </>
      )}
    </>
  );
}
