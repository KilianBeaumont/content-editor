import { rectangleCadre, type Cadrage, type EtatCadre, type ModeCadrage, type Rectangle } from "@editeur/shared";

export function resumeCadrage(cadrage: Cadrage | null): string {
  if (cadrage === null) return "image entière";
  if (cadrage.mode === "fond-flou") return "fond flou";
  const zoom = (valeur: number) => `×${valeur.toFixed(1).replace(".", ",")}`;
  if (cadrage.fin === null) return `recadré ${zoom(cadrage.debut.zoom)}`;
  return `${zoom(cadrage.debut.zoom)} → ${zoom(cadrage.fin.zoom)}`;
}

function Curseur({ libelle, valeur, min, max, pas, actif, surChangement }: { libelle: string; valeur: number; min: number; max: number; pas: number; actif: boolean; surChangement: (valeur: number) => void }) {
  return (
    <label className="curseur-cadrage">
      <span>{libelle}</span>
      <input type="range" min={min} max={max} step={pas} value={valeur} disabled={!actif} onChange={(evenement) => surChangement(Number(evenement.target.value))} />
      <span className="note">{valeur.toFixed(2).replace(".", ",")}</span>
    </label>
  );
}

function ReglagesEtat({ titre, etat, actif, surChangement }: { titre: string; etat: EtatCadre; actif: boolean; surChangement: (etat: EtatCadre) => void }) {
  return (
    <fieldset className="etat-cadre">
      <legend>{titre}</legend>
      <Curseur libelle="Gauche ↔ droite" valeur={etat.x} min={0} max={1} pas={0.01} actif={actif} surChangement={(x) => surChangement({ ...etat, x })} />
      <Curseur libelle="Haut ↕ bas" valeur={etat.y} min={0} max={1} pas={0.01} actif={actif} surChangement={(y) => surChangement({ ...etat, y })} />
      <Curseur libelle="Zoom" valeur={etat.zoom} min={1} max={3} pas={0.05} actif={actif} surChangement={(zoom) => surChangement({ ...etat, zoom })} />
    </fieldset>
  );
}

const CENTRE: EtatCadre = { x: 0.5, y: 0.5, zoom: 1 };

interface ProprietesControles {
  cadrage: Cadrage | null;
  editable: boolean;
  surChangement: (cadrage: Cadrage | null) => void;
}

export function ControlesCadrage({ cadrage, editable, surChangement }: ProprietesControles) {
  const mode: ModeCadrage | "aucun" = cadrage?.mode ?? "aucun";
  return (
    <div className="controles-cadrage">
      <div className="ligne-actions" role="radiogroup" aria-label="Cadrage">
        {(
          [
            ["aucun", "Image entière"],
            ["recadre", "Recadré"],
            ["fond-flou", "Fond flou"],
          ] as const
        ).map(([valeur, libelle]) => (
          <label key={valeur}>
            <input
              type="radio"
              checked={mode === valeur}
              disabled={!editable}
              onChange={() => surChangement(valeur === "aucun" ? null : { mode: valeur, debut: cadrage?.debut ?? CENTRE, fin: valeur === "recadre" ? (cadrage?.fin ?? null) : null })}
            />{" "}
            {libelle}
          </label>
        ))}
      </div>
      {cadrage !== null && cadrage.mode === "recadre" && (
        <>
          <div className="etats-cadre">
            <ReglagesEtat titre={cadrage.fin === null ? "Cadre" : "Début"} etat={cadrage.debut} actif={editable} surChangement={(debut) => surChangement({ ...cadrage, debut })} />
            {cadrage.fin !== null && <ReglagesEtat titre="Fin" etat={cadrage.fin} actif={editable} surChangement={(fin) => surChangement({ ...cadrage, fin })} />}
          </div>
          <label className="note">
            <input
              type="checkbox"
              checked={cadrage.fin !== null}
              disabled={!editable}
              onChange={(evenement) => surChangement({ ...cadrage, fin: evenement.target.checked ? { ...cadrage.debut, zoom: Math.min(3, cadrage.debut.zoom + 0.3) } : null })}
            />{" "}
            Mouvement progressif pendant le segment (zoom ou panoramique)
          </label>
          <p className="note">
            Pour un zoom brusque (« loupe ») : coupe le passage en deux segments qui se suivent dans le rush, et donne au second un zoom plus fort.
          </p>
        </>
      )}
    </div>
  );
}

interface ProprietesCadreSurVideo {
  video: HTMLVideoElement | null;
  dimensions: { largeur: number; hauteur: number } | null;
  ratioSortie: number;
  cadrage: Cadrage | null;
}

export function CadreSurVideo({ video, dimensions, ratioSortie, cadrage }: ProprietesCadreSurVideo) {
  if (video === null || dimensions === null || cadrage === null || cadrage.mode !== "recadre" || dimensions.largeur === 0) return null;
  const ratioSource = dimensions.largeur / dimensions.hauteur;
  const boite = { largeur: video.clientWidth, hauteur: video.clientHeight };
  const affichee = boite.largeur / boite.hauteur > ratioSource ? { largeur: boite.hauteur * ratioSource, hauteur: boite.hauteur } : { largeur: boite.largeur, hauteur: boite.largeur / ratioSource };
  const marge = { gauche: (boite.largeur - affichee.largeur) / 2, haut: (boite.hauteur - affichee.hauteur) / 2 };
  const style = (rectangle: Rectangle) => ({
    left: marge.gauche + rectangle.gauche * affichee.largeur,
    top: marge.haut + rectangle.haut * affichee.hauteur,
    width: rectangle.largeur * affichee.largeur,
    height: rectangle.hauteur * affichee.hauteur,
  });
  return (
    <>
      <div className="cadre-video" style={style(rectangleCadre(ratioSource, ratioSortie, cadrage.debut))} />
      {cadrage.fin !== null && <div className="cadre-video cadre-video-fin" style={style(rectangleCadre(ratioSource, ratioSortie, cadrage.fin))} />}
    </>
  );
}
