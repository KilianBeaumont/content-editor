import { EXTENSIONS_PREUVE, TAILLE_MAX_PREUVE, type Artiste, type SaisieArtiste } from "@editeur/shared";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { envoyerJson, lireJson, messageErreur, verifierFichier } from "../../api.ts";
import { ApercuFichier } from "../../composants/ApercuFichier.tsx";
import { ChampTexte } from "../../composants/Champs.tsx";
import { depuisLiens, EditeurLiens, versLiens, type Lien } from "../../composants/EditeurLiens.tsx";
import { BarreEnvoi, useEnvoi } from "../../composants/Envoi.tsx";
import { Message } from "../../composants/Message.tsx";
import { BadgeAccord } from "./AuteursArtistes.tsx";

interface Formulaire {
  nom: string;
  contact: string;
  liens: Lien[];
  date: string;
  monetisation: boolean;
  reutilisationAutorisee: boolean;
}

const FORMULAIRE_VIDE: Formulaire = {
  nom: "",
  contact: "",
  liens: [{ libelle: "instagram", url: "" }],
  date: "",
  monetisation: true,
  reutilisationAutorisee: false,
};

function versFormulaire(artiste: Artiste): Formulaire {
  const { fiche } = artiste;
  return {
    nom: fiche.nom,
    contact: fiche.contact,
    liens: versLiens(fiche.liens),
    date: fiche.accord.date ?? "",
    monetisation: fiche.accord.monetisation,
    reutilisationAutorisee: fiche.accord.reutilisationAutorisee,
  };
}

function versSaisie(formulaire: Formulaire): SaisieArtiste {
  return {
    nom: formulaire.nom,
    contact: formulaire.contact,
    liens: depuisLiens(formulaire.liens),
    accord: {
      date: formulaire.date === "" ? null : formulaire.date,
      monetisation: formulaire.monetisation,
      reutilisationAutorisee: formulaire.reutilisationAutorisee,
    },
  };
}

