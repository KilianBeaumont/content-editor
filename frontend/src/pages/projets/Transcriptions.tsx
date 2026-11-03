import {
  genreFichier,
  repetitionsSuspectes,
  tacheActive,
  type CorrectionSegment,
  type DetailProjet,
  type EtatTranscription,
  type FichierTranscriptible,
  type ReponseTranscriptions,
  type Transcription,
  type TypeTache,
} from "@editeur/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { envoyerJson, formaterDuree, lireJson, messageErreur, urlFichier } from "../../api.ts";
import { Message } from "../../composants/Message.tsx";
import { LigneTache, useTaches } from "../../composants/Taches.tsx";
import { Reperes } from "./Reperes.tsx";

const TYPES_ANALYSE = new Set<TypeTache>(["transcription", "preparation-rush"]);

const LIBELLES_ETATS: Record<EtatTranscription, { texte: string; classe: string }> = {
  absente: { texte: "À transcrire", classe: "badge" },
  "a-jour": { texte: "✓ Transcrit", classe: "badge badge-ok" },
  perimee: { texte: "Fichier modifié depuis", classe: "badge badge-alerte" },
};

const LIBELLES_PREPARATION: Record<EtatTranscription, { texte: string; classe: string }> = {
  absente: { texte: "Images et son à préparer", classe: "badge" },
  "a-jour": { texte: "✓ Images et son", classe: "badge badge-ok" },
  perimee: { texte: "À refaire : fichier modifié", classe: "badge badge-alerte" },
};

const SEUIL_INCERTAIN = 0.5;

function urlTranscription(projet: string, chemin: string): string {
  return `/api/projets/${projet}/transcriptions/${chemin.split("/").map(encodeURIComponent).join("/")}`;
}

interface ProprietesLecture {
  projet: DetailProjet;
  fichier: FichierTranscriptible;
  surCorrection: () => void;
}

