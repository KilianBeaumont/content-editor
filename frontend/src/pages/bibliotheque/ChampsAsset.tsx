import {
  LANGUES_ASSET,
  LIBELLES_LANGUES,
  LIBELLES_SOURCES_ASSET,
  SOURCES_ASSET,
  TYPES,
  type AssetBibliotheque,
  type ReponseBibliotheque,
  type ReponseListeArtistes,
  type SaisieAsset,
  type SourceAsset,
  type TypeAsset,
} from "@editeur/shared";
import { useEffect, useState } from "react";
import { lireJson } from "../../api.ts";
import { ChampTexte } from "../../composants/Champs.tsx";

export interface Champs {
  description: string;
  etiquettes: string;
  langue: string;
  source: SourceAsset;
  artiste: string;
  licence: string;
}

export const CHAMPS_VIDES: Champs = {
  description: "",
  etiquettes: "",
  langue: "",
  source: "utilisateur",
  artiste: "",
  licence: "",
};

export function versChamps(asset: AssetBibliotheque): Champs {
  return {
    description: asset.description,
    etiquettes: asset.etiquettes.join(", "),
    langue: asset.langue ?? "",
    source: asset.source,
    artiste: asset.artiste ?? "",
    licence: asset.licence,
  };
}

export function versSaisie(champs: Champs): SaisieAsset {
  return {
    description: champs.description,
    etiquettes: champs.etiquettes
      .split(",")
      .map((etiquette) => etiquette.trim())
      .filter((etiquette) => etiquette !== ""),
    langue: LANGUES_ASSET.find((langue) => langue === champs.langue) ?? null,
    source: champs.source,
    artiste: champs.source === "artiste" && champs.artiste !== "" ? champs.artiste : null,
    licence: champs.licence,
  };
}

export function etiquettesDe(reponse: ReponseBibliotheque): string[] {
  return [...new Set(reponse.elements.flatMap(({ asset }) => asset.etiquettes))].sort((a, b) => a.localeCompare(b, "fr"));
}

interface ProprietesChampsAsset {
  champs: Champs;
  surChangement: (changement: Partial<Champs>) => void;
  type: TypeAsset | null;
}

export function ChampsAsset({ champs, surChangement, type }: ProprietesChampsAsset) {
  const [artistes, setArtistes] = useState<ReponseListeArtistes["artistes"]>([]);
  const [etiquettesConnues, setEtiquettesConnues] = useState<string[]>([]);
  const regleLangue = type === null ? "sans" : TYPES[type].langue;
  const choisies = new Set(versSaisie(champs).etiquettes.map((etiquette) => etiquette.toLowerCase()));
  const suggestions = etiquettesConnues.filter((etiquette) => !choisies.has(etiquette));

  useEffect(() => {
    lireJson<ReponseListeArtistes>("/api/artistes")
      .then((liste) => setArtistes(liste.artistes))
      .catch(() => setArtistes([]));
    lireJson<ReponseBibliotheque>("/api/bibliotheque")
      .then((reponse) => setEtiquettesConnues(etiquettesDe(reponse)))
      .catch(() => setEtiquettesConnues([]));
  }, []);

  function ajouterEtiquette(etiquette: string) {
    const actuelles = champs.etiquettes.trim().replace(/,\s*$/, "");
    surChangement({ etiquettes: actuelles === "" ? etiquette : `${actuelles}, ${etiquette}` });
  }

  return (
    <>
      <label className="champ">
        <span className="champ-libelle">Description</span>
        <textarea
          rows={3}
          value={champs.description}
          onChange={(evenement) => surChangement({ description: evenement.target.value })}
        />
        <span className="champ-aide">Ce que c'est et quand l'utiliser : Claude s'en sert pour proposer l'asset au montage.</span>
      </label>

      <ChampTexte
          large
          libelle="Étiquettes"
          valeur={champs.etiquettes}
          surChangement={(etiquettes) => surChangement({ etiquettes })}
          indication="générique, identité, halloween"
          aide="Pour regrouper les assets (série, thème, usage), séparées par des virgules."
      />
      {suggestions.length > 0 && (
        <div className="etiquettes etiquettes-suggestions">
          {suggestions.map((etiquette) => (
            <button key={etiquette} type="button" className="etiquette etiquette-bouton" onClick={() => ajouterEtiquette(etiquette)}>
              + {etiquette}
            </button>
          ))}
        </div>
      )}

      {regleLangue !== "sans" && (
        <label className="champ">
          <span className="champ-libelle">Langue</span>
          <select value={champs.langue} onChange={(evenement) => surChangement({ langue: evenement.target.value })}>
            <option value="">{regleLangue === "obligatoire" ? "Choisir…" : "Sans texte ni parole"}</option>
            {LANGUES_ASSET.map((langue) => (
              <option key={langue} value={langue}>
                {LIBELLES_LANGUES[langue]}
              </option>
            ))}
          </select>
          <span className="champ-aide">
            {regleLangue === "obligatoire"
              ? "Langue dans laquelle la phrase est dite."
              : "Si l'image ou la vidéo contient du texte : aucun texte en français ne doit apparaître sur les visuels des récits."}
          </span>
        </label>
      )}

      <label className="champ">
        <span className="champ-libelle">Créé par</span>
        <select
          value={champs.source}
          onChange={(evenement) => {
            const source = SOURCES_ASSET.find((element) => element === evenement.target.value);
            if (source) surChangement({ source });
          }}
        >
          {SOURCES_ASSET.map((source) => (
            <option key={source} value={source}>
              {LIBELLES_SOURCES_ASSET[source]}
            </option>
          ))}
        </select>
      </label>

      {champs.source === "artiste" && (
        <label className="champ">
          <span className="champ-libelle">Artiste</span>
          <select value={champs.artiste} onChange={(evenement) => surChangement({ artiste: evenement.target.value })}>
            <option value="">Choisir…</option>
            {artistes.map((artiste) => (
              <option key={artiste.id} value={artiste.id}>
                {artiste.fiche.nom}
                {artiste.fiche.accord.reutilisationAutorisee ? "" : " (réutilisation non autorisée)"}
              </option>
            ))}
          </select>
          <span className="champ-aide">
            Un visuel d'artiste n'a sa place dans la bibliothèque que si l'artiste autorise sa réutilisation.
          </span>
        </label>
      )}

      {champs.source !== "utilisateur" && (
        <ChampTexte
          large
          libelle="Licence et crédit"
          valeur={champs.licence}
          surChangement={(licence) => surChangement({ licence })}
          aide="Conditions d'utilisation et mention à ajouter dans la description des vidéos."
        />
      )}
    </>
  );
}