function SectionPreuve({ artiste, surMiseAJour }: { artiste: Artiste; surMiseAJour: (artiste: Artiste) => void }) {
  const [erreur, setErreur] = useState<string | null>(null);
  const { progression, envoyer: envoyerPreuve, annuler } = useEnvoi();
  const enCours = progression !== null;
  const preuve = artiste.fiche.accord.preuve;

  async function envoyer(fichier: File | undefined) {
    if (fichier === undefined) return;
    const probleme = verifierFichier(fichier, EXTENSIONS_PREUVE, TAILLE_MAX_PREUVE);
    setErreur(probleme);
    if (probleme !== null) return;
    try {
      surMiseAJour(await envoyerPreuve<Artiste>(`/api/artistes/${artiste.id}/preuve`, fichier));
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  return (
    <section className="section">
      <div className="entete-section">
        <h2>Preuve de l'accord</h2>
        <BadgeAccord statut={artiste.statut} />
      </div>
      <p className="section-intro">
        Capture du message, e-mail ou document où l'artiste donne son accord. Les anciennes preuves restent conservées
        dans <code>artistes/{artiste.id}/accord/</code>.
      </p>
      {artiste.statut.problemes.length > 0 && (
        <ul className="liste-problemes">
          {artiste.statut.problemes.map((probleme) => (
            <li key={probleme}>{probleme}</li>
          ))}
        </ul>
      )}
      {preuve !== null && <ApercuFichier chemin={`artistes/${artiste.id}/${preuve}`} />}
      <label className="bouton">
        {enCours ? "Envoi…" : preuve === null ? "Ajouter une preuve" : "Remplacer la preuve"}
        <input
          type="file"
          accept={EXTENSIONS_PREUVE.join(",")}
          hidden
          disabled={enCours}
          onChange={(evenement) => {
            void envoyer(evenement.target.files?.[0]);
            evenement.target.value = "";
          }}
        />
      </label>
      {progression !== null && <BarreEnvoi progression={progression} surAnnulation={annuler} />}
      {erreur && <Message type="erreur">{erreur}</Message>}
    </section>
  );
}

export function PageArtiste() {
  const { id } = useParams();
  const nouveau = id === undefined;
  const naviguer = useNavigate();
  const [artiste, setArtiste] = useState<Artiste | null>(null);
  const [formulaire, setFormulaire] = useState<Formulaire>(FORMULAIRE_VIDE);
  const [message, setMessage] = useState<{ type: "ok" | "erreur"; texte: string } | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (id === undefined) return;
    lireJson<Artiste>(`/api/artistes/${id}`)
      .then((charge) => {
        setArtiste(charge);
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
        const cree = await envoyerJson<Artiste>("POST", "/api/artistes", versSaisie(formulaire));
        void naviguer(`/auteurs-artistes/artistes/${cree.id}`, { replace: true });
      } else {
        const modifie = await envoyerJson<Artiste>("PUT", `/api/artistes/${id}`, versSaisie(formulaire));
        setArtiste(modifie);
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
    if (artiste === null || !window.confirm(`Mettre la fiche de ${artiste.fiche.nom} à la corbeille ?`)) return;
    try {
      await envoyerJson("DELETE", `/api/artistes/${artiste.id}`);
      void naviguer("/auteurs-artistes");
    } catch (e) {
      setMessage({ type: "erreur", texte: messageErreur(e) });
    }
  }

  if (!nouveau && artiste === null) {
    return (
      <>
        <p>
          <Link to="/auteurs-artistes">← Auteurs et artistes</Link>
        </p>
        {message ? <Message type={message.type}>{message.texte}</Message> : <p>Chargement…</p>}
      </>
    );
  }

  return (
    <>
      <p>
        <Link to="/auteurs-artistes">← Auteurs et artistes</Link>
      </p>
      <h1>{nouveau ? "Nouvel artiste" : artiste?.fiche.nom}</h1>

      <form className="section" onSubmit={enregistrer}>
        <h2>Fiche</h2>
        <ChampTexte large libelle="Nom ou pseudo" valeur={formulaire.nom} surChangement={(nom) => modifier({ nom })} />
        <ChampTexte
          large
          libelle="Contact"
          valeur={formulaire.contact}
          surChangement={(contact) => modifier({ contact })}
          aide="E-mail, compte ou autre moyen de le joindre. Reste privé."
        />
        <EditeurLiens liens={formulaire.liens} surChangement={(liens) => modifier({ liens })} />

        <h3>Accord</h3>
        <label className="champ">
          <span className="champ-libelle">Date de l'accord</span>
          <input type="date" value={formulaire.date} onChange={(evenement) => modifier({ date: evenement.target.value })} />
        </label>
        <label className="case">
          <input
            type="checkbox"
            checked={formulaire.monetisation}
            onChange={(evenement) => modifier({ monetisation: evenement.target.checked })}
          />
          Accepte la monétisation des vidéos
        </label>
        <label className="case">
          <input
            type="checkbox"
            checked={formulaire.reutilisationAutorisee}
            onChange={(evenement) => modifier({ reutilisationAutorisee: evenement.target.checked })}
          />
          Autorise la réutilisation de ses visuels dans d'autres vidéos
        </label>

        <div className="actions">
          <button type="submit" className="bouton bouton-principal" disabled={enCours}>
            {nouveau ? "Créer la fiche" : "Enregistrer"}
          </button>
        </div>
        {message && <Message type={message.type}>{message.texte}</Message>}
      </form>

      {artiste !== null && (
        <>
          <SectionPreuve artiste={artiste} surMiseAJour={setArtiste} />

          <section className="section">
            <h2>Collaborations</h2>
            {artiste.fiche.videos.length === 0 ? (
              <p className="note">Aucune vidéo pour l'instant.</p>
            ) : (
              <ul>
                {artiste.fiche.videos.map((video) => (
                  <li key={video}>
                    <Link to={`/projets/${video}`}>{video}</Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="actions">
              <button
                type="button"
                className="bouton bouton-danger"
                disabled={artiste.fiche.videos.length > 0}
                title={artiste.fiche.videos.length > 0 ? "La fiche d'un artiste ayant participé à une vidéo est conservée." : undefined}
                onClick={supprimer}
              >
                Mettre la fiche à la corbeille
              </button>
            </div>
          </section>
        </>
      )}
    </>
  );
}
