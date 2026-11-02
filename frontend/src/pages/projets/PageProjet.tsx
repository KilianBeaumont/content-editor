import {
  DEFINITIONS_SORTIES,
  ETAPES_PROJET,
  LIBELLES_CATEGORIES,
  LIBELLES_CHAINES,
  LIBELLES_ETAPES,
  LIBELLES_GENRES,
  LIBELLES_PLATEFORMES,
  type DetailProjet,
  type FichierMedia,
  type ReponseBibliotheque,
  type ReponseFichiersProjet,
  type ReponseListeArtistes,
  type VerificationExport,
} from "@editeur/shared";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { formaterTaille, lireJson, messageErreur } from "../../api.ts";
import { ApercuFichier } from "../../composants/ApercuFichier.tsx";
import { Message } from "../../composants/Message.tsx";
import { Verification } from "../../composants/Verification.tsx";
import { dureeMedia, resumeMedia } from "../../medias.ts";
import { BadgeAccord } from "../auteurs-artistes/AuteursArtistes.tsx";
import { formaterDate } from "../TableauDeBord.tsx";

function Etapes({ etape }: { etape: DetailProjet["etape"] }) {
  const atteinte = ETAPES_PROJET.indexOf(etape);
  return (
    <ol className="etapes">
      {ETAPES_PROJET.map((element, index) => (
        <li
          key={element}
          className={index < atteinte ? "etape etape-faite" : index === atteinte ? "etape etape-actuelle" : "etape"}
        >
          {LIBELLES_ETAPES[element]}
        </li>
      ))}
    </ol>
  );
}

function Texte({ libelle, valeur }: { libelle: string; valeur: string }) {
  if (valeur.trim() === "") return null;
  return (
    <div className="bloc-texte">
      <span className="champ-libelle">{libelle}</span>
      <p>{valeur}</p>
    </div>
  );
}

function dossierDe(chemin: string): string {
  const morceaux = chemin.split("/");
  if (morceaux.length <= 1) return "racine";
  if (["voix", "assets", "exports", "versions"].includes(morceaux[0] ?? "") && morceaux.length > 2) {
    return `${morceaux[0]}/${morceaux[1]}`;
  }
  return morceaux[0] ?? "racine";
}

