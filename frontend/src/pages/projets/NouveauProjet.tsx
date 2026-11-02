import {
  destinationsPossibles,
  LIBELLES_CATEGORIES,
  LIBELLES_CHAINES,
  type ReponseCreationProjet,
  type ReponseInbox,
  type SaisieProjet,
  type VerificationExport,
} from "@editeur/shared";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { envoyerFichier, envoyerJson, lireJson, messageErreur } from "../../api.ts";
import { Message } from "../../composants/Message.tsx";
import { Verification } from "../../composants/Verification.tsx";
import { ChoixFichiers, destinationParDefaut, libelleDestination, type Choix } from "./ChoixFichiers.tsx";
import { CHAMPS_AUTEUR_VIDES, SectionAuteur, type ChampsAuteur } from "./SectionAuteur.tsx";
import {
  appliquer,
  formulaireVide,
  nomDossier,
  saisieCommune,
  SectionArtistes,
  SectionAssets,
  SectionConsignes,
  SectionInfos,
  SectionSorties,
  useDonneesProjet,
  type Formulaire,
} from "./SectionsProjet.tsx";

export function NouveauProjet() {
  const [formulaire, setFormulaire] = useState<Formulaire>(formulaireVide);
  const [auteur, setAuteur] = useState<ChampsAuteur>(CHAMPS_AUTEUR_VIDES);
  const [choix, setChoix] = useState<Map<string, Choix>>(new Map());
  const [inbox, setInbox] = useState<ReponseInbox | null>(null);
  const { artistes, auteurs, chargerAuteurs, bibliotheque } = useDonneesProjet();
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [cree, setCree] = useState<ReponseCreationProjet | null>(null);
  const [erreurPreuve, setErreurPreuve] = useState<string | null>(null);
  const [verification, setVerification] = useState<VerificationExport | null>(null);

  const chargerInbox = useCallback(() => {
    lireJson<ReponseInbox>("/api/inbox")
      .then(setInbox)
      .catch((e: unknown) => setErreur(messageErreur(e)));
  }, []);

  useEffect(chargerInbox, [chargerInbox]);

  const modifier = (changement: Partial<Formulaire>) => setFormulaire((actuel) => appliquer(actuel, changement, true));

  const { chaine, anglais } = formulaire;
  const destinations = destinationsPossibles(chaine, anglais, formulaire.artistes);
  const nomsArtistes = new Map(artistes.map((artiste) => [artiste.id, artiste.fiche.nom]));

  function saisie(): SaisieProjet {
    const inboxParChemin = new Map((inbox?.fichiers ?? []).map((fichier) => [fichier.chemin, fichier]));
    return {
      ...saisieCommune(formulaire, auteur, bibliotheque),
      fichiers: [...choix].map(([chemin, { destination, note }]) => {
        const genre = inboxParChemin.get(chemin)?.genre ?? "autre";
        return { chemin, note, destination: destinations.includes(destination) ? destination : destinationParDefaut(genre, chaine) };
      }),
    };
  }

  async function creer(evenement: FormEvent) {
    evenement.preventDefault();
    setEnCours(true);
    setErreur(null);
    setErreurPreuve(null);
    try {
      const reponse = await envoyerJson<ReponseCreationProjet>("POST", "/api/projets", saisie());
      if (auteur.preuve !== null && reponse.projet.metadata.autorisation !== null) {
        try {
          await envoyerFichier(`/api/projets/${reponse.projet.id}/autorisation/preuve`, auteur.preuve);
        } catch (e) {
          setErreurPreuve(messageErreur(e));
        }
      }
      setCree(reponse);
      lireJson<VerificationExport>(`/api/projets/${reponse.projet.id}/verification`)
        .then(setVerification)
        .catch(() => setVerification(null));
      window.scrollTo({ top: 0 });
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  function recommencer() {
    setCree(null);
    setVerification(null);
    setFormulaire(formulaireVide());
    setAuteur(CHAMPS_AUTEUR_VIDES);
    setChoix(new Map());
    chargerInbox();
  }

  const parDestination = Map.groupBy(saisie().fichiers, (fichier) => fichier.destination);

  if (cree !== null) {
    const { projet, avertissements } = cree;
    return (
      <>
        <h1>Projet créé</h1>
        <section className="section">
          <h2>{projet.metadata.titre.fr}</h2>
          <p>
            Dossier : <code>{projet.chemin}</code>
          </p>
          {projet.metadata.fichiers.length > 0 ? (
            <>
              <p>Fichiers rangés :</p>
              <ul>
                {projet.metadata.fichiers.map((fichier) => (
                  <li key={fichier.chemin}>
                    <code>{fichier.chemin}</code>
                    {fichier.note && <span className="note"> · {fichier.note}</span>}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="note">Aucun fichier rangé pour l'instant.</p>
          )}
          {avertissements.length > 0 && (
            <Message type="alerte">
              <ul>
                {avertissements.map((avertissement) => (
                  <li key={avertissement}>{avertissement}</li>
                ))}
              </ul>
            </Message>
          )}
          {erreurPreuve && <Message type="erreur">Le projet est créé, mais la preuve n'a pas pu être enregistrée : {erreurPreuve}</Message>}
          <h3>Avant l'export</h3>
          {verification === null ? <p className="note">Vérification…</p> : <Verification verification={verification} />}
          <div className="actions">
            <Link className="bouton bouton-principal" to={`/projets/${projet.id}`}>
              Ouvrir le projet
            </Link>
            <button type="button" className="bouton" onClick={recommencer}>
              Créer un autre projet
            </button>
            <Link className="bouton" to="/inbox">
              Retour à l'inbox
            </Link>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <h1>Nouveau projet</h1>
      <form onSubmit={creer}>
        <SectionInfos formulaire={formulaire} modifier={modifier} chaineModifiable />
        <SectionSorties formulaire={formulaire} modifier={modifier} />
        <SectionConsignes formulaire={formulaire} modifier={modifier} />
        <ChoixFichiers
          inbox={inbox}
          surInbox={setInbox}
          recharger={chargerInbox}
          choix={choix}
          surChoix={setChoix}
          chaine={chaine}
          destinations={destinations}
          nomsArtistes={nomsArtistes}
        />
        {chaine === "recits" && (
          <SectionAuteur
            champs={auteur}
            surChangement={(changement) => setAuteur((actuel) => ({ ...actuel, ...changement }))}
            auteurs={auteurs}
            surActualiser={chargerAuteurs}
            anglais={anglais}
          />
        )}
        <SectionArtistes formulaire={formulaire} modifier={modifier} artistes={artistes} />
        <SectionAssets formulaire={formulaire} modifier={modifier} bibliotheque={bibliotheque} />

        <section className="section">
          <h2>Récapitulatif</h2>
          <p>
            <code>{nomDossier(formulaire)}</code> · {LIBELLES_CHAINES[chaine]} · {LIBELLES_CATEGORIES[formulaire.categorie]} ·{" "}
            {choix.size} {choix.size === 1 ? "fichier" : "fichiers"}
          </p>
          {parDestination.size > 0 && (
            <ul className="note">
              {[...parDestination].map(([destination, fichiers]) => (
                <li key={destination}>
                  {libelleDestination(destination, nomsArtistes)} : {fichiers.length}
                </li>
              ))}
            </ul>
          )}
          <div className="actions">
            <button type="submit" className="bouton bouton-principal" disabled={enCours}>
              {enCours ? "Création…" : "Créer le projet"}
            </button>
          </div>
          {erreur && <Message type="erreur">{erreur}</Message>}
        </section>
      </form>
    </>
  );
}
