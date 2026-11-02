import type { EtatModeleWhisper, Tache } from "@editeur/shared";
import { useCallback, useEffect, useState } from "react";
import { envoyerJson, formaterTaille, lireJson, messageErreur } from "../../api.ts";
import { Message } from "../../composants/Message.tsx";
import { LigneTache, useTaches } from "../../composants/Taches.tsx";

export function SectionTranscription() {
  const [modele, setModele] = useState<EtatModeleWhisper | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const { taches } = useTaches();
  const telechargement = taches.find((tache) => tache.type === "telechargement-modele") ?? null;
  const essai = taches.find((tache) => tache.type === "essai-transcription") ?? null;

  const charger = useCallback(() => {
    lireJson<EtatModeleWhisper>("/api/whisper/modele")
      .then(setModele)
      .catch((e: unknown) => setErreur(messageErreur(e)));
  }, []);

  useEffect(charger, [charger]);
  useEffect(() => {
    if (telechargement?.etat === "terminee") charger();
  }, [telechargement?.etat, charger]);

  async function lancer(chemin: string): Promise<Tache | null> {
    setErreur(null);
    try {
      return await envoyerJson<Tache>("POST", chemin);
    } catch (e) {
      setErreur(messageErreur(e));
      return null;
    }
  }

  const telechargementActif = telechargement?.etat === "attente" || telechargement?.etat === "en-cours";
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
        </p>
      )}
      <div className="actions">
        {modele !== null && !modele.present && (
          <button
            type="button"
            className="bouton bouton-principal"
            disabled={telechargementActif}
            onClick={() => void lancer("/api/whisper/modele/telecharger")}
          >
            Télécharger le modèle (Hugging Face)
          </button>
        )}
        <button type="button" className="bouton" disabled={essaiActif || modele?.present !== true} onClick={() => void lancer("/api/whisper/essai")}>
          Tester whisper.cpp
        </button>
      </div>
      {erreur && <Message type="erreur">{erreur}</Message>}
      {(telechargement !== null || essai !== null) && (
        <ul className="liste-taches">
          {telechargement !== null && (telechargementActif || !modele?.present) && <LigneTache tache={telechargement} />}
          {essai !== null && <LigneTache tache={essai} />}
        </ul>
      )}
    </section>
  );
}
