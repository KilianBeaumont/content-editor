import {
  APPARITIONS_TEXTE,
  POSITIONS_TEXTE,
  TEXTE_PAR_DEFAUT,
  type ApparitionTexte,
  type Bruitage,
  type ElementBibliotheque,
  type PlanMontage,
  type PositionTexte,
  type TexteEcran,
} from "@editeur/shared";
import { useState } from "react";
import { ChampTemps, nomFichier, temps } from "./ChampsPlan.tsx";

const LIBELLES_APPARITION: Record<ApparitionTexte, string> = { pop: "pop", fondu: "fondu", aucune: "sans effet" };
const TYPES_BRUITAGE = new Set(["son", "ambiance"]);

interface ProprietesHabillage {
  plan: PlanMontage;
  editable: boolean;
  bibliotheque: ElementBibliotheque[];
  positionVideo: () => number;
  changer: (transformation: (copie: PlanMontage) => PlanMontage) => void;
}

function TextesEcran({ plan, editable, positionVideo, changer }: Omit<ProprietesHabillage, "bibliotheque">) {
  const modifier = (index: number, changement: Partial<TexteEcran>) =>
    changer((copie) => ({ ...copie, textes: copie.textes.map((texte, i) => (i === index ? { ...texte, ...changement } : texte)) }));
  return (
    <>
      <h3>Textes à l'écran</h3>
      <p className="note">Un titre ou un mot fort posé sur l'image, à un instant de la vidéo finale, avec la police des sous-titres.</p>
      {plan.textes.length > 0 && (
        <ul className="liste-musiques">
          {plan.textes.map((texte, index) => (
            <li key={index}>
              <input type="text" value={texte.texte} maxLength={80} disabled={!editable} onChange={(evenement) => modifier(index, { texte: evenement.target.value })} />
              <span className="bornes">
                <ChampTemps actif={editable} pas={0.1} valeur={texte.debut} surChangement={(debut) => modifier(index, { debut })} />→
                <ChampTemps actif={editable} pas={0.1} valeur={texte.fin} surChangement={(fin) => modifier(index, { fin })} />
              </span>
              <select value={texte.position} disabled={!editable} onChange={(evenement) => modifier(index, { position: evenement.target.value as PositionTexte })}>
                {POSITIONS_TEXTE.map((position) => (
                  <option key={position} value={position}>
                    {position}
                  </option>
                ))}
              </select>
              <label>
                <ChampTemps actif={editable} pas={1} valeur={texte.taillePourcent} surChangement={(taille) => modifier(index, { taillePourcent: Math.min(25, Math.max(3, taille)) })} /> %
              </label>
              <label title="Décoché : couleur d'accent des sous-titres">
                <input
                  type="checkbox"
                  checked={texte.couleur !== null}
                  disabled={!editable}
                  onChange={(evenement) => modifier(index, { couleur: evenement.target.checked ? "#FFFFFF" : null })}
                />{" "}
                couleur
              </label>
              {texte.couleur !== null && <input type="color" value={texte.couleur} disabled={!editable} onChange={(evenement) => modifier(index, { couleur: evenement.target.value.toUpperCase() })} />}
              <select value={texte.apparition} disabled={!editable} onChange={(evenement) => modifier(index, { apparition: evenement.target.value as ApparitionTexte })}>
                {APPARITIONS_TEXTE.map((apparition) => (
                  <option key={apparition} value={apparition}>
                    {LIBELLES_APPARITION[apparition]}
                  </option>
                ))}
              </select>
              {editable && (
                <button type="button" className="bouton bouton-discret" title="Retirer ce texte" onClick={() => changer((copie) => ({ ...copie, textes: copie.textes.filter((_, i) => i !== index) }))}>
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <button
          type="button"
          className="bouton bouton-discret"
          onClick={() => {
            const debut = Math.round(positionVideo() * 10) / 10;
            changer((copie) => ({ ...copie, textes: [...copie.textes, { ...TEXTE_PAR_DEFAUT, texte: "Texte", debut, fin: debut + 2 }] }));
          }}
        >
          + Texte à la position du lecteur
        </button>
      )}
    </>
  );
}

function Bruitages({ plan, editable, bibliotheque, positionVideo, changer }: ProprietesHabillage) {
  const sons = bibliotheque.filter(({ asset, statut }) => statut.valide && TYPES_BRUITAGE.has(asset.type));
  const [choix, setChoix] = useState("");
  const modifier = (index: number, changement: Partial<Bruitage>) =>
    changer((copie) => ({ ...copie, bruitages: copie.bruitages.map((bruitage, i) => (i === index ? { ...bruitage, ...changement } : bruitage)) }));
  if (plan.bruitages.length === 0 && (!editable || sons.length === 0)) return null;
  return (
    <>
      <h3>Bruitages</h3>
      <p className="note">Sons ponctuels de la bibliothèque (whoosh, pop, impact) posés à un instant de la vidéo finale.</p>
      {plan.bruitages.length > 0 && (
        <ul className="liste-musiques">
          {plan.bruitages.map((bruitage, index) => (
            <li key={`${bruitage.reference}-${index}`}>
              <strong>{bruitage.origine === "projet" ? nomFichier(bruitage.reference) : bruitage.reference}</strong> à
              <ChampTemps actif={editable} pas={0.1} valeur={bruitage.position} surChangement={(position) => modifier(index, { position: Math.max(0, position) })} />
              s ({temps(bruitage.position)}),
              <label>
                <ChampTemps actif={editable} pas={1} valeur={bruitage.volumeDb} surChangement={(volumeDb) => modifier(index, { volumeDb: Math.min(6, Math.max(-40, volumeDb)) })} /> dB
              </label>
              {bruitage.raison !== "" && <span className="note">{bruitage.raison}</span>}
              {editable && (
                <button type="button" className="bouton bouton-discret" title="Retirer ce bruitage" onClick={() => changer((copie) => ({ ...copie, bruitages: copie.bruitages.filter((_, i) => i !== index) }))}>
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && sons.length > 0 && (
        <div className="ligne-actions">
          <select value={choix} onChange={(evenement) => setChoix(evenement.target.value)}>
            <option value="">Choisir un son…</option>
            {sons.map(({ asset }) => (
              <option key={asset.id} value={asset.id}>
                {asset.id}
                {asset.description === "" ? "" : ` · ${asset.description}`}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="bouton bouton-discret"
            disabled={choix === ""}
            onClick={() => {
              const position = Math.round(positionVideo() * 10) / 10;
              changer((copie) => ({ ...copie, bruitages: [...copie.bruitages, { origine: "bibliotheque", reference: choix, position, volumeDb: -6, raison: "Ajouté à la main" }] }));
            }}
          >
            + Bruitage à la position du lecteur
          </button>
        </div>
      )}
    </>
  );
}

export function Habillage(proprietes: ProprietesHabillage) {
  return (
    <>
      <TextesEcran {...proprietes} />
      <Bruitages {...proprietes} />
    </>
  );
}
