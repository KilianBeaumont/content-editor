import { tacheActive, type DetailProjet, type ReponsePlans, type ReponseTranscriptions, type VersionPlan } from "@editeur/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { envoyerJson, lireJson, messageErreur } from "../../api.ts";
import { Message } from "../../composants/Message.tsx";
import { LigneTache, useTaches } from "../../composants/Taches.tsx";
import { EditeurPlan } from "./EditeurPlan.tsx";

export function Plan({ projet, surChangement }: { projet: DetailProjet; surChangement: () => void }) {
  const [plans, setPlans] = useState<ReponsePlans | null>(null);
  const [proxies, setProxies] = useState<Map<string, string>>(new Map());
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
    lireJson<ReponseTranscriptions>(`/api/projets/${projet.id}/transcriptions`)
      .then(({ fichiers }) =>
        setProxies(new Map(fichiers.flatMap((fichier) => (fichier.preparation === "a-jour" && fichier.proxy !== null ? [[fichier.chemin, fichier.proxy]] : [])))),
      )
      .catch(() => setProxies(new Map()));
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

  function remplacer(version: VersionPlan) {
    setPlans((actuel) => actuel && { versions: actuel.versions.map((element) => (element.version === version.version ? version : element)) });
    surChangement();
  }

  const courante = plans?.versions[0] ?? null;
  const sansTranscription = projet.etape === "fichiers";

  return (
    <section className="section">
      <h2>Plan de montage</h2>
      {erreur && <Message type="erreur">{erreur}</Message>}
      {courante === null ? (
        <p className="section-intro">
          Claude lit les transcriptions, les planches d'images, tes moments marqués, tes consignes et le guide de style{" "}
          <code>guides/{projet.metadata.categorie}/style.md</code>, puis propose un plan : les passages gardés, dans l'ordre, avec la raison de
          chaque choix. Tu peux ensuite tout ajuster ici. Rien n'est rendu tant que tu ne l'as pas validé.
        </p>
      ) : courante.plan === null ? (
        <Message type="erreur">{courante.erreur}</Message>
      ) : (
        <EditeurPlan projet={projet} version={courante} initial={courante.plan} proxies={proxies} surEnregistrement={remplacer} />
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
            <p className="note">Analyse d'abord les rushes (section Analyse des rushes) : Claude s'en sert pour proposer le plan.</p>
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
              <button type="button" className="bouton" onClick={() => void proposer()}>
                {courante === null ? "Proposer un plan" : courante.apercu ? "Proposer la version suivante" : "Demander une autre proposition à Claude"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
