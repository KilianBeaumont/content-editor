import {
  estCategorieVerticale,
  LIBELLES_CATEGORIES,
  LIBELLES_CHAINES,
  type DetailProjet,
  type ReponseBibliotheque,
  type ReponseFichiersProjet,
  type ReponseListeArtistes,
  type VerificationExport,
} from "@editeur/shared";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { envoyerJson, lireJson, messageErreur } from "../../api.ts";
import { Message } from "../../composants/Message.tsx";
import { useTaches } from "../../composants/Taches.tsx";
import { Verification } from "../../composants/Verification.tsx";
import { formaterDate } from "../TableauDeBord.tsx";
import { AjoutFichiers } from "./AjoutFichiers.tsx";
import { Apercu } from "./Apercu.tsx";
import { Export } from "./Export.tsx";
import { ExtraitsCourts } from "./ExtraitsCourts.tsx";
import { InfosProjet, ListeFichiers } from "./InfosProjet.tsx";
import type { EtatRetourProjet } from "./ModifierProjet.tsx";
import { estOnglet, NavigationEtapes, ongletSuggere, OngletsProjet, type Onglet } from "./OngletsProjet.tsx";
import { Plan } from "./Plan.tsx";
import { Transcriptions } from "./Transcriptions.tsx";
import { usePlans } from "./usePlans.ts";