function Fichiers({ projet, fichiers }: { projet: DetailProjet; fichiers: ReponseFichiersProjet }) {
  const [selection, setSelection] = useState<string | null>(null);
  const notes = new Map(projet.metadata.fichiers.map((fichier) => [fichier.chemin, fichier.note]));
  const groupes = Map.groupBy(fichiers.fichiers, (fichier: FichierMedia) => dossierDe(fichier.chemin));
  const selectionne = fichiers.fichiers.find((fichier) => fichier.chemin === selection) ?? null;

  return (
    <section className="section">
      <h2>Fichiers</h2>
      {!fichiers.ffprobeDisponible && <Message type="alerte">ffprobe est introuvable : durées et résolutions indisponibles.</Message>}
      {fichiers.fichiers.length === 0 ? (
        <p className="note">Aucun fichier dans le projet.</p>
      ) : (
        [...groupes].map(([dossier, liste]) => (
          <div key={dossier} className="groupe-fichiers">
            <h3>
              <code>{dossier}/</code>
            </h3>
            <table className="tableau tableau-inbox">
              <tbody>
                {liste.map((fichier) => (
                  <tr
                    key={fichier.chemin}
                    className={fichier.chemin === selection ? "ligne-selectionnee" : undefined}
                    onClick={() => setSelection(fichier.chemin === selection ? null : fichier.chemin)}
                  >
                    <td className="cellule-nom">{fichier.chemin.slice(dossier.length + 1) || fichier.chemin}</td>
                    <td className="note">
                      {[LIBELLES_GENRES[fichier.genre], dureeMedia(fichier), resumeMedia(fichier)].filter(Boolean).join(" · ")}
                    </td>
                    <td>{notes.get(fichier.chemin) ?? ""}</td>
                    <td>{formaterTaille(fichier.taille)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
      {selectionne !== null && (
        <div className="apercu-inbox">
          <h3>{selectionne.chemin}</h3>
          {selectionne.erreurAnalyse !== null && <p className="note">{selectionne.erreurAnalyse}</p>}
          <ApercuFichier chemin={`${projet.chemin}/${selectionne.chemin}`} />
        </div>
      )}
    </section>
  );
}

export function PageProjet() {
  const { id = "" } = useParams();
  const [projet, setProjet] = useState<DetailProjet | null>(null);
  const [fichiers, setFichiers] = useState<ReponseFichiersProjet | null>(null);
  const [verification, setVerification] = useState<VerificationExport | null>(null);
  const [artistes, setArtistes] = useState<ReponseListeArtistes["artistes"]>([]);
  const [bibliotheque, setBibliotheque] = useState<ReponseBibliotheque["elements"]>([]);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    setProjet(null);
    lireJson<DetailProjet>(`/api/projets/${id}`)
      .then(setProjet)
      .catch((e: unknown) => setErreur(messageErreur(e)));
    lireJson<ReponseFichiersProjet>(`/api/projets/${id}/fichiers`)
      .then(setFichiers)
      .catch(() => setFichiers(null));
    lireJson<VerificationExport>(`/api/projets/${id}/verification`)
      .then(setVerification)
      .catch(() => setVerification(null));
    lireJson<ReponseListeArtistes>("/api/artistes")
      .then((liste) => setArtistes(liste.artistes))
      .catch(() => setArtistes([]));
    lireJson<ReponseBibliotheque>("/api/bibliotheque")
      .then((reponse) => setBibliotheque(reponse.elements))
      .catch(() => setBibliotheque([]));
  }, [id]);

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
  const { consignes, auteur, autorisation } = metadata;
  const consignesVides =
    consignes.intention.trim() === "" && consignes.dureeViseeMinutes === null && consignes.aGarder.trim() === "" && consignes.aEviter.trim() === "";

  return (
    <>
      {retour}
      <div className="entete-section">
        <div>
          <h1>{metadata.titre.fr}</h1>
          {metadata.titre.en && <p className="note titre-en">{metadata.titre.en}</p>}
        </div>
        <span className="carte-badges">
          <span className="badge">{LIBELLES_CHAINES[metadata.chaine]}</span>
          <span className="badge">{LIBELLES_CATEGORIES[metadata.categorie]}</span>
          {metadata.langues.includes("en") && <span className="badge">FR + EN</span>}
        </span>
      </div>
      <p className="section-intro">
        Publication prévue le {formaterDate(metadata.datePublicationPrevue)} · <code>{projet.chemin}</code>
      </p>

      <section className="section">
        <Etapes etape={projet.etape} />
        <p className="note">
          La proposition de plan de montage et les aperçus arrivent en phase 3. La modification du projet arrive à l'étape 10.
        </p>
      </section>

      <section className="section">
        <h2>Avant l'export</h2>
        {verification === null ? <p className="note">Vérification…</p> : <Verification verification={verification} />}
      </section>

      <section className="section">
        <h2>Ce que tu veux obtenir</h2>
        <ul className="liste-sorties">
          {metadata.sorties.map((sortie) => (
            <li key={sortie}>
              <strong>{DEFINITIONS_SORTIES[sortie].libelle}</strong>
              <span className="note"> · {DEFINITIONS_SORTIES[sortie].aide}</span>
              {sortie === "formats-courts" && metadata.nombreFormatsCourts !== null && (
                <span> · {metadata.nombreFormatsCourts} {metadata.nombreFormatsCourts === 1 ? "extrait" : "extraits"}</span>
              )}
            </li>
          ))}
        </ul>
        <h3>Consignes de montage</h3>
        {consignesVides ? (
          <p className="note">Aucune consigne.</p>
        ) : (
          <>
            <Texte libelle="Intention" valeur={consignes.intention} />
            {consignes.dureeViseeMinutes !== null && (
              <Texte libelle="Durée visée" valeur={`${String(consignes.dureeViseeMinutes).replace(".", ",")} min`} />
            )}
            <Texte libelle="À garder absolument" valeur={consignes.aGarder} />
            <Texte libelle="À éviter" valeur={consignes.aEviter} />
          </>
        )}
      </section>

      {auteur !== null && (
        <section className="section">
          <h2>Auteur et autorisation</h2>
          {auteur.estUtilisateur ? (
            <p>
              Ton histoire, signée <strong>{auteur.nom || "(signature manquante)"}</strong>.
            </p>
          ) : (
            <>
              <p>
                {auteur.id ? <Link to={`/auteurs-artistes/auteurs/${auteur.id}`}>{auteur.nom}</Link> : auteur.nom}
                {auteur.source && (
                  <>
                    {" · "}
                    <a href={auteur.source} target="_blank" rel="noreferrer">
                      histoire d'origine
                    </a>
                  </>
                )}
              </p>
              {autorisation !== null && (
                <>
                  <ul className="liste-autorisation">
                    <li>{autorisation.obtenue ? "✓" : "✗"} Autorisation obtenue{autorisation.date && ` le ${formaterDate(autorisation.date)}`}</li>
                    <li>{autorisation.lecture ? "✓" : "✗"} Lecture à voix haute</li>
                    <li>{autorisation.traductionAnglaise ? "✓" : "✗"} Traduction anglaise</li>
                    <li>{autorisation.monetisation ? "✓" : "✗"} Monétisation</li>
                    <li>
                      Plateformes :{" "}
                      {autorisation.plateformes.length === 0
                        ? "aucune"
                        : autorisation.plateformes.map((plateforme) => LIBELLES_PLATEFORMES[plateforme]).join(", ")}
                    </li>
                  </ul>
                  {autorisation.preuve !== null ? (
                    <ApercuFichier chemin={`${projet.chemin}/${autorisation.preuve}`} />
                  ) : (
                    <p className="note">Pas de preuve enregistrée.</p>
                  )}
                </>
              )}
            </>
          )}
        </section>
      )}

      {(metadata.artistes.length > 0 || metadata.assetsBibliotheque.length > 0) && (
        <section className="section">
          {metadata.artistes.length > 0 && (
            <>
              <h2>Artistes invités</h2>
              <ul>
                {metadata.artistes.map((idArtiste) => {
                  const artiste = artistes.find((element) => element.id === idArtiste);
                  return (
                    <li key={idArtiste}>
                      <Link to={`/auteurs-artistes/artistes/${idArtiste}`}>{artiste?.fiche.nom ?? idArtiste}</Link>{" "}
                      {artiste && <BadgeAccord statut={artiste.statut} />}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {metadata.assetsBibliotheque.length > 0 && (
            <>
              <h2>Assets de la bibliothèque</h2>
              <ul>
                {metadata.assetsBibliotheque.map((idAsset) => {
                  const element = bibliotheque.find(({ asset }) => asset.id === idAsset);
                  return (
                    <li key={idAsset}>
                      <Link to={`/bibliotheque/assets/${idAsset}`}>{element?.asset.chemin.split("/").at(-1) ?? idAsset}</Link>
                      {element?.asset.description && <span className="note"> · {element.asset.description}</span>}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      )}

      {fichiers === null ? <p className="note">Chargement des fichiers…</p> : <Fichiers projet={projet} fichiers={fichiers} />}
    </>
  );
}
