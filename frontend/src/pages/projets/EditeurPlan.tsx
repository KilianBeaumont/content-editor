import {
  dureePlan,
  estCategorieVerticale,
  TRANSITIONS,
  type DetailProjet,
  type ElementBibliotheque,
  type PlanMontage,
  type ProblemePlan,
  type SegmentPlan,
  type Transition,
  type VersionPlan,
} from "@editeur/shared";
import { Fragment, useEffect, useRef, useState } from "react";
import { envoyerJson, messageErreur, urlFichier } from "../../api.ts";
import { Message } from "../../composants/Message.tsx";
import { CadreSurVideo, ControlesCadrage, resumeCadrage } from "./Cadrages.tsx";
import { ChampTemps, nomFichier, temps } from "./ChampsPlan.tsx";
import { Habillage } from "./Habillage.tsx";

const LIBELLES_TRANSITION: Record<Transition, string> = { coupe: "coupe", flash: "flash blanc", fondu: "fondu du noir" };

function Problemes({ problemes, perimes }: { problemes: ProblemePlan[]; perimes: boolean }) {
  const erreurs = problemes.filter((probleme) => probleme.niveau === "erreur");
  const avertissements = problemes.filter((probleme) => probleme.niveau === "avertissement");
  const liste = (elements: ProblemePlan[]) => (
    <ul>
      {elements.map((probleme, index) => (
        <li key={`${probleme.segment ?? "-"}-${index}`}>
          {probleme.segment !== null && <strong>{probleme.segment} : </strong>}
          {probleme.message}
        </li>
      ))}
    </ul>
  );
  return (
    <>
      {erreurs.length > 0 && <Message type="erreur">À corriger avant l'aperçu{perimes && " (vérifié au dernier enregistrement)"} :{liste(erreurs)}</Message>}
      {avertissements.length > 0 && <Message type="alerte">{liste(avertissements)}</Message>}
    </>
  );
}

interface Passage {
  source: string;
  debut: number;
  fin: number;
  jouer?: boolean;
}

type CadrageOuvert = { type: "segment" | "coupe"; index: number } | null;

interface ProprietesEditeur {
  projet: DetailProjet;
  version: VersionPlan;
  initial: PlanMontage;
  proxies: Map<string, string>;
  bibliotheque: ElementBibliotheque[];
  surEnregistrement: (version: VersionPlan) => void;
}

export function EditeurPlan({ projet, version, initial, proxies, bibliotheque, surEnregistrement }: ProprietesEditeur) {
  const [plan, setPlan] = useState<PlanMontage>(initial);
  const [problemes, setProblemes] = useState(version.problemes);
  const [modifie, setModifie] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [passage, setPassage] = useState<Passage | null>(null);
  const [enLecture, setEnLecture] = useState<number | null>(null);
  const [cadrageOuvert, setCadrageOuvert] = useState<CadrageOuvert>(null);
  const [dimensionsVideo, setDimensionsVideo] = useState<{ largeur: number; hauteur: number } | null>(null);
  const lecteur = useRef<HTMLVideoElement>(null);
  const suite = useRef<Passage[]>([]);

  useEffect(() => {
    setPlan(initial);
    setProblemes(version.problemes);
    setModifie(false);
  }, [version, initial]);

  const editable = plan.statut === "propose" && !version.apercu;
  const total = dureePlan(plan);
  const dureeVisee = projet.metadata.consignes.dureeViseeMinutes;
  const erreurs = problemes.filter((probleme) => probleme.niveau === "erreur").length;
  const debutsTimeline = plan.segments.map((_, index) => dureePlan({ segments: plan.segments.slice(0, index) }));

  useEffect(() => {
    if (passage === null) return;
    let image = 0;
    const surveiller = () => {
      const element = lecteur.current;
      if (element !== null && !element.paused && element.currentTime >= passage.fin) {
        const [prochain, ...reste] = suite.current;
        suite.current = reste;
        if (prochain === undefined) {
          element.pause();
          setEnLecture(null);
        } else {
          setEnLecture((index) => (index === null ? null : index + 1));
          setPassage(prochain);
        }
      }
      image = requestAnimationFrame(surveiller);
    };
    image = requestAnimationFrame(surveiller);
    return () => cancelAnimationFrame(image);
  }, [passage]);

  useEffect(() => {
    const element = lecteur.current;
    if (element === null || passage === null) return;
    const source = urlFichier(`${projet.chemin}/${proxies.get(passage.source) ?? passage.source}`);
    const demarrer = () => {
      element.currentTime = passage.debut;
      if (passage.jouer === false) element.pause();
      else void element.play();
    };
    if (element.getAttribute("src") !== source) {
      element.src = source;
      element.addEventListener("loadedmetadata", demarrer, { once: true });
    } else {
      demarrer();
    }
  }, [passage, projet.chemin, proxies]);

  function lire(element: Passage) {
    suite.current = [];
    setEnLecture(null);
    setPassage({ ...element });
  }

  function lireTout() {
    const [premier, ...reste] = plan.segments;
    if (premier === undefined) return;
    suite.current = reste.map(({ source, debut, fin }) => ({ source, debut, fin }));
    setEnLecture(0);
    setPassage({ source: premier.source, debut: premier.debut, fin: premier.fin });
  }

  const position = () => lecteur.current?.currentTime ?? 0;
  const positionVideo = () => {
    const instant = position();
    const index = plan.segments.findIndex((segment) => segment.source === passage?.source && instant >= segment.debut && instant <= segment.fin);
    const segment = plan.segments[index];
    return segment === undefined ? 0 : (debutsTimeline[index] ?? 0) + instant - segment.debut;
  };
  const ratioSortie = estCategorieVerticale(projet.metadata.categorie) ? 9 / 16 : 16 / 9;
  const cadrageAffiche =
    cadrageOuvert === null
      ? null
      : cadrageOuvert.type === "segment"
        ? (plan.segments[cadrageOuvert.index]?.cadrage ?? null)
        : (plan.plansDeCoupe[cadrageOuvert.index]?.cadrage ?? null);

  function basculerCadrage(ouvert: NonNullable<CadrageOuvert>, element: Passage) {
    const memeElement = cadrageOuvert?.type === ouvert.type && cadrageOuvert.index === ouvert.index;
    setCadrageOuvert(memeElement ? null : ouvert);
    if (!memeElement) {
      suite.current = [];
      setEnLecture(null);
      setPassage({ source: element.source, debut: element.debut, fin: element.fin, jouer: false });
    }
  }

  function changer(transformation: (copie: PlanMontage) => PlanMontage) {
    setPlan((actuel) => transformation(structuredClone(actuel)));
    setModifie(true);
  }

  function changerSegment(index: number, changement: Partial<SegmentPlan>) {
    changer((copie) => ({ ...copie, segments: copie.segments.map((segment, i) => (i === index ? { ...segment, ...changement } : segment)) }));
  }

  function deplacer(index: number, sens: -1 | 1) {
    changer((copie) => {
      const segments = [...copie.segments];
      const [segment] = segments.splice(index, 1);
      if (segment !== undefined) segments.splice(index + sens, 0, segment);
      return { ...copie, segments: segments.map((element, i) => (i === 0 ? { ...element, decalageImage: 0 } : element)) };
    });
  }

  async function envoyer(action: () => Promise<VersionPlan>) {
    setEnCours(true);
    setErreur(null);
    try {
      const resultat = await action();
      setModifie(false);
      surEnregistrement(resultat);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  const url = `/api/projets/${projet.id}/plans/${plan.version}`;
  const { version: _version, statut: _statut, creeLe: _creeLe, modifieLe: _modifieLe, ...proposition } = plan;
  const enregistrer = () => envoyer(() => envoyerJson<VersionPlan>("PUT", url, proposition));
  const statut = (nouveau: PlanMontage["statut"]) => envoyer(() => envoyerJson<VersionPlan>("POST", `${url}/statut`, { statut: nouveau }));

  return (
    <>
      <p className="carte-badges">
        <span className="badge">{plan.version}</span>
        <span className={plan.statut === "valide" ? "badge badge-ok" : "badge"}>{plan.statut === "valide" ? "Validé" : "Proposé"}</span>
        {plan.modifieLe !== null && <span className="badge">Modifié à la main</span>}
        <span className="note">
          {plan.segments.length} segment{plan.segments.length > 1 ? "s" : ""} · {temps(total)}
          {dureeVisee !== null && ` pour ${temps(dureeVisee * 60)} visées`}
        </span>
      </p>
      <Problemes problemes={problemes} perimes={modifie} />
      <div className="bloc-texte">
        <span className="champ-libelle">Stratégie</span>
        <p>{plan.resume}</p>
      </div>
      {plan.reponsesRetours.length > 0 && (
        <details className="points-claude" open>
          <summary>Ce que Claude a changé d'après tes commentaires</summary>
          <ul>
            {plan.reponsesRetours.map((reponse) => (
              <li key={reponse.commentaire}>{reponse.changement}</li>
            ))}
          </ul>
        </details>
      )}
      {plan.pointsAVerifier.length > 0 && (
        <details className="points-claude">
          <summary>Claude signale {plan.pointsAVerifier.length} point{plan.pointsAVerifier.length > 1 ? "s" : ""}</summary>
          <ul>
            {plan.pointsAVerifier.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="lecteur-plan">
        <div className="video-cadree">
          <video
            ref={lecteur}
            controls
            preload="none"
            onPause={() => setEnLecture(null)}
            onLoadedMetadata={(evenement) => setDimensionsVideo({ largeur: evenement.currentTarget.videoWidth, hauteur: evenement.currentTarget.videoHeight })}
          />
          <CadreSurVideo video={lecteur.current} dimensions={dimensionsVideo} ratioSortie={ratioSortie} cadrage={cadrageAffiche} />
        </div>
        <div>
          <button type="button" className="bouton" onClick={lireTout} disabled={plan.segments.length === 0}>
            ▶ Enchaîner tout le plan
          </button>
          <p className="note">
            {enLecture !== null
              ? `Lecture de ${plan.segments[enLecture]?.id ?? ""}`
              : "Lecture rapide sur les proxys, sans les décalages d'image ni les plans de coupe : l'aperçu rendu les montrera."}
          </p>
        </div>
      </div>

      <table className="tableau tableau-plan">
        <thead>
          <tr>
            <th>#</th>
            <th>Passage dans le rush</th>
            <th>Image</th>
            <th>Cadre</th>
            <th>Ce qui est dit · pourquoi</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {plan.segments.map((segment, index) => {
            const enErreur = problemes.some((probleme) => probleme.segment === segment.id && probleme.niveau === "erreur");
            const ouvert = cadrageOuvert?.type === "segment" && cadrageOuvert.index === index;
            return (
              <Fragment key={`${segment.id}-${index}`}>
              <tr className={[enErreur ? "ligne-erreur" : "", enLecture === index || ouvert ? "ligne-selectionnee" : ""].join(" ")}>
                <td>
                  <strong>{segment.id}</strong>
                  <br />
                  <label className="note" title="Segment d'accroche">
                    <input
                      type="radio"
                      name={`accroche-${plan.version}`}
                      checked={plan.hook.segment === segment.id}
                      disabled={!editable}
                      onChange={() => changer((copie) => ({ ...copie, hook: { ...copie.hook, segment: segment.id } }))}
                    />{" "}
                    accroche
                  </label>
                </td>
                <td className="cellule-passage">
                  <span className="note" title={segment.source}>
                    {nomFichier(segment.source)} · {segment.role} · à {temps(debutsTimeline[index] ?? 0)} dans la vidéo
                  </span>
                  <span className="bornes">
                    <ChampTemps actif={editable} valeur={segment.debut} surChangement={(debut) => changerSegment(index, { debut })} />
                    {editable && (
                      <button type="button" className="bouton bouton-discret" title="Début = position du lecteur" onClick={() => changerSegment(index, { debut: Math.round(position() * 100) / 100 })}>
                        ⇤
                      </button>
                    )}
                    →
                    <ChampTemps actif={editable} valeur={segment.fin} surChangement={(fin) => changerSegment(index, { fin })} />
                    {editable && (
                      <button type="button" className="bouton bouton-discret" title="Fin = position du lecteur" onClick={() => changerSegment(index, { fin: Math.round(position() * 100) / 100 })}>
                        ⇥
                      </button>
                    )}
                    <span className="note">{(segment.fin - segment.debut).toFixed(1).replace(".", ",")} s</span>
                  </span>
                </td>
                <td>
                  <select
                    className="choix-transition"
                    title="Entrée dans ce segment"
                    value={segment.transition}
                    disabled={!editable}
                    onChange={(evenement) => changerSegment(index, { transition: evenement.target.value as Transition })}
                  >
                    {TRANSITIONS.map((transition) => (
                      <option key={transition} value={transition}>
                        {LIBELLES_TRANSITION[transition]}
                      </option>
                    ))}
                  </select>
                  {index > 0 && (
                    <label className="note decalage" title="Négatif : l'image arrive en avance sous la fin du son précédent. Positif : l'image précédente reste.">
                      <ChampTemps actif={editable} pas={0.1} valeur={segment.decalageImage} surChangement={(decalageImage) => changerSegment(index, { decalageImage })} /> s
                      <br />
                      {segment.decalageImage < 0 ? "en avance" : segment.decalageImage > 0 ? "en retard" : "sans décalage"}
                    </label>
                  )}
                </td>
                <td>
                  <button type="button" className="bouton bouton-discret" onClick={() => basculerCadrage({ type: "segment", index }, segment)}>
                    {resumeCadrage(segment.cadrage)}
                  </button>
                </td>
                <td className="cellule-citation">
                  {segment.citation === "" ? <span className="note">—</span> : `« ${segment.citation} »`}
                  <br />
                  <span className="note">{segment.raison}</span>
                </td>
                <td className="cellule-action">
                  <button type="button" className="bouton bouton-discret" title="Écouter ce segment" onClick={() => lire(segment)}>
                    ▶
                  </button>
                  {editable && (
                    <>
                      <button type="button" className="bouton bouton-discret" title="Monter" disabled={index === 0} onClick={() => deplacer(index, -1)}>
                        ▲
                      </button>
                      <button type="button" className="bouton bouton-discret" title="Descendre" disabled={index === plan.segments.length - 1} onClick={() => deplacer(index, 1)}>
                        ▼
                      </button>
                      <button
                        type="button"
                        className="bouton bouton-discret"
                        title="Retirer ce segment"
                        onClick={() => changer((copie) => ({ ...copie, segments: copie.segments.filter((_, i) => i !== index).map((element, i) => (i === 0 ? { ...element, decalageImage: 0 } : element)) }))}
                      >
                        ✕
                      </button>
                    </>
                  )}
                </td>
              </tr>
              {ouvert && (
                <tr className="ligne-cadrage">
                  <td colSpan={6}>
                    <ControlesCadrage cadrage={segment.cadrage} editable={editable} surChangement={(cadrage) => changerSegment(index, { cadrage })} />
                  </td>
                </tr>
              )}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      {(plan.plansDeCoupe.length > 0 || editable) && (
        <>
          <h3>Plans de coupe</h3>
          <p className="note">Une image sans son, prise dans un rush, posée par-dessus la voix à un instant de la vidéo finale.</p>
          {plan.plansDeCoupe.length > 0 && (
            <table className="tableau tableau-plan">
              <tbody>
                {plan.plansDeCoupe.map((coupe, index) => {
                  const changerCoupe = (changement: Partial<typeof coupe>) =>
                    changer((copie) => ({ ...copie, plansDeCoupe: copie.plansDeCoupe.map((element, i) => (i === index ? { ...element, ...changement } : element)) }));
                  const ouvert = cadrageOuvert?.type === "coupe" && cadrageOuvert.index === index;
                  return (
                    <Fragment key={`${coupe.source}-${index}`}>
                    <tr className={ouvert ? "ligne-selectionnee" : undefined}>
                      <td className="cellule-passage">
                        <span className="note">{nomFichier(coupe.source)}</span>
                        <span className="bornes">
                          <ChampTemps actif={editable} valeur={coupe.debut} surChangement={(debut) => changerCoupe({ debut })} />→
                          <ChampTemps actif={editable} valeur={coupe.fin} surChangement={(fin) => changerCoupe({ fin })} />
                        </span>
                      </td>
                      <td>
                        <label className="note">
                          à <ChampTemps actif={editable} pas={0.1} valeur={coupe.position} surChangement={(valeur) => changerCoupe({ position: valeur })} /> s dans la vidéo
                        </label>
                      </td>
                      <td>
                        <button type="button" className="bouton bouton-discret" onClick={() => basculerCadrage({ type: "coupe", index }, coupe)}>
                          {resumeCadrage(coupe.cadrage)}
                        </button>
                      </td>
                      <td className="note">{coupe.raison}</td>
                      <td className="cellule-action">
                        <button type="button" className="bouton bouton-discret" title="Voir cette image" onClick={() => lire(coupe)}>
                          ▶
                        </button>
                        {editable && (
                          <button
                            type="button"
                            className="bouton bouton-discret"
                            title="Retirer ce plan de coupe"
                            onClick={() => changer((copie) => ({ ...copie, plansDeCoupe: copie.plansDeCoupe.filter((_, i) => i !== index) }))}
                          >
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                    {ouvert && (
                      <tr className="ligne-cadrage">
                        <td colSpan={5}>
                          <ControlesCadrage cadrage={coupe.cadrage} editable={editable} surChangement={(cadrage) => changerCoupe({ cadrage })} />
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
          {editable && (
            <button
              type="button"
              className="bouton bouton-discret"
              disabled={passage === null}
              title={passage === null ? "Lis d'abord un passage dans le lecteur" : undefined}
              onClick={() => {
                if (passage === null) return;
                const debut = Math.round(position() * 100) / 100;
                changer((copie) => ({ ...copie, plansDeCoupe: [...copie.plansDeCoupe, { source: passage.source, debut, fin: debut + 2, position: 0, raison: "Ajouté à la main", cadrage: null }] }));
              }}
            >
              + Plan de coupe depuis la position du lecteur
            </button>
          )}
        </>
      )}

      <label className="case-sous-titres">
        <input type="checkbox" checked={plan.sousTitres} disabled={!editable} onChange={(evenement) => changer((copie) => ({ ...copie, sousTitres: evenement.target.checked }))} />{" "}
        <strong>Sous-titres incrustés</strong> <span className="note">mot à mot, avec le style des Paramètres → Sous-titres (police de ta bibliothèque)</span>
      </label>

      <Habillage plan={plan} editable={editable} vertical={estCategorieVerticale(projet.metadata.categorie)} bibliotheque={bibliotheque} positionVideo={positionVideo} changer={changer} />

      {plan.musiques.length > 0 && (
        <>
          <h3>Musique</h3>
          <ul className="liste-musiques">
            {plan.musiques.map((musique, index) => (
              <li key={`${musique.reference}-${index}`}>
                <strong>{musique.origine === "projet" ? nomFichier(musique.reference) : musique.reference}</strong> de {temps(musique.debut)} à{" "}
                {musique.fin === null ? "la fin" : temps(musique.fin)},
                <label>
                  <ChampTemps
                    actif={editable}
                    pas={1}
                    valeur={musique.volumeDb}
                    surChangement={(volumeDb) =>
                      changer((copie) => ({ ...copie, musiques: copie.musiques.map((element, i) => (i === index ? { ...element, volumeDb: Math.min(0, Math.max(-60, volumeDb)) } : element)) }))
                    }
                  />{" "}
                  dB
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={musique.baisseSousVoix}
                    disabled={!editable}
                    onChange={(evenement) =>
                      changer((copie) => ({ ...copie, musiques: copie.musiques.map((element, i) => (i === index ? { ...element, baisseSousVoix: evenement.target.checked } : element)) }))
                    }
                  />{" "}
                  baissée sous la voix
                </label>
                {editable && (
                  <button type="button" className="bouton bouton-discret" onClick={() => changer((copie) => ({ ...copie, musiques: copie.musiques.filter((_, i) => i !== index) }))}>
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {erreur && <Message type="erreur">{erreur}</Message>}
      <div className="ligne-actions actions-plan">
        {modifie ? (
          <>
            <button type="button" className="bouton bouton-principal" disabled={enCours} onClick={() => void enregistrer()}>
              Enregistrer les modifications
            </button>
            <button
              type="button"
              className="bouton"
              disabled={enCours}
              onClick={() => {
                setPlan(initial);
                setModifie(false);
              }}
            >
              Annuler les modifications
            </button>
          </>
        ) : plan.statut === "propose" && !version.apercu ? (
          <button type="button" className="bouton bouton-principal" disabled={enCours || erreurs > 0} onClick={() => void statut("valide")}>
            Valider le plan
          </button>
        ) : (
          plan.statut === "valide" &&
          !version.apercu && (
            <>
              <span className="note">Plan validé.</span>
              <button type="button" className="bouton" disabled={enCours} onClick={() => void statut("propose")}>
                Repasser en brouillon
              </button>
            </>
          )
        )}
      </div>
    </>
  );
}
