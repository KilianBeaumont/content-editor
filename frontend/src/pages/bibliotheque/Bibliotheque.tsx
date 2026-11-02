import {
  CHAINES_BIBLIOTHEQUE,
  LIBELLES_CHAINES_BIBLIOTHEQUE,
  TYPES,
  TYPES_ASSET,
  type ElementBibliotheque,
  type ReponseBibliotheque,
} from "@editeur/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { lireJson, messageErreur } from "../../api.ts";
import { ApercuFichier } from "../../composants/ApercuFichier.tsx";
import { Message } from "../../composants/Message.tsx";
import { etiquettesDe } from "./ChampsAsset.tsx";

function nomFichier(chemin: string): string {
  return chemin.split("/").at(-1) ?? chemin;
}

function CarteAsset({ element }: { element: ElementBibliotheque }) {
  const { asset, statut } = element;
  return (
    <Link className="carte-asset" to={`/bibliotheque/assets/${asset.id}`}>
      <ApercuFichier compact chemin={`bibliotheque/${asset.chemin}`} />
      <span className="carte-titre">{nomFichier(asset.chemin)}</span>
      <span className="carte-badges">
        <span className="badge">{LIBELLES_CHAINES_BIBLIOTHEQUE[asset.chaine]}</span>
        <span className="badge">{TYPES[asset.type].libelle}</span>
        {asset.langue !== null && <span className="badge">{asset.langue.toUpperCase()}</span>}
        {!statut.valide && (
          <span className="badge badge-alerte" title={statut.problemes.join("\n")}>
            ✗ À vérifier
          </span>
        )}
      </span>
      {asset.description && <span className="carte-description">{asset.description}</span>}
      {asset.etiquettes.length > 0 && (
        <span className="etiquettes">
          {asset.etiquettes.map((etiquette) => (
            <span key={etiquette} className="etiquette">
              {etiquette}
            </span>
          ))}
        </span>
      )}
      <span className="note">
        {asset.utilisations.length === 0
          ? "Jamais utilisé"
          : `Utilisé dans ${asset.utilisations.length} ${asset.utilisations.length === 1 ? "vidéo" : "vidéos"}`}
      </span>
    </Link>
  );
}

export function Bibliotheque() {
  const [reponse, setReponse] = useState<ReponseBibliotheque | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chaine, setChaine] = useState("");
  const [type, setType] = useState("");
  const [recherche, setRecherche] = useState("");
  const [etiquette, setEtiquette] = useState<string | null>(null);

  useEffect(() => {
    lireJson<ReponseBibliotheque>("/api/bibliotheque")
      .then(setReponse)
      .catch((e: unknown) => setErreur(messageErreur(e)));
  }, []);

  const texte = recherche.trim().toLowerCase();
  const elements = (reponse?.elements ?? []).filter(
    ({ asset }) =>
      (chaine === "" || asset.chaine === chaine) &&
      (type === "" || asset.type === type) &&
      (etiquette === null || asset.etiquettes.includes(etiquette)) &&
      (texte === "" || `${asset.chemin} ${asset.description}`.toLowerCase().includes(texte)),
  );

  return (
    <>
      <div className="entete-section">
        <h1>Bibliothèque</h1>
        <Link className="bouton bouton-principal" to="/bibliotheque/nouveau">
          + Ajouter un asset
        </Link>
      </div>
      <p className="section-intro">
        Ce qui sert dans plusieurs vidéos : polices, images, vidéos, musiques, ambiances, sons ponctuels et voix.
      </p>

      {erreur && <Message type="erreur">{erreur}</Message>}
      {reponse === null && !erreur && <p>Chargement…</p>}

      {reponse !== null && (
        <>
          <div className="filtres">
            <select value={chaine} onChange={(evenement) => setChaine(evenement.target.value)} aria-label="Chaîne">
              <option value="">Toutes les chaînes</option>
              {CHAINES_BIBLIOTHEQUE.map((element) => (
                <option key={element} value={element}>
                  {LIBELLES_CHAINES_BIBLIOTHEQUE[element]}
                </option>
              ))}
            </select>
            <select value={type} onChange={(evenement) => setType(evenement.target.value)} aria-label="Type">
              <option value="">Tous les types</option>
              {TYPES_ASSET.map((element) => (
                <option key={element} value={element}>
                  {TYPES[element].libelle}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Rechercher…"
              value={recherche}
              onChange={(evenement) => setRecherche(evenement.target.value)}
            />
          </div>
          {etiquettesDe(reponse).length > 0 && (
            <div className="etiquettes etiquettes-filtre">
              {etiquettesDe(reponse).map((element) => (
                <button
                  key={element}
                  type="button"
                  className={element === etiquette ? "etiquette etiquette-bouton etiquette-active" : "etiquette etiquette-bouton"}
                  aria-pressed={element === etiquette}
                  onClick={() => setEtiquette(element === etiquette ? null : element)}
                >
                  {element}
                </button>
              ))}
            </div>
          )}

          {reponse.elements.length === 0 && <p className="note">La bibliothèque est vide pour l'instant.</p>}
          {reponse.elements.length > 0 && elements.length === 0 && <p className="note">Aucun asset ne correspond.</p>}
          <div className="grille-assets">
            {elements.map((element) => (
              <CarteAsset key={element.asset.id} element={element} />
            ))}
          </div>

          {reponse.invalides.length > 0 && (
            <Message type="alerte">
              Entrées de <code>bibliotheque/catalogue.json</code> ignorées, à corriger à la main :
              <ul>
                {reponse.invalides.map((invalide) => (
                  <li key={invalide.position}>
                    <strong>
                      n° {invalide.position + 1}
                      {invalide.id !== null && ` (${invalide.id})`}
                    </strong>{" "}
                    : {invalide.erreur}
                  </li>
                ))}
              </ul>
            </Message>
          )}

          {reponse.nonCatalogues.length > 0 && (
            <section className="section section-espacee">
              <h2>Fichiers hors catalogue</h2>
              <p className="section-intro">
                Présents dans <code>bibliotheque/</code> mais pas encore décrits : Claude ne les proposera pas au montage.
              </p>
              <table className="tableau">
                <tbody>
                  {reponse.nonCatalogues.map((chemin) => (
                    <tr key={chemin}>
                      <td>
                        <code>{chemin}</code>
                      </td>
                      <td className="cellule-action">
                        <Link className="bouton bouton-discret" to={`/bibliotheque/nouveau?chemin=${encodeURIComponent(chemin)}`}>
                          Ajouter au catalogue
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </>
  );
}
