import {
  EXTENSIONS_PREUVE,
  LIBELLES_PLATEFORMES,
  PLATEFORMES_AUTORISATION,
  type Auteur,
  type SaisieAutorisation,
} from "@editeur/shared";
import { Link } from "react-router";
import { ApercuFichier } from "../../composants/ApercuFichier.tsx";
import { ChampTexte } from "../../composants/Champs.tsx";

export interface ChampsAuteur {
  mode: "auteur" | "moi";
  auteurId: string;
  nomUtilisateur: string;
  source: string;
  autorisation: SaisieAutorisation;
  preuve: File | null;
  futurRoman: boolean;
}

export const CHAMPS_AUTEUR_VIDES: ChampsAuteur = {
  mode: "auteur",
  auteurId: "",
  nomUtilisateur: "",
  source: "",
  autorisation: {
    obtenue: false,
    date: null,
    lecture: false,
    traductionAnglaise: false,
    monetisation: false,
    plateformes: [],
  },
  preuve: null,
  futurRoman: false,
};

interface ProprietesSectionAuteur {
  champs: ChampsAuteur;
  surChangement: (changement: Partial<ChampsAuteur>) => void;
  auteurs: Auteur[];
  surActualiser: () => void;
  anglais: boolean;
  preuveActuelle?: string | null;
}

function Case({ libelle, valeur, surChangement }: { libelle: string; valeur: boolean; surChangement: (valeur: boolean) => void }) {
  return (
    <label className="case">
      <input type="checkbox" checked={valeur} onChange={(evenement) => surChangement(evenement.target.checked)} />
      {libelle}
    </label>
  );
}

export function SectionAuteur({ champs, surChangement, auteurs, surActualiser, anglais, preuveActuelle = null }: ProprietesSectionAuteur) {
  const { autorisation } = champs;
  const modifierAutorisation = (changement: Partial<SaisieAutorisation>) =>
    surChangement({ autorisation: { ...autorisation, ...changement } });

  return (
    <section className="section">
      <h2>Auteur et autorisation</h2>
      <div className="choix-ligne">
        <label className="case">
          <input type="radio" checked={champs.mode === "auteur"} onChange={() => surChangement({ mode: "auteur" })} />
          Histoire d'un auteur ou d'une autrice
        </label>
        <label className="case">
          <input type="radio" checked={champs.mode === "moi"} onChange={() => surChangement({ mode: "moi" })} />
          Mon histoire
        </label>
      </div>

      {champs.mode === "moi" ? (
        <>
          <ChampTexte
            large
            libelle="Signature"
            valeur={champs.nomUtilisateur}
            surChangement={(nomUtilisateur) => surChangement({ nomUtilisateur })}
            indication="ton pseudo"
            aide="La vidéo commencera par « Une histoire originale de … », avec un renvoi vers la chaîne Création."
          />
          <Case
            libelle="Histoire destinée à devenir un roman : n'en publier que des extraits"
            valeur={champs.futurRoman}
            surChangement={(futurRoman) => surChangement({ futurRoman })}
          />
        </>
      ) : (
        <>
          <label className="champ">
            <span className="champ-libelle">Auteur ou autrice</span>
            <span className="ligne-actions">
              <select value={champs.auteurId} onChange={(evenement) => surChangement({ auteurId: evenement.target.value })}>
                <option value="">Choisir…</option>
                {auteurs.map((auteur) => (
                  <option key={auteur.id} value={auteur.id}>
                    {auteur.fiche.nom}
                  </option>
                ))}
              </select>
              <Link to="/auteurs-artistes/auteurs/nouveau" target="_blank" className="bouton bouton-discret">
                + Nouvelle fiche
              </Link>
              <button type="button" className="bouton bouton-discret" onClick={surActualiser}>
                Actualiser
              </button>
            </span>
          </label>
          <ChampTexte
            large
            libelle="Lien vers l'histoire d'origine"
            valeur={champs.source}
            surChangement={(source) => surChangement({ source })}
            indication="https://www.reddit.com/…"
          />

          <h3>Autorisation pour ce récit</h3>
          <Case libelle="Autorisation obtenue" valeur={autorisation.obtenue} surChangement={(obtenue) => modifierAutorisation({ obtenue })} />
          <label className="champ">
            <span className="champ-libelle">Date de l'accord</span>
            <input
              type="date"
              value={autorisation.date ?? ""}
              onChange={(evenement) => modifierAutorisation({ date: evenement.target.value || null })}
            />
          </label>
          <Case libelle="Lecture à voix haute autorisée" valeur={autorisation.lecture} surChangement={(lecture) => modifierAutorisation({ lecture })} />
          <Case
            libelle="Traduction anglaise autorisée"
            valeur={autorisation.traductionAnglaise}
            surChangement={(traductionAnglaise) => modifierAutorisation({ traductionAnglaise })}
          />
          {anglais && !autorisation.traductionAnglaise && (
            <p className="note alerte-texte">Sans cette autorisation, la version anglaise ne pourra pas être exportée.</p>
          )}
          <Case
            libelle="Monétisation acceptée"
            valeur={autorisation.monetisation}
            surChangement={(monetisation) => modifierAutorisation({ monetisation })}
          />
          <span className="champ-libelle">Plateformes autorisées</span>
          <div className="choix-ligne">
            {PLATEFORMES_AUTORISATION.map((plateforme) => (
              <Case
                key={plateforme}
                libelle={LIBELLES_PLATEFORMES[plateforme]}
                valeur={autorisation.plateformes.includes(plateforme)}
                surChangement={(coche) =>
                  modifierAutorisation({
                    plateformes: coche
                      ? [...autorisation.plateformes, plateforme]
                      : autorisation.plateformes.filter((element) => element !== plateforme),
                  })
                }
              />
            ))}
          </div>
          {preuveActuelle !== null && <ApercuFichier chemin={preuveActuelle} />}
          <label className="champ">
            <span className="champ-libelle">{preuveActuelle !== null ? "Remplacer la preuve" : "Preuve de l'accord"}</span>
            <input
              type="file"
              accept={EXTENSIONS_PREUVE.join(",")}
              onChange={(evenement) => surChangement({ preuve: evenement.target.files?.[0] ?? null })}
            />
            <span className="champ-aide">Capture du message, PDF ou e-mail. Rangée dans le dossier autorisation/ du projet.</span>
          </label>
        </>
      )}
    </section>
  );
}
