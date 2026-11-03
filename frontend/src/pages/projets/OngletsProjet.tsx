import { ETAPES_PROJET, LIBELLES_ETAPES, type EtapeProjet } from "@editeur/shared";

export const ONGLETS = ["fichiers", "analyse", "plan", "apercu", "validation", "export"] as const;
export type Onglet = (typeof ONGLETS)[number];

const DEFINITIONS: Record<Onglet, { libelle: string; etape: EtapeProjet; action: string }> = {
  fichiers: { libelle: "Fichiers", etape: "fichiers", action: "Ranger les rushes, consignes et droits" },
  analyse: { libelle: "Analyse", etape: "analyse", action: "Transcrire, préparer, marquer les moments" },
  plan: { libelle: "Plan", etape: "plan", action: "Faire proposer, ajuster et valider le plan" },
  apercu: { libelle: "Aperçu", etape: "apercu", action: "Rendre, regarder, commenter, itérer" },
  validation: { libelle: "Validation", etape: "valide", action: "Valider la version et vérifier les droits" },
  export: { libelle: "Export", etape: "exporte", action: "Rendre en pleine qualité et ranger par plateforme" },
};

export function estOnglet(valeur: string | null): valeur is Onglet {
  return valeur !== null && (ONGLETS as readonly string[]).includes(valeur);
}

export function ongletSuggere(etape: EtapeProjet): Onglet {
  const suivant = Math.min(ETAPES_PROJET.indexOf(etape) + 1, ONGLETS.length - 1);
  return ONGLETS[suivant] ?? "fichiers";
}

interface ProprietesOnglets {
  etape: EtapeProjet;
  actif: Onglet;
  choisir: (onglet: Onglet) => void;
}

export function OngletsProjet({ etape, actif, choisir }: ProprietesOnglets) {
  const atteinte = ETAPES_PROJET.indexOf(etape);
  const suggere = ongletSuggere(etape);
  return (
    <nav className="onglets-projet" aria-label="Étapes du projet">
      <ol>
        {ONGLETS.map((onglet, index) => {
          const definition = DEFINITIONS[onglet];
          const fait = ETAPES_PROJET.indexOf(definition.etape) <= atteinte;
          const classes = ["onglet", fait ? "onglet-fait" : "", onglet === suggere ? "onglet-suggere" : "", onglet === actif ? "onglet-actif" : ""];
          return (
            <li key={onglet}>
              <button
                type="button"
                className={classes.filter((classe) => classe !== "").join(" ")}
                aria-current={onglet === actif ? "step" : undefined}
                title={definition.action}
                onClick={() => choisir(onglet)}
              >
                <span className="onglet-numero">{fait ? "✓" : index + 1}</span>
                <span className="onglet-texte">
                  <strong>{definition.libelle}</strong>
                  <span className="onglet-etat">{fait ? LIBELLES_ETAPES[definition.etape] : onglet === suggere ? "à faire" : definition.action}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function NavigationEtapes({ actif, choisir }: { actif: Onglet; choisir: (onglet: Onglet) => void }) {
  const index = ONGLETS.indexOf(actif);
  const precedent = ONGLETS[index - 1];
  const suivant = ONGLETS[index + 1];
  return (
    <div className="navigation-etapes">
      {precedent !== undefined ? (
        <button type="button" className="bouton" onClick={() => choisir(precedent)}>
          ← {DEFINITIONS[precedent].libelle}
        </button>
      ) : (
        <span />
      )}
      {suivant !== undefined && (
        <button type="button" className="bouton" onClick={() => choisir(suivant)}>
          {DEFINITIONS[suivant].libelle} →
        </button>
      )}
    </div>
  );
}
