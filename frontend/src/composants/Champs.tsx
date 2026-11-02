import type { ReactNode } from "react";

interface ProprietesChampTexte {
  libelle: string;
  valeur: string;
  surChangement: (valeur: string) => void;
  aide?: ReactNode;
  large?: boolean;
  indication?: string;
}

export function ChampTexte({ libelle, valeur, surChangement, aide, large, indication }: ProprietesChampTexte) {
  return (
    <label className={large ? "champ champ-large" : "champ"}>
      <span className="champ-libelle">{libelle}</span>
      <input
        type="text"
        value={valeur}
        placeholder={indication}
        spellCheck={false}
        onChange={(evenement) => surChangement(evenement.target.value)}
      />
      {aide && <span className="champ-aide">{aide}</span>}
    </label>
  );
}

interface ProprietesChampNombre {
  libelle: string;
  valeur: number;
  surChangement: (valeur: number) => void;
  min?: number;
  max?: number;
  pas?: number;
  unite?: string;
}

export function ChampNombre({ libelle, valeur, surChangement, min, max, pas, unite }: ProprietesChampNombre) {
  return (
    <label className="champ champ-nombre">
      <span className="champ-libelle">{libelle}</span>
      <span className="champ-avec-unite">
        <input
          type="number"
          value={Number.isNaN(valeur) ? "" : valeur}
          min={min}
          max={max}
          step={pas}
          onChange={(evenement) => surChangement(evenement.target.valueAsNumber)}
        />
        {unite && <span className="champ-unite">{unite}</span>}
      </span>
    </label>
  );
}
