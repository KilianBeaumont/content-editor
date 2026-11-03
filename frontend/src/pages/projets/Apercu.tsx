import { cheminApercu, tacheActive, type DetailProjet, type PlanMontage, type Tache, type VersionPlan } from "@editeur/shared";
import { useState } from "react";
import { envoyerJson, messageErreur, urlFichier } from "../../api.ts";
import { Message } from "../../composants/Message.tsx";
import { LigneTache } from "../../composants/Taches.tsx";
import { temps } from "./EditeurPlan.tsx";

interface ProprietesApercu {
  projet: DetailProjet;
  version: VersionPlan;
  plan: PlanMontage;
  taches: Tache[];
}

export function Apercu({ projet, version, plan, taches }: ProprietesApercu) {
  const [erreur, setErreur] = useState<string | null>(null);
  const duVersion = taches.filter((tache) => tache.type === "rendu-apercu" && tache.projet === projet.id && tache.parametres.version === version.version);
  const active = duVersion.find(tacheActive) ?? null;
  const derniere = duVersion[0] ?? null;

  async function lancer() {
    setErreur(null);
    try {
      await envoyerJson("POST", `/api/projets/${projet.id}/plans/${version.version}/apercu`);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  if (version.apercu) {
    const { rendu } = version;
    return (
      <div className="bloc-apercu">
        <h3>Aperçu {version.version}</h3>
        <video className="video-apercu" src={urlFichier(`${projet.chemin}/${rendu?.fichier ?? cheminApercu(version.version)}`)} controls preload="metadata" />
        {rendu !== null && (
          <p className="note">
            {rendu.largeur}x{rendu.hauteur} · {temps(rendu.duree ?? rendu.dureePlan)} · rendu le{" "}
            {new Date(rendu.creeLe).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} en{" "}
            {Math.round(rendu.dureeRenduSecondes)} s
          </p>
        )}
        {rendu !== null && rendu.controles.length > 0 && (
          <Message type="alerte">
            <ul>
              {rendu.controles.map((controle) => (
                <li key={controle}>{controle}</li>
              ))}
            </ul>
          </Message>
        )}
      </div>
    );
  }

  if (plan.statut !== "valide") return null;

  return (
    <div className="bloc-apercu">
      <h3>Aperçu</h3>
      {erreur && <Message type="erreur">{erreur}</Message>}
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
          <p className="section-intro">
            L'aperçu est rendu en basse résolution à partir des proxys : coupes, décalages d'image, plans de coupe, musique et volume
            normalisé. Quelques secondes pour une vidéo d'une minute.
          </p>
          <button type="button" className="bouton bouton-principal" onClick={() => void lancer()}>
            Lancer l'aperçu
          </button>
        </>
      )}
    </div>
  );
}
