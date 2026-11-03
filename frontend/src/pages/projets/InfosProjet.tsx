import {
  DEFINITIONS_SORTIES,
  LIBELLES_GENRES,
  LIBELLES_PLATEFORMES,
  type DetailProjet,
  type FichierMedia,
  type ReponseBibliotheque,
  type ReponseFichiersProjet,
  type ReponseListeArtistes,
} from "@editeur/shared";
import { useState } from "react";
import { Link } from "react-router";
import { formaterTaille } from "../../api.ts";
import { ApercuFichier } from "../../composants/ApercuFichier.tsx";
import { Message } from "../../composants/Message.tsx";
import { dureeMedia, resumeMedia } from "../../medias.ts";
import { BadgeAccord } from "../auteurs-artistes/AuteursArtistes.tsx";
import { formaterDate } from "../TableauDeBord.tsx";

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
  if (["voix", "assets", "exports"].includes(morceaux[0] ?? "") && morceaux.length > 2) {
    return `${morceaux[0]}/${morceaux[1]}`;
  }
  return morceaux[0] ?? "racine";
}

export function ListeFichiers({ projet, fichiers }: { projet: DetailProjet; fichiers: ReponseFichiersProjet }) {
  const [selection, setSelection] = useState<string | null>(null);
  const notes = new Map(projet.metadata.fichiers.map((fichier) => [fichier.chemin, fichier.note]));
  const groupes = Map.groupBy(fichiers.fichiers, (fichier: FichierMedia) => dossierDe(fichier.chemin));
  const selectionne = fichiers.fichiers.find((fichier) => fichier.chemin === selection) ?? null;

  return (
    <>
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
                    <td className="note">{[LIBELLES_GENRES[fichier.genre], dureeMedia(fichier), resumeMedia(fichier)].filter(Boolean).join(" · ")}</td>
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
    </>
  );
}

interface ProprietesInfos {
  projet: DetailProjet;
  artistes: ReponseListeArtistes["artistes"];
  bibliotheque: ReponseBibliotheque["elements"];
}

export function InfosProjet({ projet, artistes, bibliotheque }: ProprietesInfos) {
  const { metadata } = projet;
  const { consignes, auteur, autorisation } = metadata;
  const consignesVides =
    consignes.intention.trim() === "" && consignes.dureeViseeMinutes === null && consignes.aGarder.trim() === "" && consignes.aEviter.trim() === "";

  return (
    <>
      <section className="section">
        <h2>Ce que tu veux obtenir</h2>
        <ul className="liste-sorties">
          {metadata.sorties.map((sortie) => (
            <li key={sortie}>
              <strong>{DEFINITIONS_SORTIES[sortie].libelle}</strong>
              <span className="note"> · {DEFINITIONS_SORTIES[sortie].aide}</span>
              {sortie === "formats-courts" && metadata.nombreFormatsCourts !== null && (
                <span>
                  {" "}
                  · {metadata.nombreFormatsCourts} {metadata.nombreFormatsCourts === 1 ? "extrait" : "extraits"}
                </span>
              )}
            </li>
          ))}
        </ul>
        {(metadata.description.fr || metadata.description.en) && (
          <>
            <h3>Description</h3>
            <Texte libelle="Français" valeur={metadata.description.fr} />
            <Texte libelle="Anglais" valeur={metadata.description.en} />
          </>
        )}
        <h3>Consignes de montage</h3>
        {consignesVides ? (
          <p className="note">Aucune consigne : ajoute-les avec Modifier, Claude s'en sert pour proposer le plan.</p>
        ) : (
          <>
            <Texte libelle="Intention" valeur={consignes.intention} />
            {consignes.dureeViseeMinutes !== null && <Texte libelle="Durée visée" valeur={`${String(consignes.dureeViseeMinutes).replace(".", ",")} min`} />}
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
                    <li>
                      {autorisation.obtenue ? "✓" : "✗"} Autorisation obtenue{autorisation.date && ` le ${formaterDate(autorisation.date)}`}
                    </li>
                    <li>{autorisation.lecture ? "✓" : "✗"} Lecture à voix haute</li>
                    <li>{autorisation.traductionAnglaise ? "✓" : "✗"} Traduction anglaise</li>
                    <li>{autorisation.monetisation ? "✓" : "✗"} Monétisation</li>
                    <li>
                      Plateformes :{" "}
                      {autorisation.plateformes.length === 0 ? "aucune" : autorisation.plateformes.map((plateforme) => LIBELLES_PLATEFORMES[plateforme]).join(", ")}
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
                      <Link to={`/auteurs-artistes/artistes/${idArtiste}`}>{artiste?.fiche.nom ?? idArtiste}</Link> {artiste && <BadgeAccord statut={artiste.statut} />}
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
    </>
  );
}
