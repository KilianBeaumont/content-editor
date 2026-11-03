import { CHAINES, DEFINITIONS_SORTIES, LIBELLES_CHAINES, SORTIES, type Chaine, type ElementExport, type ReponseExportsGlobaux } from "@editeur/shared";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { envoyerJson, formaterTaille, lireJson, messageErreur, urlFichier } from "../../api.ts";
import { Message } from "../../composants/Message.tsx";
import { formaterDate } from "../TableauDeBord.tsx";

type FiltrePublication = "tous" | "a-publier" | "publies";

function minutes(secondes: number | null): string {
  if (secondes === null) return "?";
  return `${Math.floor(secondes / 60)}:${String(Math.round(secondes % 60)).padStart(2, "0")}`;
}

export function Exports() {
  const [elements, setElements] = useState<ElementExport[] | null>(null);
  const [chaine, setChaine] = useState<Chaine | "toutes">("toutes");
  const [publication, setPublication] = useState<FiltrePublication>("a-publier");
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(() => {
    lireJson<ReponseExportsGlobaux>("/api/exports")
      .then((reponse) => setElements(reponse.elements))
      .catch((e: unknown) => setErreur(messageErreur(e)));
  }, []);
  useEffect(charger, [charger]);

  async function publier(element: ElementExport, publie: boolean) {
    setErreur(null);
    try {
      await envoyerJson("POST", `/api/projets/${element.projet.id}/exports/${element.fiche.sortie}/publication`, { publie });
      charger();
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  const filtres = (elements ?? []).filter(
    (element) =>
      (chaine === "toutes" || element.projet.chaine === chaine) &&
      (publication === "tous" || (publication === "publies") === (element.fiche.publieLe !== null)),
  );
  const parSortie = SORTIES.map((sortie) => ({
    sortie,
    liste: filtres
      .filter((element) => element.fiche.sortie === sortie)
      .sort((a, b) => a.projet.datePublicationPrevue.localeCompare(b.projet.datePublicationPrevue)),
  })).filter(({ liste }) => liste.length > 0);

  return (
    <>
      <h1>Exports</h1>
      <p className="section-intro">
        Les fichiers prêts à publier, rangés par plateforme. Publie-les toi-même, puis coche « publié ». L'export d'un projet se lance depuis son
        onglet Export.
      </p>
      <div className="filtres">
        <label>
          Chaîne{" "}
          <select value={chaine} onChange={(evenement) => setChaine(evenement.target.value as Chaine | "toutes")}>
            <option value="toutes">Toutes</option>
            {CHAINES.map((element) => (
              <option key={element} value={element}>
                {LIBELLES_CHAINES[element]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Afficher{" "}
          <select value={publication} onChange={(evenement) => setPublication(evenement.target.value as FiltrePublication)}>
            <option value="a-publier">À publier</option>
            <option value="publies">Déjà publiés</option>
            <option value="tous">Tous</option>
          </select>
        </label>
      </div>
      {erreur && <Message type="erreur">{erreur}</Message>}
      {elements === null && !erreur && <p>Chargement…</p>}
      {elements !== null && parSortie.length === 0 && (
        <p className="note">{elements.length === 0 ? "Aucun export pour l'instant." : "Rien à afficher avec ces filtres."}</p>
      )}
      {parSortie.map(({ sortie, liste }) => (
        <section key={sortie} className="section">
          <h2>
            {DEFINITIONS_SORTIES[sortie].libelle} <span className="note">· {DEFINITIONS_SORTIES[sortie].aide}</span>
          </h2>
          <table className="tableau tableau-exports">
            <thead>
              <tr>
                <th>Projet</th>
                <th>Publication prévue</th>
                <th>Fichier</th>
                <th>Publié</th>
              </tr>
            </thead>
            <tbody>
              {liste.map((element) => {
                const { projet, fiche } = element;
                const url = urlFichier(`${projet.chemin}/${fiche.fichier}`);
                const perime = projet.versionValidee !== null && projet.versionValidee !== fiche.version;
                return (
                  <tr key={`${projet.id}-${fiche.sortie}`}>
                    <td>
                      <Link to={`/projets/${projet.id}?etape=export`}>{projet.titre}</Link>
                      <br />
                      <span className="note">{LIBELLES_CHAINES[projet.chaine]}</span>
                    </td>
                    <td>{formaterDate(projet.datePublicationPrevue)}</td>
                    <td>
                      <a href={url} target="_blank" rel="noreferrer">
                        Ouvrir
                      </a>
                      {" · "}
                      <a href={url} download={fiche.fichier.split("/").at(-1)}>
                        Télécharger
                      </a>
                      <br />
                      <span className="note">
                        {fiche.version} · {fiche.largeur}x{fiche.hauteur} · {minutes(fiche.duree)} · {formaterTaille(fiche.taille)}
                      </span>
                      {perime && <span className="badge badge-alerte">version {projet.versionValidee} validée depuis</span>}
                      {fiche.controles.length > 0 && <span className="badge badge-alerte">{fiche.controles.length} point(s) à vérifier</span>}
                    </td>
                    <td>
                      <label>
                        <input type="checkbox" checked={fiche.publieLe !== null} onChange={(evenement) => void publier(element, evenement.target.checked)} />
                        {fiche.publieLe !== null && <span className="note"> {formaterDate(fiche.publieLe.slice(0, 10))}</span>}
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
    </>
  );
}
