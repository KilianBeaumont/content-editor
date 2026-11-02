import { LIBELLES_GENRES, type FichierInbox, type ReponseInbox } from "@editeur/shared";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { envoyerJson, formaterTaille, lireJson, messageErreur } from "../../api.ts";
import { ApercuFichier } from "../../composants/ApercuFichier.tsx";
import { SuiviEnvois, useEnvoisInbox, ZoneDepot } from "../../composants/EnvoisInbox.tsx";
import { Message } from "../../composants/Message.tsx";
import { dureeMedia, resumeMedia } from "../../medias.ts";

function urlSuppression(chemin: string): string {
  return `/api/inbox/fichiers/${chemin.split("/").map(encodeURIComponent).join("/")}`;
}

export function Inbox() {
  const [reponse, setReponse] = useState<ReponseInbox | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [selection, setSelection] = useState<string | null>(null);

  const charger = useCallback(() => {
    lireJson<ReponseInbox>("/api/inbox")
      .then((charge) => {
        setReponse(charge);
        setErreur(null);
      })
      .catch((e: unknown) => setErreur(messageErreur(e)));
  }, []);

  useEffect(charger, [charger]);

  const envois = useEnvoisInbox(
    (recu) => setReponse((actuelle) => (actuelle === null ? actuelle : { ...actuelle, fichiers: [...actuelle.fichiers, recu] })),
    charger,
  );

  async function mettreALaCorbeille(fichier: FichierInbox) {
    if (!window.confirm(`Mettre ${fichier.chemin} à la corbeille ?`)) return;
    try {
      await envoyerJson("DELETE", urlSuppression(fichier.chemin));
      if (selection === fichier.chemin) setSelection(null);
      charger();
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  const libre = reponse?.espaceLibre ?? null;
  const selectionne = reponse?.fichiers.find((fichier) => fichier.chemin === selection) ?? null;

  return (
    <>
      <div className="entete-section">
        <h1>Inbox</h1>
        <Link className="bouton bouton-principal" to="/nouveau-projet">
          Créer un projet avec ces fichiers
        </Link>
      </div>
      <p className="section-intro">
        Dépose ici les fichiers bruts avant de créer un projet. Ils restent dans <code>inbox/</code>, sans être modifiés,
        jusqu'à ce que tu les ranges dans un projet.
      </p>

      <section className="section">
        <ZoneDepot surFichiers={envois.ajouter} texte="Glisse ici tes rushes, voix, images ou textes" />
        <SuiviEnvois envois={envois} espaceLibre={libre} />
      </section>

      {erreur && <Message type="erreur">{erreur}</Message>}
      {reponse === null && !erreur && <p>Chargement…</p>}

      {reponse !== null && (
        <section className="section">
          <div className="entete-section">
            <h2>
              {reponse.fichiers.length} {reponse.fichiers.length === 1 ? "fichier" : "fichiers"}
            </h2>
            <span className="note">
              {libre !== null && <>Espace libre : {formaterTaille(libre)} · </>}
              <button type="button" className="bouton bouton-discret" onClick={charger}>
                Actualiser
              </button>
            </span>
          </div>
          {!reponse.ffprobeDisponible && (
            <Message type="alerte">ffprobe est introuvable : durées et résolutions indisponibles. Vérifie son chemin dans Paramètres.</Message>
          )}
          {reponse.fichiers.length === 0 ? (
            <p className="note">L'inbox est vide.</p>
          ) : (
            <table className="tableau tableau-inbox">
              <thead>
                <tr>
                  <th>Fichier</th>
                  <th>Type</th>
                  <th>Durée</th>
                  <th>Détails</th>
                  <th>Taille</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {reponse.fichiers.map((fichier) => (
                  <tr
                    key={fichier.chemin}
                    className={fichier.chemin === selection ? "ligne-selectionnee" : undefined}
                    onClick={() => setSelection(fichier.chemin === selection ? null : fichier.chemin)}
                  >
                    <td className="cellule-nom">{fichier.chemin}</td>
                    <td>{LIBELLES_GENRES[fichier.genre]}</td>
                    <td>{dureeMedia(fichier)}</td>
                    <td>
                      {fichier.erreurAnalyse !== null && reponse.ffprobeDisponible ? (
                        <span className="badge badge-alerte" title={fichier.erreurAnalyse}>
                          Illisible
                        </span>
                      ) : (
                        resumeMedia(fichier)
                      )}
                    </td>
                    <td>{formaterTaille(fichier.taille)}</td>
                    <td className="cellule-action">
                      <button
                        type="button"
                        className="bouton bouton-discret"
                        onClick={(evenement) => {
                          evenement.stopPropagation();
                          void mettreALaCorbeille(fichier);
                        }}
                      >
                        Corbeille
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {selectionne !== null && (
            <div className="apercu-inbox">
              <h3>{selectionne.chemin}</h3>
              {selectionne.erreurAnalyse !== null && <p className="note">{selectionne.erreurAnalyse}</p>}
              {selectionne.infos?.video && (
                <p className="note">
                  Vidéo {selectionne.infos.video.codec} · Audio {selectionne.infos.audio?.codec ?? "aucun"}
                  {selectionne.infos.audio?.frequence ? ` · ${selectionne.infos.audio.frequence / 1000} kHz` : ""}
                </p>
              )}
              <ApercuFichier chemin={`inbox/${selectionne.chemin}`} />
            </div>
          )}
        </section>
      )}
    </>
  );
}
