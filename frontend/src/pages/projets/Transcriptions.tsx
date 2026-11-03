import {
  genreFichier,
  tacheActive,
  type DetailProjet,
  type EtatTranscription,
  type ReponseTranscriptions,
  type Transcription,
} from "@editeur/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { envoyerJson, formaterDuree, lireJson, messageErreur, urlFichier } from "../../api.ts";
import { Message } from "../../composants/Message.tsx";
import { LigneTache, useTaches } from "../../composants/Taches.tsx";

const LIBELLES_ETATS: Record<EtatTranscription, { texte: string; classe: string }> = {
  absente: { texte: "À transcrire", classe: "badge" },
  "a-jour": { texte: "✓ Transcrit", classe: "badge badge-ok" },
  perimee: { texte: "Fichier modifié depuis", classe: "badge badge-alerte" },
};

const SEUIL_INCERTAIN = 0.5;

function urlTranscription(projet: string, chemin: string): string {
  return `/api/projets/${projet}/transcriptions/${chemin.split("/").map(encodeURIComponent).join("/")}`;
}

function Lecture({ projet, chemin }: { projet: DetailProjet; chemin: string }) {
  const [transcription, setTranscription] = useState<Transcription | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [temps, setTemps] = useState(0);
  const lecteur = useRef<HTMLVideoElement & HTMLAudioElement>(null);

  useEffect(() => {
    setTranscription(null);
    setErreur(null);
    lireJson<Transcription>(urlTranscription(projet.id, chemin))
      .then(setTranscription)
      .catch((e: unknown) => setErreur(messageErreur(e)));
  }, [projet.id, chemin]);

  function aller(seconde: number) {
    const element = lecteur.current;
    if (element === null) return;
    element.currentTime = seconde;
    void element.play();
  }

  const source = urlFichier(`${projet.chemin}/${chemin}`);
  const proprietes = {
    ref: lecteur,
    src: source,
    controls: true,
    preload: "metadata",
    onTimeUpdate: () => setTemps(lecteur.current?.currentTime ?? 0),
  };

  return (
    <div className="lecture-transcription">
      <div className="lecture-media">
        {genreFichier(chemin) === "video" ? <video {...proprietes} /> : <audio {...proprietes} />}
        {transcription && (
          <p className="note">
            {transcription.langue === "en" ? "Anglais" : "Français"} · modèle {transcription.modele}
            {transcription.acceleration && ` (${transcription.acceleration})`} · mots soulignés : transcription incertaine
          </p>
        )}
      </div>
      <div className="lecture-texte">
        {erreur && <Message type="erreur">{erreur}</Message>}
        {transcription === null && !erreur && <p>Chargement…</p>}
        {transcription !== null && transcription.segments.length === 0 && <p className="note">Aucune parole détectée.</p>}
        {transcription?.segments.map((segment) => (
          <p
            key={segment.debut}
            className={temps >= segment.debut && temps < segment.fin ? "segment segment-actuel" : "segment"}
            onClick={() => aller(segment.debut)}
          >
            <span className="segment-temps">{formaterDuree(segment.debut)}</span>{" "}
            {segment.mots.length === 0
              ? segment.texte
              : segment.mots.map((mot, index) => (
                  <span key={`${mot.debut}-${index}`} className={mot.probabilite < SEUIL_INCERTAIN ? "mot-incertain" : undefined}>
                    {index > 0 && " "}
                    {mot.mot}
                  </span>
                ))}
          </p>
        ))}
      </div>
    </div>
  );
}

export function Transcriptions({ projet, surChangement }: { projet: DetailProjet; surChangement: () => void }) {
  const [liste, setListe] = useState<ReponseTranscriptions | null>(null);
  const [selection, setSelection] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const { taches } = useTaches();
  const tachesProjet = taches.filter((tache) => tache.type === "transcription" && tache.projet === projet.id);
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

  async function lancer(fichiers: string[] | null) {
    setErreur(null);
    try {
      await envoyerJson("POST", `/api/projets/${projet.id}/transcriptions`, { fichiers });
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  const tacheDe = (chemin: string) => actives.find((tache) => tache.parametres.fichier === chemin);
  const dernieres = new Map<string, (typeof tachesProjet)[number]>();
  for (const tache of tachesProjet) {
    const fichier = String(tache.parametres.fichier);
    if (!dernieres.has(fichier)) dernieres.set(fichier, tache);
  }
  const echecs = [...dernieres.values()].filter((tache) => tache.etat === "echouee");
  const aFaire = (liste?.fichiers ?? []).filter((fichier) => fichier.etat !== "a-jour" && tacheDe(fichier.chemin) === undefined);

  return (
    <section className="section">
      <div className="entete-section">
        <h2>Transcriptions</h2>
        {aFaire.length > 0 && (
          <button type="button" className="bouton bouton-principal" onClick={() => void lancer(null)}>
            Transcrire {aFaire.length === 1 ? "le fichier restant" : `les ${aFaire.length} fichiers restants`}
          </button>
        )}
      </div>
      <p className="section-intro">
        whisper.cpp transcrit les rushes et les voix sur cette machine. Claude s'appuiera sur ces transcriptions pour proposer le
        plan de montage.
      </p>
      {erreur && <Message type="erreur">{erreur}</Message>}
      {liste === null && !erreur && <p>Chargement…</p>}
      {liste !== null && liste.fichiers.length === 0 && (
        <p className="note">Aucun rush ni voix à transcrire dans ce projet.</p>
      )}
      {liste !== null && liste.fichiers.length > 0 && (
        <table className="tableau tableau-inbox">
          <tbody>
            {liste.fichiers.map((fichier) => {
              const tache = tacheDe(fichier.chemin);
              const etat = LIBELLES_ETATS[fichier.etat];
              return (
                <tr key={fichier.chemin} className={fichier.chemin === selection ? "ligne-selectionnee" : undefined}>
                  <td className="cellule-nom">
                    <code>{fichier.chemin}</code>
                  </td>
                  <td>
                    <span className="badge">{fichier.langue.toUpperCase()}</span>
                  </td>
                  <td>
                    {tache ? (
                      <span className="note">
                        {tache.etat === "attente" ? "En attente" : `${tache.etape ?? "En cours"}${tache.progression !== null ? ` · ${Math.floor(tache.progression * 100)} %` : ""}`}
                      </span>
                    ) : (
                      <span className={etat.classe}>{etat.texte}</span>
                    )}
                  </td>
                  <td className="note">
                    {fichier.duree !== null && formaterDuree(fichier.duree)}
                    {fichier.nombreMots !== null && ` · ${fichier.nombreMots} mots`}
                  </td>
                  <td className="cellule-action">
                    {fichier.etat !== "absente" && (
                      <button
                        type="button"
                        className="bouton bouton-discret"
                        onClick={() => setSelection(fichier.chemin === selection ? null : fichier.chemin)}
                      >
                        {fichier.chemin === selection ? "Fermer" : "Lire"}
                      </button>
                    )}
                    {tache === undefined && (
                      <button type="button" className="bouton bouton-discret" onClick={() => void lancer([fichier.chemin])}>
                        {fichier.etat === "absente" ? "Transcrire" : "Retranscrire"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
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
      {selection !== null && <Lecture projet={projet} chemin={selection} />}
    </section>
  );
}
