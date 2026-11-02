import { LIBELLES_ETATS_TACHE, tacheActive, type ReponseTaches, type Tache } from "@editeur/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { envoyerJson, formaterDuree, messageErreur } from "../api.ts";
import { Message } from "./Message.tsx";

export function useTaches(): { taches: Tache[]; connecte: boolean } {
  const [taches, setTaches] = useState<Tache[]>([]);
  const [connecte, setConnecte] = useState(false);

  useEffect(() => {
    const flux = new EventSource("/api/taches/flux");
    flux.onmessage = (evenement: MessageEvent<string>) => {
      setTaches((JSON.parse(evenement.data) as ReponseTaches).taches);
      setConnecte(true);
    };
    flux.onerror = () => setConnecte(false);
    return () => flux.close();
  }, []);

  return { taches, connecte };
}

function heure(date: string): string {
  return new Date(date).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function LigneTache({ tache }: { tache: Tache }) {
  const [erreur, setErreur] = useState<string | null>(null);
  const active = tacheActive(tache);

  async function agir(action: "annuler" | "relancer") {
    setErreur(null);
    try {
      await envoyerJson("POST", `/api/taches/${tache.id}/${action}`);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  return (
    <li className={`tache tache-${tache.etat}`}>
      <div className="tache-entete">
        <span>
          <strong>{tache.libelle}</strong>
          {tache.projet && (
            <>
              {" · "}
              <Link to={`/projets/${tache.projet}`}>{tache.projet}</Link>
            </>
          )}
        </span>
        <span className="ligne-actions">
          <span className={`badge badge-tache-${tache.etat}`}>{LIBELLES_ETATS_TACHE[tache.etat]}</span>
          {active ? (
            <button type="button" className="bouton bouton-discret" onClick={() => void agir("annuler")}>
              Annuler
            </button>
          ) : (
            tache.etat !== "terminee" && (
              <button type="button" className="bouton bouton-discret" onClick={() => void agir("relancer")}>
                Relancer
              </button>
            )
          )}
        </span>
      </div>
      {tache.etat === "en-cours" && (
        <>
          <progress value={tache.progression ?? undefined} max={1} />
          <span className="note">
            {tache.etape ?? "En cours"}
            {tache.progression !== null && ` · ${Math.floor(tache.progression * 100)} %`}
            {tache.resteSecondes !== null && ` · encore ${formaterDuree(tache.resteSecondes)}`}
          </span>
        </>
      )}
      {tache.etat === "attente" && <span className="note">Démarrera dès que la tâche en cours sera finie.</span>}
      {tache.resultat && <span className="note">{tache.resultat}</span>}
      {tache.erreur && <span className="tache-erreur">{tache.erreur}</span>}
      {!active && tache.termineLe && <span className="note">{heure(tache.termineLe)}</span>}
      {erreur && <Message type="erreur">{erreur}</Message>}
    </li>
  );
}

export function ListeTaches({ taches, vide }: { taches: Tache[]; vide: string }) {
  if (taches.length === 0) return <p className="note">{vide}</p>;
  return (
    <ul className="liste-taches">
      {taches.map((tache) => (
        <LigneTache key={tache.id} tache={tache} />
      ))}
    </ul>
  );
}
