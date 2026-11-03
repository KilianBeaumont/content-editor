import { tacheActive, type DetailProjet, type ElementBibliotheque, type Tache } from "@editeur/shared";
import { useState } from "react";
import { envoyerJson, messageErreur } from "../../api.ts";
import { Message } from "../../composants/Message.tsx";
import { LigneTache } from "../../composants/Taches.tsx";
import { EditeurPlan } from "./EditeurPlan.tsx";
import type { DonneesPlans } from "./usePlans.ts";

interface ProprietesPlan {
  projet: DetailProjet;
  donnees: DonneesPlans;
  taches: Tache[];
  bibliotheque: ElementBibliotheque[];
  allerA: (onglet: "analyse" | "apercu") => void;
}

export function Plan({ projet, donnees, taches, bibliotheque, allerA }: ProprietesPlan) {
  const { plans, proxies, remplacer } = donnees;
  const [consigne, setConsigne] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const tachesProjet = taches.filter((tache) => tache.type === "proposition-plan" && tache.projet === projet.id);
  const active = tachesProjet.find(tacheActive) ?? null;
  const derniere = tachesProjet[0] ?? null;

  async function proposer() {
    setErreur(null);
    try {
      await envoyerJson("POST", `/api/projets/${projet.id}/plans/proposer`, { consigne, depuis: null });
      setConsigne("");
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  const courante = plans?.versions[0] ?? null;
  const sansTranscription = projet.etape === "fichiers";
  const message = erreur ?? donnees.erreur;

  return (
    <section className="section">
      <h2>Plan de montage</h2>
      {message && <Message type="erreur">{message}</Message>}
      {courante === null ? (
        <p className="section-intro">
          Claude lit les transcriptions, les planches d'images, tes moments marqués, tes consignes et le guide de style{" "}
          <code>guides/{projet.metadata.categorie}/style.md</code>, puis propose un plan : les passages gardés, dans l'ordre, avec la raison de
          chaque choix. Tu peux ensuite tout ajuster ici. Rien n'est rendu tant que tu ne l'as pas validé.
        </p>
      ) : courante.plan === null ? (
        <Message type="erreur">{courante.erreur}</Message>
      ) : (
        <>
          <EditeurPlan projet={projet} version={courante} initial={courante.plan} proxies={proxies} bibliotheque={bibliotheque} surEnregistrement={remplacer} />
          {courante.plan.statut === "valide" && (
            <div className="appel-suite">
              <span>{courante.apercu ? `L'aperçu ${courante.version} est rendu : regarde-le et commente-le.` : "Plan validé : lance son aperçu."}</span>
              <button type="button" className="bouton bouton-principal" onClick={() => allerA("apercu")}>
                Aller à l'aperçu →
              </button>
            </div>
          )}
        </>
      )}

      {active !== null ? (
        <ul className="liste-taches">
          <LigneTache tache={active} />
        </ul>
      ) : (
        <>
          {derniere?.etat === "echouee" && (
            <ul className="liste-taches">
              <LigneTache tache={derniere} />
            </ul>
          )}
          {sansTranscription ? (
            <div className="appel-suite">
              <span>Analyse d'abord les rushes : Claude s'en sert pour proposer le plan.</span>
              <button type="button" className="bouton" onClick={() => allerA("analyse")}>
                ← Analyse
              </button>
            </div>
          ) : (
            <div className="formulaire-plan">
              <label className="champ">
                <span className="champ-libelle">{courante === null ? "Consigne pour Claude (facultatif)" : "Ce que tu veux de différent (facultatif)"}</span>
                <textarea
                  rows={2}
                  value={consigne}
                  maxLength={4000}
                  placeholder={courante === null ? "par exemple : commence par la chute du pinceau" : "par exemple : plus court, garde la scène du café"}
                  onChange={(evenement) => setConsigne(evenement.target.value)}
                />
              </label>
              <button type="button" className={courante === null ? "bouton bouton-principal" : "bouton"} onClick={() => void proposer()}>
                {courante === null ? "Proposer un plan" : courante.apercu ? "Nouvelle proposition sans commentaires" : "Demander une autre proposition à Claude"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
