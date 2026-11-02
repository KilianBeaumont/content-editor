import { LIBELLES_GENRES, type FichierInbox, type ReponseEnvoiInbox, type ReponseInbox } from "@editeur/shared";
import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { envoyerJson, formaterDuree, formaterTaille, lireJson, messageErreur } from "../../api.ts";
import { ApercuFichier } from "../../composants/ApercuFichier.tsx";
import { BarreEnvoi, useEnvoi } from "../../composants/Envoi.tsx";
import { Message } from "../../composants/Message.tsx";

interface Resultat {
  nom: string;
  erreur: string | null;
}

function urlSuppression(chemin: string): string {
  return `/api/inbox/fichiers/${chemin.split("/").map(encodeURIComponent).join("/")}`;
}

function resume(fichier: FichierInbox): string {
  const { infos } = fichier;
  if (infos === null) return "";
  const morceaux: string[] = [];
  if (infos.video !== null) {
    morceaux.push(`${infos.video.largeur}×${infos.video.hauteur}`);
    if (infos.video.imagesParSeconde !== null && fichier.genre === "video") {
      morceaux.push(`${String(infos.video.imagesParSeconde).replace(".", ",")} i/s`);
    }
  }
  if (infos.audio !== null) {
    const canaux = infos.audio.canaux === 1 ? "mono" : infos.audio.canaux === 2 ? "stéréo" : `${infos.audio.canaux} canaux`;
    morceaux.push(`son ${canaux}`);
  }
  return morceaux.join(" · ");
}

function ZoneDepot({ surFichiers }: { surFichiers: (fichiers: File[]) => void }) {
  const [survol, setSurvol] = useState(false);
  const [alerte, setAlerte] = useState<string | null>(null);

  function deposer(evenement: DragEvent) {
    evenement.preventDefault();
    setSurvol(false);
    const elements = [...evenement.dataTransfer.items];
    const dossiers = elements.filter((element) => element.webkitGetAsEntry()?.isDirectory === true).length;
    const fichiers = elements
      .filter((element) => element.kind === "file" && element.webkitGetAsEntry()?.isDirectory !== true)
      .map((element) => element.getAsFile())
      .filter((fichier) => fichier !== null);
    setAlerte(dossiers > 0 ? "Les dossiers ne sont pas pris en charge : ouvre-les et dépose les fichiers qu'ils contiennent." : null);
    if (fichiers.length > 0) surFichiers(fichiers);
  }

  return (
    <>
      <div
        className={survol ? "zone-depot zone-depot-survol" : "zone-depot"}
        onDragOver={(evenement) => {
          evenement.preventDefault();
          setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={deposer}
      >
        <p>Glisse ici tes rushes, voix, images ou textes</p>
        <label className="bouton">
          Choisir des fichiers
          <input
            type="file"
            multiple
            hidden
            onChange={(evenement) => {
              surFichiers([...(evenement.target.files ?? [])]);
              evenement.target.value = "";
            }}
          />
        </label>
      </div>
      {alerte && <Message type="alerte">{alerte}</Message>}
    </>
  );
}

export function Inbox() {
  const [reponse, setReponse] = useState<ReponseInbox | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [selection, setSelection] = useState<string | null>(null);
  const [enAttente, setEnAttente] = useState<File[]>([]);
  const [resultats, setResultats] = useState<Resultat[]>([]);
  const file = useRef<File[]>([]);
  const actif = useRef(false);
  const { progression, envoyer, annuler } = useEnvoi();

  const charger = useCallback(() => {
    lireJson<ReponseInbox>("/api/inbox")
      .then((charge) => {
        setReponse(charge);
        setErreur(null);
      })
      .catch((e: unknown) => setErreur(messageErreur(e)));
  }, []);

  useEffect(charger, [charger]);

  async function traiterFile() {
    if (actif.current) return;
    actif.current = true;
    try {
      for (let fichier = file.current.shift(); fichier !== undefined; fichier = file.current.shift()) {
        setEnAttente([...file.current]);
        const nom = fichier.name;
        try {
          const { fichier: recu } = await envoyer<ReponseEnvoiInbox>("/api/inbox", fichier);
          setResultats((actuels) => [...actuels, { nom, erreur: null }]);
          setReponse((actuelle) =>
            actuelle === null ? actuelle : { ...actuelle, fichiers: [...actuelle.fichiers, recu] },
          );
        } catch (e) {
          setResultats((actuels) => [...actuels, { nom, erreur: messageErreur(e) }]);
        }
      }
    } finally {
      actif.current = false;
      setEnAttente([]);
      charger();
    }
  }

  function ajouter(fichiers: File[]) {
    file.current.push(...fichiers);
    setEnAttente([...file.current]);
    void traiterFile();
  }

  function toutAnnuler() {
    file.current = [];
    setEnAttente([]);
    annuler();
  }

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

  const tailleEnAttente = enAttente.reduce((total, fichier) => total + fichier.size, 0);
  const libre = reponse?.espaceLibre ?? null;
  const echecs = resultats.filter((resultat) => resultat.erreur !== null);
  const selectionne = reponse?.fichiers.find((fichier) => fichier.chemin === selection) ?? null;

  return (
    <>
      <h1>Inbox</h1>
      <p className="section-intro">
        Dépose ici les fichiers bruts avant de créer un projet. Ils restent dans <code>inbox/</code>, sans être modifiés,
        jusqu'à ce que tu les ranges dans un projet.
      </p>

      <section className="section">
        <ZoneDepot surFichiers={ajouter} />
        {progression !== null && (
          <>
            <BarreEnvoi progression={progression} surAnnulation={toutAnnuler} />
            {enAttente.length > 0 && (
              <p className="note">
                Ensuite : {enAttente.length} {enAttente.length === 1 ? "fichier" : "fichiers"} ({formaterTaille(tailleEnAttente)}).
              </p>
            )}
          </>
        )}
        {libre !== null && tailleEnAttente > libre && (
          <Message type="alerte">
            Les fichiers en attente ({formaterTaille(tailleEnAttente)}) dépassent l'espace libre ({formaterTaille(libre)}).
          </Message>
        )}
        {progression === null && resultats.length > 0 && (
          <Message type={echecs.length > 0 ? "erreur" : "ok"}>
            {resultats.length - echecs.length} {resultats.length - echecs.length === 1 ? "fichier ajouté" : "fichiers ajoutés"}.
            {echecs.length > 0 && (
              <ul>
                {echecs.map((echec, index) => (
                  <li key={`${echec.nom}-${index}`}>
                    <strong>{echec.nom}</strong> : {echec.erreur}
                  </li>
                ))}
              </ul>
            )}
          </Message>
        )}
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
                    <td>{fichier.infos?.duree != null && fichier.genre !== "image" ? formaterDuree(fichier.infos.duree) : ""}</td>
                    <td>
                      {fichier.erreurAnalyse !== null && reponse.ffprobeDisponible ? (
                        <span className="badge badge-alerte" title={fichier.erreurAnalyse}>
                          Illisible
                        </span>
                      ) : (
                        resume(fichier)
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
