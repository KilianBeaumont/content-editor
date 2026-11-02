import { useEffect, useRef, useState } from "react";
import { envoyerFichier, formaterTaille } from "../api.ts";

interface Progression {
  nom: string;
  envoye: number;
  total: number;
}

export function useEnvoi() {
  const [progression, setProgression] = useState<Progression | null>(null);
  const controleur = useRef<AbortController | null>(null);

  useEffect(() => {
    if (progression === null) return;
    const avertir = (evenement: BeforeUnloadEvent) => evenement.preventDefault();
    window.addEventListener("beforeunload", avertir);
    return () => window.removeEventListener("beforeunload", avertir);
  }, [progression]);

  useEffect(() => () => controleur.current?.abort(), []);

  async function envoyer<T>(chemin: string, fichier: File): Promise<T> {
    controleur.current = new AbortController();
    setProgression({ nom: fichier.name, envoye: 0, total: fichier.size });
    try {
      return await envoyerFichier<T>(chemin, fichier, {
        signal: controleur.current.signal,
        surProgression: (envoye, total) => setProgression({ nom: fichier.name, envoye, total }),
      });
    } finally {
      controleur.current = null;
      setProgression(null);
    }
  }

  return { progression, envoyer, annuler: () => controleur.current?.abort() };
}

export function BarreEnvoi({ progression, surAnnulation }: { progression: Progression; surAnnulation: () => void }) {
  const fraction = progression.total > 0 ? progression.envoye / progression.total : 0;
  return (
    <div className="barre-envoi">
      <div className="barre-envoi-texte">
        <span>
          Envoi de <strong>{progression.nom}</strong> : {formaterTaille(progression.envoye)} sur{" "}
          {formaterTaille(progression.total)} ({Math.floor(fraction * 100)} %)
        </span>
        <button type="button" className="bouton bouton-discret" onClick={surAnnulation}>
          Annuler
        </button>
      </div>
      <progress value={fraction} max={1} />
      <span className="champ-aide">Garde cette page ouverte jusqu'à la fin de l'envoi.</span>
    </div>
  );
}
