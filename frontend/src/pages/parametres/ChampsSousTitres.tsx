import type { ReglagesSousTitres, ReponseBibliotheque } from "@editeur/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { lireJson } from "../../api.ts";
import { ChampNombre } from "../../composants/Champs.tsx";

const EXTENSIONS = [".ttf", ".otf", ".ttc"];

interface ProprietesChampsSousTitres {
  valeur: ReglagesSousTitres;
  surChangement: (changement: (reglages: ReglagesSousTitres) => void) => void;
}

export function ChampsSousTitres({ valeur, surChangement }: ProprietesChampsSousTitres) {
  const [polices, setPolices] = useState<ReponseBibliotheque["elements"]>([]);

  useEffect(() => {
    lireJson<ReponseBibliotheque>("/api/bibliotheque")
      .then((reponse) =>
        setPolices(reponse.elements.filter(({ asset }) => asset.type === "police" && EXTENSIONS.some((extension) => asset.chemin.toLowerCase().endsWith(extension)))),
      )
      .catch(() => setPolices([]));
  }, []);

  return (
    <>
      <h3>Sous-titres incrustés</h3>
      <p className="section-intro">
        Le style des sous-titres mot à mot, surtout pour les formats courts. Chaque plan de montage dit s'il en veut (case « Sous-titres
        incrustés » de l'éditeur).
      </p>
      <div className="ligne-champs">
        <label className="champ">
          <span className="champ-libelle">Police</span>
          <select value={valeur.police ?? ""} onChange={(evenement) => surChangement((reglages) => (reglages.police = evenement.target.value === "" ? null : evenement.target.value))}>
            <option value="">Choisir une police de la bibliothèque…</option>
            {polices.map(({ asset }) => (
              <option key={asset.id} value={asset.id}>
                {asset.chemin.split("/").at(-1)}
                {asset.etiquettes.length > 0 ? ` (${asset.etiquettes.join(", ")})` : ""}
              </option>
            ))}
          </select>
          <span className="champ-aide">
            {polices.length === 0 ? (
              <>
                Aucune police TTF ou OTF dans la bibliothèque : <Link to="/bibliotheque/nouveau">ajoute la tienne</Link> (type « Police »).
              </>
            ) : (
              "Une police TTF, OTF ou TTC de ta bibliothèque, identique sur le PC et le Mac."
            )}
          </span>
        </label>
        <ChampNombre libelle="Taille" unite="% de la hauteur" pas={0.5} valeur={valeur.taillePourcent} surChangement={(taille) => surChangement((reglages) => (reglages.taillePourcent = taille))} />
        <ChampNombre libelle="Mots à la fois" min={1} max={8} valeur={valeur.motsMax} surChangement={(mots) => surChangement((reglages) => (reglages.motsMax = mots))} />
        <ChampNombre
          libelle="Position"
          unite="% depuis le haut"
          valeur={valeur.positionPourcent}
          surChangement={(position) => surChangement((reglages) => (reglages.positionPourcent = position))}
        />
        <ChampNombre libelle="Contour" unite="px (en 1080)" pas={0.5} valeur={valeur.contour} surChangement={(contour) => surChangement((reglages) => (reglages.contour = contour))} />
      </div>
      <div className="ligne-champs">
        <label className="champ">
          <span className="champ-libelle">Couleur du texte</span>
          <input type="color" value={valeur.couleur} onChange={(evenement) => surChangement((reglages) => (reglages.couleur = evenement.target.value.toUpperCase()))} />
        </label>
        <label className="champ">
          <span className="champ-libelle">Couleur du mot prononcé</span>
          <input type="color" value={valeur.couleurAccent} onChange={(evenement) => surChangement((reglages) => (reglages.couleurAccent = evenement.target.value.toUpperCase()))} />
        </label>
        <label className="champ champ-case">
          <input type="checkbox" checked={valeur.majuscules} onChange={(evenement) => surChangement((reglages) => (reglages.majuscules = evenement.target.checked))} /> En majuscules
        </label>
      </div>
      <p className="note">
        Position conseillée pour un format court : entre 60 et 75 % depuis le haut, loin des boutons et des légendes de TikTok, Reels et Shorts.
      </p>
    </>
  );
}