export function PageProjet() {
  const { id = "" } = useParams();
  const [projet, setProjet] = useState<DetailProjet | null>(null);
  const [fichiers, setFichiers] = useState<ReponseFichiersProjet | null>(null);
  const [verification, setVerification] = useState<VerificationExport | null>(null);
  const [artistes, setArtistes] = useState<ReponseListeArtistes["artistes"]>([]);
  const [bibliotheque, setBibliotheque] = useState<ReponseBibliotheque["elements"]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ajout, setAjout] = useState(false);
  const [parametres, setParametres] = useSearchParams();
  const naviguer = useNavigate();
  const { state } = useLocation();
  const avertissements = (state as EtatRetourProjet | null)?.avertissements ?? [];
  const { taches } = useTaches();

  const charger = useCallback(() => {
    lireJson<DetailProjet>(`/api/projets/${id}`)
      .then(setProjet)
      .catch((e: unknown) => setErreur(messageErreur(e)));
    lireJson<ReponseFichiersProjet>(`/api/projets/${id}/fichiers`)
      .then(setFichiers)
      .catch(() => setFichiers(null));
    lireJson<VerificationExport>(`/api/projets/${id}/verification`)
      .then(setVerification)
      .catch(() => setVerification(null));
  }, [id]);

  const donneesPlans = usePlans(id, taches, charger);

  useEffect(() => {
    setProjet(null);
    charger();
    lireJson<ReponseListeArtistes>("/api/artistes")
      .then((liste) => setArtistes(liste.artistes))
      .catch(() => setArtistes([]));
    lireJson<ReponseBibliotheque>("/api/bibliotheque")
      .then((reponse) => setBibliotheque(reponse.elements))
      .catch(() => setBibliotheque([]));
  }, [charger]);

  const choisir = useCallback(
    (onglet: Onglet) => {
      setParametres({ etape: onglet }, { replace: true, state });
      window.scrollTo({ top: 0 });
    },
    [setParametres, state],
  );

  async function mettreALaCorbeille() {
    if (projet === null) return;
    const message = `Mettre « ${projet.metadata.titre.fr} » à la corbeille ? Le dossier entier, rushes compris, sera déplacé dans corbeille/projets/.`;
    if (!window.confirm(message)) return;
    try {
      await envoyerJson("DELETE", `/api/projets/${projet.id}`);
      void naviguer("/");
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  const retour = (
    <p>
      <Link to="/">← Tableau de bord</Link>
    </p>
  );

  if (projet === null) {
    return (
      <>
        {retour}
        {erreur ? <Message type="erreur">{erreur}</Message> : <p>Chargement…</p>}
      </>
    );
  }

  const { metadata } = projet;
  const demande = parametres.get("etape");
  const actif: Onglet = estOnglet(demande) ? demande : ongletSuggere(projet.etape);
  const exportBloque = verification !== null && !verification.exportable;

  return (
    <>
      {retour}
      <div className="entete-section">
        <div>
          <h1>{metadata.titre.fr}</h1>
          {metadata.titre.en && <p className="note titre-en">{metadata.titre.en}</p>}
        </div>
        <span className="ligne-actions">
          <Link className="bouton" to={`/projets/${projet.id}/modifier`}>
            Modifier
          </Link>
        </span>
      </div>
      <p className="carte-badges">
        <span className="badge">{LIBELLES_CHAINES[metadata.chaine]}</span>
        <span className="badge">{LIBELLES_CATEGORIES[metadata.categorie]}</span>
        {metadata.langues.includes("en") && <span className="badge">FR + EN</span>}
        {metadata.futurRoman && <span className="badge badge-alerte">Futur roman : extraits seulement</span>}
        {metadata.parent !== null && (
          <Link className="badge" to={`/projets/${metadata.parent}?etape=export`}>
            Extrait de {metadata.parent}
          </Link>
        )}
        {exportBloque && (
          <button type="button" className="badge badge-erreur badge-bouton" onClick={() => choisir("validation")}>
            Export bloqué : voir pourquoi
          </button>
        )}
        <span className="note">
          Publication prévue le {formaterDate(metadata.datePublicationPrevue)} · <code>{projet.chemin}</code>
        </span>
      </p>
      {avertissements.length > 0 && (
        <Message type="alerte">
          <ul>
            {avertissements.map((avertissement) => (
              <li key={avertissement}>{avertissement}</li>
            ))}
          </ul>
        </Message>
      )}
      {erreur && <Message type="erreur">{erreur}</Message>}

      <OngletsProjet etape={projet.etape} actif={actif} choisir={choisir} />

      {actif === "fichiers" && (
        <>
          <InfosProjet projet={projet} artistes={artistes} bibliotheque={bibliotheque} />
          <section className="section">
            <div className="entete-section">
              <h2>Fichiers</h2>
              <button type="button" className="bouton" onClick={() => setAjout(true)}>
                Ajouter des fichiers
              </button>
            </div>
            {fichiers === null ? <p className="note">Chargement des fichiers…</p> : <ListeFichiers projet={projet} fichiers={fichiers} />}
          </section>
          {ajout && (
            <AjoutFichiers
              projet={projet}
              nomsArtistes={new Map(artistes.map((artiste) => [artiste.id, artiste.fiche.nom]))}
              surAjout={charger}
              surFermeture={() => setAjout(false)}
            />
          )}
          <section className="section">
            <h2>Corbeille</h2>
            <p className="section-intro">
              Déplace le dossier entier du projet dans <code>corbeille/projets/</code>, rushes compris. Rien n'est effacé : tu peux le remettre
              à la main dans <code>{projet.chemin.split("/")[0]}/</code>.
            </p>
            <button type="button" className="bouton bouton-danger" onClick={() => void mettreALaCorbeille()}>
              Mettre le projet à la corbeille
            </button>
          </section>
        </>
      )}

      {actif === "analyse" && <Transcriptions projet={projet} surChangement={charger} />}

      {actif === "plan" && <Plan projet={projet} donnees={donneesPlans} taches={taches} allerA={choisir} />}

      {actif === "apercu" && (
        <Apercu projet={projet} versions={donneesPlans.plans?.versions ?? []} taches={taches} surChangement={charger} allerA={choisir} />
      )}

      {actif === "validation" && (
        <section className="section">
          <h2>Validation</h2>
          {metadata.versionValidee === null ? (
            <div className="appel-suite">
              <span>Aucune version validée : regarde l'aperçu et valide la version qui te convient.</span>
              <button type="button" className="bouton" onClick={() => choisir("apercu")}>
                ← Aperçu
              </button>
            </div>
          ) : (
            <div className="appel-suite">
              <span>
                Version validée : <strong>{metadata.versionValidee}</strong>. C'est elle qui sera rendue en pleine qualité.
              </span>
              <button type="button" className="bouton bouton-principal" disabled={exportBloque} onClick={() => choisir("export")}>
                Export →
              </button>
            </div>
          )}
          <h3>Avant l'export</h3>
          {verification === null ? <p className="note">Vérification…</p> : <Verification verification={verification} />}
        </section>
      )}

      {actif === "export" && (
        <>
          <Export projet={projet} taches={taches} surChangement={charger} allerA={choisir} />
          {!estCategorieVerticale(metadata.categorie) && metadata.sorties.includes("formats-courts") && (
            <ExtraitsCourts projet={projet} taches={taches} proxies={donneesPlans.proxies} />
          )}
        </>
      )}

      <NavigationEtapes actif={actif} choisir={choisir} />
    </>
  );
}
