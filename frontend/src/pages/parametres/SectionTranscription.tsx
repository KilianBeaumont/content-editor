import type { EtatModeleWhisper, Tache } from "@editeur/shared";
import { useCallback, useEffect, useState } from "react";
import { envoyerJson, formaterTaille, lireJson, messageErreur } from "../../api.ts";
import { Message } from "../../composants/Message.tsx";
import { LigneTache, useTaches } from "../../composants/Taches.tsx";

export function SectionTranscription() {
  const [modele, setModele] = useState<EtatModeleWhisper | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const { taches } = useTaches();
  const telechargements = taches.filter((tache) => tache.type === "telechargement-modele").slice(0, 2);
  const etatsTelechargements = telechargements.map((tache) => tache.etat).join(",");
  const essai = taches.find((tache) => tache.type === "essai-transcription") ?? null;

  const charger = useCallback(() => {
    lireJson<EtatModeleWhisper>("/api/whisper/modele")
      .then(setModele)
      .catch((e: unknown) => setErreur(messageErreur(e)));
  }, []);

  useEffect(charger, [charger]);
  useEffect(() => {
    if (etatsTelechargements.includes("terminee")) charger();
  }, [etatsTelechargements, charger]);

  async function lancer(chemin: string): Promise<Tache | null> {
    setErreur(null);
    try {
      return await envoyerJson<Tache>("POST", chemin);
    } catch (e) {
      setErreur(messageErreur(e));
      return null;
    }
  }

  const telechargementActif = telechargements.some((tache) => tache.etat === "attente" || tache.etat === "en-cours");
  const manquant = modele !== null && (!modele.present || !modele.vad.present);
  const essaiActif = essai?.etat === "attente" || essai?.etat === "en-cours";

  return (
    <section className="section">
      <h2>Transcription</h2>
      <p className="section-intro">
        whisper.cpp transcrit les rushes et les voix sur cette machine, sans passer par internet ni par l'abonnement Claude. Le
        modèle se choisit dans les réglages communs ci-dessous.
      </p>
      {modele === null ? (
        <p>Chargement…</p>
      ) : (
        <p>
          Modèle <strong>{modele.nom}</strong> :{" "}
          {modele.present ? (
            <span className="badge badge-ok">✓ présent{modele.taille !== null && ` (${formaterTaille(modele.taille)})`}</span>
          ) : (
            <span className="badge badge-alerte">✗ absent</span>
          )}
          <br />
          <code className="note">{modele.chemin}</code>
          <br />
          Détection de la parole :{" "}
          {modele.vad.present ? (
            <span className="badge badge-ok">✓ présente</span>
          ) : (
            <span className="badge badge-alerte">✗ absente</span>
          )}{" "}
          <span className="note">évite que whisper invente ou répète du texte pendant la musique, les bruits ou les silences.</span>
        </p>
      )}
      <div className="actions">
        {manquant && (
          <button
            type="button"
            className="bouton bouton-principal"
            disabled={telechargementActif}
            onClick={() => void lancer("/api/whisper/modele/telecharger")}
          >
            {modele.present ? "Télécharger la détection de la parole (1 Mo)" : "Télécharger les modèles (Hugging Face)"}
          </button>
        )}
        <button type="button" className="bouton" disabled={essaiActif || modele?.present !== true} onClick={() => void lancer("/api/whisper/essai")}>
          Tester whisper.cpp
        </button>
      </div>
      {erreur && <Message type="erreur">{erreur}</Message>}
      {(telechargements.length > 0 || essai !== null) && (
        <ul className="liste-taches">
          {(telechargementActif || manquant) && telechargements.map((tache) => <LigneTache key={tache.id} tache={tache} />)}
          {essai !== null && <LigneTache tache={essai} />}
        </ul>
      )}
    </section>
  );
}