function Lecture({ projet, fichier, surCorrection }: ProprietesLecture) {
  const { chemin } = fichier;
  const transcrit = fichier.etat !== "absente";
  const [transcription, setTranscription] = useState<Transcription | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [temps, setTemps] = useState(0);
  const [edition, setEdition] = useState<{ debut: number; texte: string } | null>(null);
  const [enCours, setEnCours] = useState(false);
  const lecteur = useRef<HTMLVideoElement & HTMLAudioElement>(null);

  useEffect(() => {
    setTranscription(null);
    setErreur(null);
    setEdition(null);
    if (!transcrit) return;
    lireJson<Transcription>(urlTranscription(projet.id, chemin))
      .then(setTranscription)
      .catch((e: unknown) => setErreur(messageErreur(e)));
  }, [projet.id, chemin, transcrit]);

  function aller(seconde: number) {
    const element = lecteur.current;
    if (element === null) return;
    element.currentTime = seconde;
    void element.play();
  }

  async function corriger(corrections: CorrectionSegment[]) {
    setEnCours(true);
    setErreur(null);
    try {
      setTranscription(await envoyerJson<Transcription>("PUT", urlTranscription(projet.id, chemin), { corrections }));
      setEdition(null);
      surCorrection();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  const proxy = fichier.preparation === "a-jour" ? fichier.proxy : null;
  const source = urlFichier(`${projet.chemin}/${proxy ?? chemin}`);
  const proprietes = {
    ref: lecteur,
    src: source,
    controls: true,
    preload: "metadata",
    onTimeUpdate: () => setTemps(lecteur.current?.currentTime ?? 0),
  };
  const segments = transcription?.segments ?? [];
  const suspects = new Set(repetitionsSuspectes(segments).map((index) => segments[index]?.debut ?? -1));

  return (
    <div className="lecture-transcription">
      <div className="lecture-media">
        {genreFichier(chemin) === "video" ? <video {...proprietes} /> : <audio {...proprietes} />}
        {transcription && (
          <p className="note">
            {transcription.langue === "en" ? "Anglais" : "Français"} · modèle {transcription.modele}
            {transcription.acceleration && ` (${transcription.acceleration})`}
            {transcription.vad && " · détection de la parole"}
            {transcription.vocabulaire && ` · vocabulaire : ${transcription.vocabulaire}`}
            <br />
            Mots soulignés : transcription incertaine. Survole une phrase pour la corriger ou la supprimer.
          </p>
        )}
        {proxy !== null && <p className="note">Lecture du proxy basse résolution : le rush d'origine n'est pas modifié.</p>}
        <Reperes projet={projet.id} source={chemin} tempsActuel={() => lecteur.current?.currentTime ?? 0} aller={aller} />
        {fichier.planches.length > 0 && (
          <details className="planches">
            <summary>Planches d'images ({fichier.planches.length}) : ce que Claude peut voir du rush</summary>
            {fichier.planches.map((planche) => (
              <a key={planche} href={urlFichier(`${projet.chemin}/${planche}`)} target="_blank" rel="noreferrer">
                <img src={urlFichier(`${projet.chemin}/${planche}`)} alt={planche.split("/").at(-1)} loading="lazy" />
              </a>
            ))}
          </details>
        )}
      </div>
      <div className="lecture-texte">
        {erreur && <Message type="erreur">{erreur}</Message>}
        {!transcrit && <p className="note">Pas encore transcrit.</p>}
        {transcrit && transcription === null && !erreur && <p>Chargement…</p>}
        {transcription !== null && segments.length === 0 && <p className="note">Aucune parole détectée.</p>}
        {suspects.size > 0 && (
          <Message type="alerte">
            {suspects.size === 1 ? "1 phrase répétée" : `${suspects.size} phrases répétées`} à la suite : sans doute une erreur de
            transcription.{" "}
            <button
              type="button"
              className="bouton bouton-discret"
              disabled={enCours}
              onClick={() => void corriger([...suspects].map((debut) => ({ debut, texte: null })))}
            >
              Supprimer les répétitions
            </button>
          </Message>
        )}
        {segments.map((segment) => {
          if (edition?.debut === segment.debut) {
            const enregistrer = () => void corriger([{ debut: segment.debut, texte: edition.texte }]);
            return (
              <div key={segment.debut} className="segment segment-edition">
                <span className="segment-temps">{formaterDuree(segment.debut)}</span>
                <textarea
                  rows={2}
                  autoFocus
                  value={edition.texte}
                  onChange={(evenement) => setEdition({ debut: segment.debut, texte: evenement.target.value })}
                  onKeyDown={(evenement) => {
                    if (evenement.key === "Escape") setEdition(null);
                    if (evenement.key === "Enter" && !evenement.shiftKey) {
                      evenement.preventDefault();
                      enregistrer();
                    }
                  }}
                />
                <span className="ligne-actions">
                  <button type="button" className="bouton bouton-principal bouton-discret" disabled={enCours} onClick={enregistrer}>
                    Enregistrer
                  </button>
                  <button type="button" className="bouton bouton-discret" onClick={() => setEdition(null)}>
                    Annuler
                  </button>
                  <span className="note">Entrée pour enregistrer, Échap pour annuler. Texte vide : la phrase est supprimée.</span>
                </span>
              </div>
            );
          }
          const actuel = temps >= segment.debut && temps < segment.fin;
          const classes = ["segment", actuel ? "segment-actuel" : "", suspects.has(segment.debut) ? "segment-suspect" : ""]
            .filter((classe) => classe !== "")
            .join(" ");
          return (
            <div key={segment.debut} className={classes} onClick={() => aller(segment.debut)}>
              <span className="segment-temps">{formaterDuree(segment.debut)}</span>{" "}
              {segment.mots.length === 0 || segment.corrige
                ? segment.texte
                : segment.mots.map((mot, index) => (
                    <span key={`${mot.debut}-${index}`} className={mot.probabilite < SEUIL_INCERTAIN ? "mot-incertain" : undefined}>
                      {index > 0 && " "}
                      {mot.mot}
                    </span>
                  ))}
              {segment.corrige && <span className="badge segment-badge">corrigé</span>}
              <span className="segment-actions">
                <button
                  type="button"
                  className="bouton bouton-discret"
                  onClick={(evenement) => {
                    evenement.stopPropagation();
                    setEdition({ debut: segment.debut, texte: segment.texte });
                  }}
                >
                  Corriger
                </button>
                <button
                  type="button"
                  className="bouton bouton-discret"
                  disabled={enCours}
                  onClick={(evenement) => {
                    evenement.stopPropagation();
                    void corriger([{ debut: segment.debut, texte: null }]);
                  }}
                >
                  Supprimer
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Transcriptions({ projet, surChangement }: { projet: DetailProjet; surChangement: () => void }) {
  const [liste, setListe] = useState<ReponseTranscriptions | null>(null);
  const [selection, setSelection] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const { taches } = useTaches();
  const tachesProjet = taches.filter((tache) => TYPES_ANALYSE.has(tache.type) && tache.projet === projet.id);
  const actives = tachesProjet.filter(tacheActive);
  const nombreActives = actives.length;
  const precedent = useRef(nombreActives);

  const charger = useCallback(() => {
    lireJson<ReponseTranscriptions>(`/api/projets/${projet.id}/transcriptions`)
      .then(setListe)
      .catch((e: unknown) => setErreur(messageErreur(e)));
  }, [projet.id]);

  useEffect(charger, [charger]);
  useEffect(() => {
    if (nombreActives < precedent.current) {
      charger();
      surChangement();
    }
    precedent.current = nombreActives;
  }, [nombreActives, charger, surChangement]);

  async function lancer(type: "transcriptions" | "preparations", fichiers: string[] | null) {
    setErreur(null);
    try {
      await envoyerJson("POST", `/api/projets/${projet.id}/${type}`, { fichiers });
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  async function analyser() {
    await lancer("transcriptions", null);
    await lancer("preparations", null);
  }

  const tacheDe = (type: TypeTache, chemin: string) => actives.find((tache) => tache.type === type && tache.parametres.fichier === chemin);
  const dernieres = new Map<string, (typeof tachesProjet)[number]>();
  for (const tache of tachesProjet) {
    const cle = `${tache.type} ${String(tache.parametres.fichier)}`;
    if (!dernieres.has(cle)) dernieres.set(cle, tache);
  }
  const echecs = [...dernieres.values()].filter((tache) => tache.etat === "echouee");
  const aFaire = (liste?.fichiers ?? []).filter(
    (fichier) =>
      (fichier.etat !== "a-jour" && tacheDe("transcription", fichier.chemin) === undefined) ||
      (fichier.preparation !== "a-jour" && tacheDe("preparation-rush", fichier.chemin) === undefined),
  );
  const selectionne = liste?.fichiers.find((fichier) => fichier.chemin === selection) ?? null;

  function etatTache(type: TypeTache, chemin: string, etat: EtatTranscription, libelles: Record<EtatTranscription, { texte: string; classe: string }>) {
    const tache = tacheDe(type, chemin);
    if (tache === undefined) return <span className={libelles[etat].classe}>{libelles[etat].texte}</span>;
    const progression = tache.progression !== null ? ` · ${Math.floor(tache.progression * 100)} %` : "";
    return <span className="note">{tache.etat === "attente" ? "En attente" : `${tache.etape ?? "En cours"}${progression}`}</span>;
  }

  return (
    <section className="section">
      <div className="entete-section">
        <h2>Analyse des rushes</h2>
        {aFaire.length > 0 && (
          <button type="button" className="bouton bouton-principal" onClick={() => void analyser()}>
            Analyser {aFaire.length === 1 ? "le fichier restant" : `les ${aFaire.length} fichiers restants`}
          </button>
        )}
      </div>
      <p className="section-intro">
        Sur cette machine, whisper.cpp transcrit les rushes et les voix, et ffmpeg prépare un proxy léger pour la lecture, des planches
        d'images et la mesure du son (silences, pics). Claude s'appuie sur tout cela, et sur les moments que tu marques, pour proposer le
        plan de montage.
      </p>
      {erreur && <Message type="erreur">{erreur}</Message>}
      {liste === null && !erreur && <p>Chargement…</p>}
      {liste !== null && liste.fichiers.length === 0 && <p className="note">Aucun rush ni voix à analyser dans ce projet.</p>}
      {liste !== null && liste.fichiers.length > 0 && (
        <table className="tableau tableau-inbox">
          <tbody>
            {liste.fichiers.map((fichier) => (
              <tr key={fichier.chemin} className={fichier.chemin === selection ? "ligne-selectionnee" : undefined}>
                <td className="cellule-nom">
                  <code>{fichier.chemin}</code>
                </td>
                <td>
                  <span className="badge">{fichier.langue.toUpperCase()}</span>
                </td>
                <td>
                  {etatTache("transcription", fichier.chemin, fichier.etat, LIBELLES_ETATS)}
                  <br />
                  {etatTache("preparation-rush", fichier.chemin, fichier.preparation, LIBELLES_PREPARATION)}
                </td>
                <td className="note">
                  {fichier.duree !== null && formaterDuree(fichier.duree)}
                  {fichier.nombreMots !== null && ` · ${fichier.nombreMots} mots`}
                  {fichier.corrigee && " · corrigé"}
                  {fichier.planches.length > 0 && ` · ${fichier.planches.length} planche${fichier.planches.length > 1 ? "s" : ""}`}
                </td>
                <td className="cellule-action">
                  {(fichier.etat !== "absente" || fichier.preparation !== "absente") && (
                    <button
                      type="button"
                      className="bouton bouton-discret"
                      onClick={() => setSelection(fichier.chemin === selection ? null : fichier.chemin)}
                    >
                      {fichier.chemin === selection ? "Fermer" : "Lire"}
                    </button>
                  )}
                  {tacheDe("transcription", fichier.chemin) === undefined && (
                    <button
                      type="button"
                      className="bouton bouton-discret"
                      onClick={() => {
                        const perte = "Ce fichier a été corrigé à la main : retranscrire effacera tes corrections. Continuer ?";
                        if (!fichier.corrigee || window.confirm(perte)) void lancer("transcriptions", [fichier.chemin]);
                      }}
                    >
                      {fichier.etat === "absente" ? "Transcrire" : "Retranscrire"}
                    </button>
                  )}
                  {tacheDe("preparation-rush", fichier.chemin) === undefined && (
                    <button type="button" className="bouton bouton-discret" onClick={() => void lancer("preparations", [fichier.chemin])}>
                      {fichier.preparation === "absente" ? "Préparer" : "Refaire la préparation"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {actives.length > 0 && (
        <ul className="liste-taches">
          {actives.map((tache) => (
            <LigneTache key={tache.id} tache={tache} />
          ))}
        </ul>
      )}
      {echecs.length > 0 && (
        <ul className="liste-taches">
          {echecs.slice(0, 3).map((tache) => (
            <LigneTache key={tache.id} tache={tache} />
          ))}
        </ul>
      )}
      {selectionne !== null && <Lecture projet={projet} fichier={selectionne} surCorrection={charger} />}
    </section>
  );
}
