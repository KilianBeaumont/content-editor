import type { ReponseReperes, Repere } from "@editeur/shared";
import { useEffect, useState } from "react";
import { envoyerJson, formaterDuree, lireJson, messageErreur } from "../../api.ts";
import { Message } from "../../composants/Message.tsx";

interface ProprietesReperes {
  projet: string;
  source: string;
  tempsActuel: () => number;
  aller: (seconde: number) => void;
}

export function Reperes({ projet, source, tempsActuel, aller }: ProprietesReperes) {
  const [reperes, setReperes] = useState<Repere[]>([]);
  const [note, setNote] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const url = `/api/projets/${projet}/reperes`;

  useEffect(() => {
    lireJson<ReponseReperes>(url)
      .then((reponse) => setReperes(reponse.reperes))
      .catch((e: unknown) => setErreur(messageErreur(e)));
  }, [url]);

  async function agir(action: () => Promise<ReponseReperes>) {
    setErreur(null);
    try {
      setReperes((await action()).reperes);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  function marquer() {
    const temps = tempsActuel();
    void agir(() => envoyerJson<ReponseReperes>("POST", url, { source, temps, note })).then(() => setNote(""));
  }

  const duRush = reperes.filter((repere) => repere.source === source);

  return (
    <div className="reperes">
      <span className="champ-libelle">Moments marqués</span>
      <div className="reperes-saisie">
        <input
          type="text"
          value={note}
          maxLength={500}
          placeholder="note facultative : bonne prise, la blague, à garder…"
          onChange={(evenement) => setNote(evenement.target.value)}
          onKeyDown={(evenement) => {
            if (evenement.key === "Enter") marquer();
          }}
        />
        <button type="button" className="bouton" onClick={marquer}>
          Marquer ce moment
        </button>
      </div>
      {erreur && <Message type="erreur">{erreur}</Message>}
      {duRush.length === 0 ? (
        <p className="note">Mets en pause sur un moment important puis marque-le : Claude le gardera en priorité.</p>
      ) : (
        <ul className="liste-reperes">
          {duRush.map((repere) => (
            <li key={repere.id}>
              <button type="button" className="bouton-lien" onClick={() => aller(repere.temps)}>
                {formaterDuree(repere.temps)}
              </button>
              <span>{repere.note || <span className="note">sans note</span>}</span>
              <button
                type="button"
                className="bouton bouton-discret"
                aria-label="Supprimer ce repère"
                onClick={() => void agir(() => envoyerJson<ReponseReperes>("DELETE", `${url}/${repere.id}`))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
