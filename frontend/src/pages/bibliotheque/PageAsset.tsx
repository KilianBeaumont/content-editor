import { LIBELLES_CHAINES_BIBLIOTHEQUE, LIBELLES_LANGUES, TYPES, type ElementBibliotheque } from "@editeur/shared";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { envoyerJson, lireJson, messageErreur } from "../../api.ts";
import { ApercuFichier } from "../../composants/ApercuFichier.tsx";
import { Message } from "../../composants/Message.tsx";
import { ChampsAsset, CHAMPS_VIDES, versChamps, versSaisie, type Champs } from "./ChampsAsset.tsx";

export function PageAsset() {
  const { id = "" } = useParams();
  const naviguer = useNavigate();
  const [element, setElement] = useState<ElementBibliotheque | null>(null);
  const [champs, setChamps] = useState<Champs>(CHAMPS_VIDES);
  const [message, setMessage] = useState<{ type: "ok" | "erreur"; texte: string } | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    lireJson<ElementBibliotheque>(`/api/bibliotheque/assets/${id}`)
      .then((charge) => {
        setElement(charge);
        setChamps(versChamps(charge.asset));
      })
      .catch((e: unknown) => setMessage({ type: "erreur", texte: messageErreur(e) }));
  }, [id]);

  async function enregistrer(evenement: FormEvent) {
    evenement.preventDefault();
    setEnCours(true);
    setMessage(null);
    try {
      const modifie = await envoyerJson<ElementBibliotheque>("PUT", `/api/bibliotheque/assets/${id}`, versSaisie(champs));
      setElement(modifie);
      setChamps(versChamps(modifie.asset));
      setMessage({ type: "ok", texte: "Enregistré." });
    } catch (e) {
      setMessage({ type: "erreur", texte: messageErreur(e) });
    } finally {
      setEnCours(false);
    }
  }

  async function supprimer() {
    if (element === null || !window.confirm("Mettre ce fichier à la corbeille et le retirer du catalogue ?")) return;
    try {
      await envoyerJson("DELETE", `/api/bibliotheque/assets/${id}`);
      void naviguer("/bibliotheque");
    } catch (e) {
      setMessage({ type: "erreur", texte: messageErreur(e) });
    }
  }

  const retour = (
    <p>
      <Link to="/bibliotheque">← Bibliothèque</Link>
    </p>
  );

  if (element === null) {
    return (
      <>
        {retour}
        {message ? <Message type={message.type}>{message.texte}</Message> : <p>Chargement…</p>}
      </>
    );
  }

  const { asset, statut } = element;
  const utilise = asset.utilisations.length > 0;

  return (
    <>
      {retour}
      <h1>{asset.chemin.split("/").at(-1)}</h1>

      <section className="section">
        <div className="entete-section">
          <h2>Aperçu</h2>
          <span className="carte-badges">
            <span className="badge">{LIBELLES_CHAINES_BIBLIOTHEQUE[asset.chaine]}</span>
            <span className="badge">{TYPES[asset.type].libelle}</span>
            {asset.langue !== null && <span className="badge">{LIBELLES_LANGUES[asset.langue]}</span>}
          </span>
        </div>
        <p className="section-intro">
          <code>bibliotheque/{asset.chemin}</code> · identifiant <code>{asset.id}</code>
        </p>
        {statut.problemes.length > 0 && (
          <ul className="liste-problemes">
            {statut.problemes.map((probleme) => (
              <li key={probleme}>{probleme}</li>
            ))}
          </ul>
        )}
        <ApercuFichier chemin={`bibliotheque/${asset.chemin}`} />
      </section>

      <form className="section" onSubmit={enregistrer}>
        <h2>Description</h2>
        <ChampsAsset
          champs={champs}
          surChangement={(changement) => setChamps((actuels) => ({ ...actuels, ...changement }))}
          type={asset.type}
        />
        <div className="actions">
          <button type="submit" className="bouton bouton-principal" disabled={enCours}>
            Enregistrer
          </button>
        </div>
        {message && <Message type={message.type}>{message.texte}</Message>}
      </form>

      <section className="section">
        <h2>Utilisations</h2>
        {utilise ? (
          <ul>
            {asset.utilisations.map((projet) => (
              <li key={projet}>
                <Link to={`/projets/${projet}`}>{projet}</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="note">Pas encore utilisé dans une vidéo.</p>
        )}
        <div className="actions">
          <button
            type="button"
            className="bouton bouton-danger"
            disabled={utilise}
            title={utilise ? "Un asset qui a servi dans une vidéo est conservé." : undefined}
            onClick={supprimer}
          >
            Mettre à la corbeille
          </button>
        </div>
      </section>
    </>
  );
}
