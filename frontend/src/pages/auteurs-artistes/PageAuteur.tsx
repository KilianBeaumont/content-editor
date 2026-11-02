import type { Auteur, SaisieAuteur } from "@editeur/shared";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { envoyerJson, lireJson, messageErreur } from "../../api.ts";
import { ChampTexte } from "../../composants/Champs.tsx";
import { depuisLiens, EditeurLiens, versLiens, type Lien } from "../../composants/EditeurLiens.tsx";
import { Message } from "../../composants/Message.tsx";

interface Formulaire {
  nom: string;
  contact: string;
  liens: Lien[];
}

const FORMULAIRE_VIDE: Formulaire = {
  nom: "",
  contact: "",
  liens: [{ libelle: "reddit", url: "" }],
};

function versFormulaire({ fiche }: Auteur): Formulaire {
  return { nom: fiche.nom, contact: fiche.contact, liens: versLiens(fiche.liens) };
}

function versSaisie(formulaire: Formulaire): SaisieAuteur {
  return { nom: formulaire.nom, contact: formulaire.contact, liens: depuisLiens(formulaire.liens) };
}

export function PageAuteur() {
  const { id } = useParams();
  const nouveau = id === undefined;
  const naviguer = useNavigate();
  const [auteur, setAuteur] = useState<Auteur | null>(null);
  const [formulaire, setFormulaire] = useState<Formulaire>(FORMULAIRE_VIDE);
  const [message, setMessage] = useState<{ type: "ok" | "erreur"; texte: string } | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (id === undefined) return;
    lireJson<Auteur>(`/api/auteurs/${id}`)
      .then((charge) => {
        setAuteur(charge);
        setFormulaire(versFormulaire(charge));
      })
      .catch((e: unknown) => setMessage({ type: "erreur", texte: messageErreur(e) }));
  }, [id]);

  function modifier(changement: Partial<Formulaire>) {
    setFormulaire((actuel) => ({ ...actuel, ...changement }));
  }

  async function enregistrer(evenement: FormEvent) {
    evenement.preventDefault();
    setEnCours(true);
    setMessage(null);
    try {
      if (nouveau) {
        const cree = await envoyerJson<Auteur>("POST", "/api/auteurs", versSaisie(formulaire));
        void naviguer(`/auteurs-artistes/auteurs/${cree.id}`, { replace: true });
      } else {
        const modifie = await envoyerJson<Auteur>("PUT", `/api/auteurs/${id}`, versSaisie(formulaire));
        setAuteur(modifie);
        setFormulaire(versFormulaire(modifie));
        setMessage({ type: "ok", texte: "Enregistré." });
      }
    } catch (e) {
      setMessage({ type: "erreur", texte: messageErreur(e) });
    } finally {
      setEnCours(false);
    }
  }

  async function supprimer() {
    if (auteur === null || !window.confirm(`Mettre la fiche de ${auteur.fiche.nom} à la corbeille ?`)) return;
    try {
      await envoyerJson("DELETE", `/api/auteurs/${auteur.id}`);
      void naviguer("/auteurs-artistes");
    } catch (e) {
      setMessage({ type: "erreur", texte: messageErreur(e) });
    }
  }

  const retour = (
    <p>
      <Link to="/auteurs-artistes">← Auteurs et artistes</Link>
    </p>
  );

  if (!nouveau && auteur === null) {
    return (
      <>
        {retour}
        {message ? <Message type={message.type}>{message.texte}</Message> : <p>Chargement…</p>}
      </>
    );
  }

  return (
    <>
      {retour}
      <h1>{nouveau ? "Nouvel auteur ou autrice" : auteur?.fiche.nom}</h1>

      <form className="section" onSubmit={enregistrer}>
        <h2>Fiche</h2>
        <p className="section-intro">
          L'autorisation de lire chaque récit (date, traduction, monétisation, preuve) est enregistrée dans le projet du
          récit, pas ici.
        </p>
        <ChampTexte large libelle="Nom ou pseudo" valeur={formulaire.nom} surChangement={(nom) => modifier({ nom })} />
        <ChampTexte
          large
          libelle="Contact"
          valeur={formulaire.contact}
          surChangement={(contact) => modifier({ contact })}
          aide="E-mail, compte ou autre moyen de le joindre. Reste privé."
        />
        <EditeurLiens liens={formulaire.liens} surChangement={(liens) => modifier({ liens })} />
        <div className="actions">
          <button type="submit" className="bouton bouton-principal" disabled={enCours}>
            {nouveau ? "Créer la fiche" : "Enregistrer"}
          </button>
        </div>
        {message && <Message type={message.type}>{message.texte}</Message>}
      </form>

      {auteur !== null && (
        <section className="section">
          <h2>Récits</h2>
          {auteur.fiche.recits.length === 0 ? (
            <p className="note">Aucun récit pour l'instant.</p>
          ) : (
            <ul>
              {auteur.fiche.recits.map((recit) => (
                <li key={recit}>
                  <Link to={`/projets/${recit}`}>{recit}</Link>
                </li>
              ))}
            </ul>
          )}
          <div className="actions">
            <button
              type="button"
              className="bouton bouton-danger"
              disabled={auteur.fiche.recits.length > 0}
              title={auteur.fiche.recits.length > 0 ? "La fiche d'un auteur qui a des récits est conservée." : undefined}
              onClick={supprimer}
            >
              Mettre la fiche à la corbeille
            </button>
          </div>
        </section>
      )}
    </>
  );
}
