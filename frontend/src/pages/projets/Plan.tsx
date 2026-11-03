import { dureePlan, tacheActive, type DetailProjet, type ProblemePlan, type ReponsePlans, type VersionPlan } from "@editeur/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { envoyerJson, lireJson, messageErreur } from "../../api.ts";
import { Message } from "../../composants/Message.tsx";
import { LigneTache, useTaches } from "../../composants/Taches.tsx";

function temps(secondes: number): string {
  const minutes = Math.floor(secondes / 60);
  return `${minutes}:${(secondes - minutes * 60).toFixed(1).replace(".", ",").padStart(4, "0")}`;
}

function nomFichier(chemin: string): string {
  return chemin.split("/").at(-1) ?? chemin;
}

function Problemes({ problemes }: { problemes: ProblemePlan[] }) {
  const erreurs = problemes.filter((probleme) => probleme.niveau === "erreur");
  const avertissements = problemes.filter((probleme) => probleme.niveau === "avertissement");
  const liste = (elements: ProblemePlan[]) => (
    <ul>
      {elements.map((probleme, index) => (
        <li key={`${probleme.segment ?? "-"}-${index}`}>
          {probleme.segment !== null && <strong>{probleme.segment} : </strong>}
          {probleme.message}
        </li>
      ))}
    </ul>
  );
  return (
    <>
      {erreurs.length > 0 && <Message type="erreur">À corriger avant l'aperçu :{liste(erreurs)}</Message>}
      {avertissements.length > 0 && <Message type="alerte">{liste(avertissements)}</Message>}
    </>
  );
}

function DetailPlan({ version, dureeVisee }: { version: VersionPlan; dureeVisee: number | null }) {
  const { plan } = version;
  if (plan === null) return <Message type="erreur">{version.erreur}</Message>;
  const total = dureePlan(plan);
  const parSegment = new Map(version.problemes.filter((probleme) => probleme.segment !== null).map((probleme) => [probleme.segment, probleme]));

  return (
    <>
      <p className="carte-badges">
        <span className="badge">{plan.version}</span>
        <span className={plan.statut === "valide" ? "badge badge-ok" : "badge"}>{plan.statut === "valide" ? "Validé" : "Proposé"}</span>
        {plan.modifieLe !== null && <span className="badge">Modifié à la main</span>}
        <span className="note">
          {plan.segments.length} segment{plan.segments.length > 1 ? "s" : ""} · {temps(total)}
          {dureeVisee !== null && ` pour ${temps(dureeVisee * 60)} visées`} · proposé le{" "}
          {new Date(plan.creeLe).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
        </span>
      </p>
      <Problemes problemes={version.problemes} />
      <div className="bloc-texte">
        <span className="champ-libelle">Stratégie</span>
        <p>{plan.resume}</p>
      </div>
      <div className="bloc-texte">
        <span className="champ-libelle">Accroche ({plan.hook.segment})</span>
        <p>{plan.hook.explication}</p>
      </div>
      {plan.pointsAVerifier.length > 0 && (
        <Message type="alerte">
          Claude signale :
          <ul>
            {plan.pointsAVerifier.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </Message>
      )}
      <table className="tableau tableau-plan">
        <thead>
          <tr>
            <th>#</th>
            <th>Source</th>
            <th>Passage</th>
            <th>Rôle</th>
            <th>Ce qui est dit</th>
            <th>Pourquoi</th>
          </tr>
        </thead>
        <tbody>
          {plan.segments.map((segment) => (
            <tr key={segment.id} className={parSegment.get(segment.id)?.niveau === "erreur" ? "ligne-erreur" : undefined}>
              <td>{segment.id}</td>
              <td className="cellule-nom" title={segment.source}>
                {nomFichier(segment.source)}
              </td>
              <td className="cellule-temps">
                {temps(segment.debut)} → {temps(segment.fin)}
                <br />
                <span className="note">{(segment.fin - segment.debut).toFixed(1).replace(".", ",")} s</span>
              </td>
              <td>{segment.role}</td>
              <td className="cellule-citation">{segment.citation === "" ? <span className="note">—</span> : `« ${segment.citation} »`}</td>
              <td>{segment.raison}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {plan.musiques.length > 0 && (
        <>
          <h3>Musique</h3>
          <ul>
            {plan.musiques.map((musique, index) => (
              <li key={`${musique.reference}-${index}`}>
                <strong>{musique.origine === "projet" ? nomFichier(musique.reference) : musique.reference}</strong> de {temps(musique.debut)} à{" "}
                {musique.fin === null ? "la fin" : temps(musique.fin)}, {musique.volumeDb} dB
                {musique.baisseSousVoix && ", baissée sous la voix"}
                {musique.raison && <span className="note"> · {musique.raison}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

export function Plan({ projet, surChangement }: { projet: DetailProjet; surChangement: () => void }) {
  const [plans, setPlans] = useState<ReponsePlans | null>(null);
  const [consigne, setConsigne] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const { taches } = useTaches();
  const tachesProjet = taches.filter((tache) => tache.type === "proposition-plan" && tache.projet === projet.id);
  const active = tachesProjet.find(tacheActive) ?? null;
  const derniere = tachesProjet[0] ?? null;
  const precedente = useRef(active?.id ?? null);

  const charger = useCallback(() => {
    lireJson<ReponsePlans>(`/api/projets/${projet.id}/plans`)
      .then(setPlans)
      .catch((e: unknown) => setErreur(messageErreur(e)));
  }, [projet.id]);

  useEffect(charger, [charger]);
  useEffect(() => {
    const id = active?.id ?? null;
    if (precedente.current !== null && id === null) {
      charger();
      surChangement();
    }
    precedente.current = id;
  }, [active?.id, charger, surChangement]);

  async function proposer() {
    setErreur(null);
    try {
      await envoyerJson("POST", `/api/projets/${projet.id}/plans/proposer`, { consigne });
      setConsigne("");
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  const courante = plans?.versions[0] ?? null;
  const sansTranscription = projet.etape === "fichiers";

  return (
    <section className="section">
      <h2>Plan de montage</h2>
      {erreur && <Message type="erreur">{erreur}</Message>}
      {courante === null ? (
        <p className="section-intro">
          Claude lit les transcriptions, tes consignes, tes notes et le guide de style <code>guides/{projet.metadata.categorie}/style.md</code>, puis
          propose un plan : les passages gardés, dans l'ordre, avec la raison de chaque choix. Rien n'est rendu tant que tu ne l'as pas validé.
        </p>
      ) : (
        <DetailPlan version={courante} dureeVisee={projet.metadata.consignes.dureeViseeMinutes} />
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
            <p className="note">Transcris d'abord les rushes (section Transcriptions) : Claude s'en sert pour proposer le plan.</p>
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
              <button type="button" className="bouton bouton-principal" onClick={() => void proposer()}>
                {courante === null ? "Proposer un plan" : courante.apercu ? "Proposer la version suivante" : "Autre proposition"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
