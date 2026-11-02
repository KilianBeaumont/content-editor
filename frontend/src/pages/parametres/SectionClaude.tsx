import type { FenetreLimite, ResultatTestClaude } from "@editeur/shared";
import { useState } from "react";
import { envoyerJson, messageErreur } from "../../api.ts";
import { Message } from "../../composants/Message.tsx";

const LIBELLES_FENETRES: Record<string, string> = {
  five_hour: "Sur 5 heures",
  seven_day: "Sur 7 jours",
};

const formatDate = new Intl.DateTimeFormat("fr-FR", { weekday: "long", hour: "2-digit", minute: "2-digit" });

function Fenetre({ fenetre }: { fenetre: FenetreLimite }) {
  const pourcentage = Math.round(fenetre.utilisation * 100);
  return (
    <li>
      {LIBELLES_FENETRES[fenetre.nom] ?? fenetre.nom} : {pourcentage} % utilisés, réinitialisation{" "}
      {formatDate.format(new Date(fenetre.reinitialisation))}
      {fenetre.statut !== "allowed" && <strong> (limite atteinte)</strong>}
    </li>
  );
}

function Resultat({ resultat }: { resultat: ResultatTestClaude }) {
  const secondes = (resultat.dureeMs / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  return (
    <>
      {resultat.abonnement === false && (
        <Message type="alerte">
          Une clé API est utilisée (source : {resultat.sourceCle}) : les appels seraient facturés à l'usage. Retire-la
          de l'environnement pour revenir à l'abonnement.
        </Message>
      )}
      {resultat.limiteAtteinte && (
        <Message type="alerte">Limite d'usage atteinte : relance plus tard (voir les réinitialisations ci-dessous).</Message>
      )}
      {resultat.ok ? (
        <Message type="ok">
          Claude répond « {resultat.reponse} » en {secondes} s
          {resultat.modele && <> (modèle {resultat.modele})</>}.
          {resultat.abonnement === true && <> Connexion par l'abonnement, aucune clé API utilisée.</>}
        </Message>
      ) : (
        <Message type="erreur">{resultat.erreur}</Message>
      )}
      {resultat.limites && resultat.limites.fenetres.length > 0 && (
        <ul className="liste-limites">
          {resultat.limites.fenetres.map((fenetre) => (
            <Fenetre key={fenetre.nom} fenetre={fenetre} />
          ))}
        </ul>
      )}
    </>
  );
}

export function SectionClaude() {
  const [resultat, setResultat] = useState<ResultatTestClaude | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function tester() {
    setEnCours(true);
    setErreur(null);
    setResultat(null);
    try {
      setResultat(await envoyerJson<ResultatTestClaude>("POST", "/api/diagnostic/claude"));
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <section className="section">
      <h2>Claude</h2>
      <p className="section-intro">
        Envoie une question minimale à Claude Code pour vérifier qu'il répond et qu'il utilise bien ton abonnement. Le
        test compte, très peu, dans tes limites d'usage.
      </p>
      <div className="actions">
        <button type="button" className="bouton bouton-principal" disabled={enCours} onClick={tester}>
          {enCours ? "Test en cours…" : "Tester la connexion"}
        </button>
      </div>
      {resultat && <Resultat resultat={resultat} />}
      {erreur && <Message type="erreur">{erreur}</Message>}
    </section>
  );
}
