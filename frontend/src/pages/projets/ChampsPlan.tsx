import { useEffect, useState } from "react";

export function temps(secondes: number): string {
  const minutes = Math.floor(secondes / 60);
  return `${minutes}:${(secondes - minutes * 60).toFixed(1).replace(".", ",").padStart(4, "0")}`;
}

export function nomFichier(chemin: string): string {
  return chemin.split("/").at(-1) ?? chemin;
}

export function ChampTemps({ valeur, surChangement, actif, pas = 0.05 }: { valeur: number; surChangement: (valeur: number) => void; actif: boolean; pas?: number }) {
  const [texte, setTexte] = useState(valeur.toFixed(2));
  useEffect(() => setTexte(valeur.toFixed(2)), [valeur]);
  const valider = () => {
    const nombre = Number(texte.replace(",", "."));
    if (Number.isFinite(nombre)) surChangement(Math.round(nombre * 100) / 100);
    else setTexte(valeur.toFixed(2));
  };
  return (
    <input
      className="champ-temps"
      type="number"
      step={pas}
      value={texte}
      disabled={!actif}
      onChange={(evenement) => setTexte(evenement.target.value)}
      onBlur={valider}
      onKeyDown={(evenement) => {
        if (evenement.key === "Enter") valider();
      }}
    />
  );
}
