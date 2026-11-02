export interface Lien {
  libelle: string;
  url: string;
}

export function versLiens(liens: Record<string, string>): Lien[] {
  return Object.entries(liens).map(([libelle, url]) => ({ libelle, url }));
}

export function depuisLiens(liens: Lien[]): Record<string, string> {
  const resultat: Record<string, string> = {};
  for (const { libelle, url } of liens) {
    if (libelle.trim() !== "" || url.trim() !== "") {
      resultat[libelle.trim()] = url.trim();
    }
  }
  return resultat;
}

interface ProprietesEditeurLiens {
  liens: Lien[];
  surChangement: (liens: Lien[]) => void;
}

export function EditeurLiens({ liens, surChangement }: ProprietesEditeurLiens) {
  function modifier(index: number, changement: Partial<Lien>) {
    surChangement(liens.map((lien, i) => (i === index ? { ...lien, ...changement } : lien)));
  }

  return (
    <div className="champ">
      <span className="champ-libelle">Liens</span>
      {liens.map((lien, index) => (
        <div className="ligne-lien" key={index}>
          <input
            type="text"
            placeholder="instagram, site…"
            value={lien.libelle}
            onChange={(evenement) => modifier(index, { libelle: evenement.target.value })}
          />
          <input
            type="text"
            placeholder="https://…"
            spellCheck={false}
            value={lien.url}
            onChange={(evenement) => modifier(index, { url: evenement.target.value })}
          />
          <button
            type="button"
            className="bouton bouton-discret"
            aria-label="Retirer ce lien"
            onClick={() => surChangement(liens.filter((_, i) => i !== index))}
          >
            Retirer
          </button>
        </div>
      ))}
      <div>
        <button type="button" className="bouton bouton-discret" onClick={() => surChangement([...liens, { libelle: "", url: "" }])}>
          + Ajouter un lien
        </button>
      </div>
    </div>
  );
}
