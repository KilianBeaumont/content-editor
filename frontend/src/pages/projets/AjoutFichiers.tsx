import { destinationsPossibles, type DetailProjet, type ReponseInbox } from "@editeur/shared";
import { useCallback, useEffect, useState } from "react";
import { envoyerJson, lireJson, messageErreur } from "../../api.ts";
import { Message } from "../../composants/Message.tsx";
import { ChoixFichiers, destinationParDefaut, type Choix } from "./ChoixFichiers.tsx";

interface ProprietesAjoutFichiers {
  projet: DetailProjet;
  nomsArtistes: Map<string, string>;
  surAjout: () => void;
  surFermeture: () => void;
}

export function AjoutFichiers({ projet, nomsArtistes, surAjout, surFermeture }: ProprietesAjoutFichiers) {
  const [inbox, setInbox] = useState<ReponseInbox | null>(null);
  const [choix, setChoix] = useState<Map<string, Choix>>(new Map());
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const { chaine, langues, artistes } = projet.metadata;
  const destinations = destinationsPossibles(chaine, langues.includes("en"), artistes);

  const charger = useCallback(() => {
    lireJson<ReponseInbox>("/api/inbox")
      .then(setInbox)
      .catch((e: unknown) => setErreur(messageErreur(e)));
  }, []);

  useEffect(charger, [charger]);

  async function ajouter() {
    setEnCours(true);
    setErreur(null);
    const genres = new Map((inbox?.fichiers ?? []).map((fichier) => [fichier.chemin, fichier.genre]));
    const fichiers = [...choix].map(([chemin, { destination, note }]) => ({
      chemin,
      note,
      destination: destinations.includes(destination) ? destination : destinationParDefaut(genres.get(chemin) ?? "autre", chaine),
    }));
    try {
      await envoyerJson("POST", `/api/projets/${projet.id}/fichiers`, { fichiers });
      setChoix(new Map());
      charger();
      surAjout();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <>
      <ChoixFichiers
        inbox={inbox}
        surInbox={setInbox}
        recharger={charger}
        choix={choix}
        surChoix={setChoix}
        chaine={chaine}
        destinations={destinations}
        nomsArtistes={nomsArtistes}
      />
      <div className="actions actions-section">
        <button type="button" className="bouton bouton-principal" disabled={enCours || choix.size === 0} onClick={() => void ajouter()}>
          {enCours ? "Ajout…" : `Ranger ${choix.size} ${choix.size === 1 ? "fichier" : "fichiers"} dans le projet`}
        </button>
        <button type="button" className="bouton" onClick={surFermeture}>
          Fermer
        </button>
      </div>
      {erreur && <Message type="erreur">{erreur}</Message>}
    </>
  );
}
