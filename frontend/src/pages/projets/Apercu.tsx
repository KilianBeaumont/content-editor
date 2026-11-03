import {
  cheminApercu,
  situer,
  tacheActive,
  type CommentaireRetour,
  type DetailProjet,
  type PlanMontage,
  type RetoursVersion,
  type Tache,
  type VersionPlan,
} from "@editeur/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { envoyerJson, lireJson, messageErreur, urlFichier } from "../../api.ts";
import { Message } from "../../composants/Message.tsx";
import { LigneTache } from "../../composants/Taches.tsx";
import { temps } from "./ChampsPlan.tsx";

type VersionRendue = VersionPlan & { plan: PlanMontage };

function estRendue(version: VersionPlan): version is VersionRendue {
  return version.apercu && version.plan !== null;
}

function Lancement({ projet, version, taches }: { projet: DetailProjet; version: VersionPlan; taches: Tache[] }) {
  const [erreur, setErreur] = useState<string | null>(null);
  const duVersion = taches.filter((tache) => tache.type === "rendu-apercu" && tache.projet === projet.id && tache.parametres.version === version.version);
  const active = duVersion.find(tacheActive) ?? null;
  const derniere = duVersion[0] ?? null;

  async function lancer() {
    setErreur(null);
    try {
      await envoyerJson("POST", `/api/projets/${projet.id}/plans/${version.version}/apercu`);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  return (
    <div className="bloc-apercu">
      <h3>Aperçu {version.version}</h3>
      {erreur && <Message type="erreur">{erreur}</Message>}
      {active !== null ? (
        <ul className="liste-taches">
          <LigneTache tache={active} />
        </ul>
      ) : (
        <>
          {derniere?.etat === "echouee" && (
            <ul className="liste-taches">
              <LigneTache tache={derniere} />
            </ul>
          )}
          <p className="section-intro">
            L'aperçu est rendu en basse résolution à partir des proxys : coupes, décalages d'image, plans de coupe, musique et volume
            normalisé. Quelques secondes pour une vidéo d'une minute.
          </p>
          <button type="button" className="bouton bouton-principal" onClick={() => void lancer()}>
            Lancer l'aperçu
          </button>
        </>
      )}
    </div>
  );
}

interface ProprietesCommentaire {
  commentaire: CommentaireRetour;
  plan: PlanMontage;
  aller: (seconde: number) => void;
  modifier: (texte: string, traite: boolean) => Promise<void>;
  supprimer: () => Promise<void>;
}

function Commentaire({ commentaire, plan, aller, modifier, supprimer }: ProprietesCommentaire) {
  const [edition, setEdition] = useState<string | null>(null);
  const situation = commentaire.temps === null ? null : situer(plan.segments, commentaire.temps);
  return (
    <li className={commentaire.traite ? "commentaire commentaire-traite" : "commentaire"}>
      <div className="commentaire-entete">
        {commentaire.temps === null ? (
          <span className="badge">Toute la vidéo</span>
        ) : (
          <button type="button" className="bouton-lien" onClick={() => aller(commentaire.temps ?? 0)}>
            {temps(commentaire.temps)}
          </button>
        )}
        {situation !== null && <span className="note">{situation.segment}</span>}
        {commentaire.traite && <span className="badge badge-ok">✓ traité{commentaire.traiteDans && ` en ${commentaire.traiteDans}`}</span>}
        <span className="ligne-actions">
          <button type="button" className="bouton bouton-discret" onClick={() => setEdition(commentaire.texte)}>
            Modifier
          </button>
          <button type="button" className="bouton bouton-discret" onClick={() => void modifier(commentaire.texte, !commentaire.traite)}>
            {commentaire.traite ? "À retraiter" : "Marquer traité"}
          </button>
          <button type="button" className="bouton bouton-discret" aria-label="Supprimer ce commentaire" onClick={() => void supprimer()}>
            ✕
          </button>
        </span>
      </div>
      {edition === null ? (
        <p>{commentaire.texte}</p>
      ) : (
        <div className="commentaire-edition">
          <textarea rows={2} autoFocus value={edition} maxLength={2000} onChange={(evenement) => setEdition(evenement.target.value)} />
          <span className="ligne-actions">
            <button
              type="button"
              className="bouton bouton-principal bouton-discret"
              onClick={() => void modifier(edition, commentaire.traite).then(() => setEdition(null))}
            >
              Enregistrer
            </button>
            <button type="button" className="bouton bouton-discret" onClick={() => setEdition(null)}>
              Annuler
            </button>
          </span>
        </div>
      )}
      {commentaire.reponse && <p className="note commentaire-reponse">Claude : {commentaire.reponse}</p>}
    </li>
  );
}

interface ProprietesVisionneuse {
  projet: DetailProjet;
  rendues: VersionRendue[];
  derniereVersion: string;
  taches: Tache[];
  surChangement: () => void;
}

function Visionneuse({ projet, rendues, derniereVersion, taches, surChangement }: ProprietesVisionneuse) {
  const [choisie, setChoisie] = useState(rendues[0]?.version ?? "");
  const version = rendues.find((element) => element.version === choisie) ?? rendues[0];
  const [retours, setRetours] = useState<RetoursVersion | null>(null);
  const [texte, setTexte] = useState("");
  const [aLInstant, setALInstant] = useState(true);
  const [consigne, setConsigne] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [instant, setInstant] = useState(0);
  const [duree, setDuree] = useState(0);
  const lecteur = useRef<HTMLVideoElement>(null);
  const reprise = useRef<number | null>(null);
  const plusRecente = rendues[0]?.version;

  useEffect(() => {
    if (plusRecente !== undefined) setChoisie(plusRecente);
  }, [plusRecente]);

  const url = version === undefined ? "" : `/api/projets/${projet.id}/plans/${version.version}/retours`;
  const charger = useCallback(() => {
    if (url === "") return;
    lireJson<RetoursVersion>(url)
      .then(setRetours)
      .catch((e: unknown) => setErreur(messageErreur(e)));
  }, [url]);
  useEffect(charger, [charger]);

  const propositionActive = taches.some((tache) => tache.type === "proposition-plan" && tache.projet === projet.id && tacheActive(tache));
  useEffect(() => {
    if (!propositionActive) charger();
  }, [propositionActive, charger]);

  if (version === undefined) return null;
  const { plan, rendu } = version;
  const departs = plan.segments.map((_, index) => plan.segments.slice(0, index).reduce((total, segment) => total + segment.fin - segment.debut, 0));
  const aTraiter = (retours?.commentaires ?? []).filter((commentaire) => !commentaire.traite);
  const validee = projet.metadata.versionValidee === version.version;
  const peutProduire = version.version === plusRecente && aTraiter.length > 0;

  function aller(seconde: number) {
    const element = lecteur.current;
    if (element === null) return;
    element.currentTime = seconde;
    element.pause();
  }

  function changerVersion(nouvelle: string) {
    reprise.current = lecteur.current?.currentTime ?? null;
    setRetours(null);
    setChoisie(nouvelle);
  }

  async function agir(action: () => Promise<RetoursVersion>) {
    setErreur(null);
    try {
      setRetours(await action());
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  async function commenter() {
    const tempsCommentaire = aLInstant ? (lecteur.current?.currentTime ?? 0) : null;
    await agir(() => envoyerJson<RetoursVersion>("POST", url, { temps: tempsCommentaire, texte }));
    setTexte("");
  }

  async function produire() {
    setErreur(null);
    try {
      await envoyerJson("POST", `/api/projets/${projet.id}/plans/proposer`, { consigne, depuis: version?.version ?? null });
      setConsigne("");
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  async function valider(valide: boolean) {
    setErreur(null);
    try {
      await envoyerJson("POST", `/api/projets/${projet.id}/plans/${version?.version ?? ""}/validation`, { valide });
      surChangement();
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  const position = (seconde: number) => `${Math.min(100, (seconde / (duree || rendu?.duree || 1)) * 100)}%`;

  return (
    <div className="bloc-apercu">
      <div className="entete-section">
        <h3>
          Aperçu {version.version} {validee && <span className="badge badge-ok">✓ Version validée</span>}
        </h3>
        {rendues.length > 1 && (
          <span className="ligne-actions" role="group" aria-label="Version affichée">
            {[...rendues].reverse().map((element) => (
              <button
                key={element.version}
                type="button"
                className={element.version === version.version ? "bouton bouton-principal bouton-discret" : "bouton bouton-discret"}
                onClick={() => changerVersion(element.version)}
              >
                {element.version}
              </button>
            ))}
          </span>
        )}
      </div>
      <div className="visionneuse">
        <div>
          <video
            ref={lecteur}
            className="video-apercu"
            src={urlFichier(`${projet.chemin}/${rendu?.fichier ?? cheminApercu(version.version)}`)}
            controls
            preload="metadata"
            onLoadedMetadata={(evenement) => {
              setDuree(evenement.currentTarget.duration);
              if (reprise.current !== null) evenement.currentTarget.currentTime = Math.min(reprise.current, evenement.currentTarget.duration);
              reprise.current = null;
            }}
            onTimeUpdate={(evenement) => setInstant(evenement.currentTarget.currentTime)}
          />
          <div className="barre-reperes" aria-label="Repères">
            {departs.slice(1).map((depart, index) => (
              <span key={`coupe-${index}`} className="repere-coupe" style={{ left: position(depart) }} title={`Début de ${plan.segments[index + 1]?.id ?? ""}`} />
            ))}
            {(retours?.commentaires ?? [])
              .filter((commentaire) => commentaire.temps !== null)
              .map((commentaire) => (
                <button
                  key={commentaire.id}
                  type="button"
                  className={commentaire.traite ? "repere-commentaire repere-traite" : "repere-commentaire"}
                  style={{ left: position(commentaire.temps ?? 0) }}
                  title={`${temps(commentaire.temps ?? 0)} : ${commentaire.texte}`}
                  onClick={() => aller(commentaire.temps ?? 0)}
                />
              ))}
            <span className="repere-lecture" style={{ left: position(instant) }} />
          </div>
          {rendu !== null && (
            <p className="note">
              {rendu.largeur}x{rendu.hauteur} · {temps(rendu.duree ?? rendu.dureePlan)} · rendu le{" "}
              {new Date(rendu.creeLe).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} en{" "}
              {Math.round(rendu.dureeRenduSecondes)} s · traits : début des segments, points : commentaires
            </p>
          )}
          {rendu !== null && rendu.controles.length > 0 && (
            <Message type="alerte">
              <ul>
                {rendu.controles.map((controle) => (
                  <li key={controle}>{controle}</li>
                ))}
              </ul>
            </Message>
          )}
        </div>
        <div className="commentaires">
          <label className="champ">
            <span className="champ-libelle">Ton commentaire</span>
            <textarea
              rows={3}
              value={texte}
              maxLength={2000}
              placeholder="par exemple : coupe trop tôt, garder la fin de la phrase"
              onFocus={() => lecteur.current?.pause()}
              onChange={(evenement) => setTexte(evenement.target.value)}
              onKeyDown={(evenement) => {
                if (evenement.key === "Enter" && !evenement.shiftKey && texte.trim() !== "") {
                  evenement.preventDefault();
                  void commenter();
                }
              }}
            />
          </label>
          <div className="ligne-actions">
            <label className="note">
              <input type="checkbox" checked={aLInstant} onChange={(evenement) => setALInstant(evenement.target.checked)} /> à {temps(instant)}
              {aLInstant && situer(plan.segments, instant) && ` (${situer(plan.segments, instant)?.segment ?? ""})`}, sinon toute la vidéo
            </label>
            <button type="button" className="bouton" disabled={texte.trim() === ""} onClick={() => void commenter()}>
              Ajouter
            </button>
          </div>
          {erreur && <Message type="erreur">{erreur}</Message>}
          {retours !== null && retours.commentaires.length === 0 && <p className="note">Mets en pause là où quelque chose ne va pas, puis écris ce qu'il faut changer.</p>}
          <ul className="liste-commentaires">
            {(retours?.commentaires ?? []).map((commentaire) => (
              <Commentaire
                key={commentaire.id}
                commentaire={commentaire}
                plan={plan}
                aller={aller}
                modifier={(nouveau, traite) => agir(() => envoyerJson<RetoursVersion>("PUT", `${url}/${commentaire.id}`, { texte: nouveau, traite }))}
                supprimer={() => agir(() => envoyerJson<RetoursVersion>("DELETE", `${url}/${commentaire.id}`))}
              />
            ))}
          </ul>
        </div>
      </div>

      <div className="actions-version">
        {peutProduire && (
          <div className="formulaire-plan">
            <label className="champ">
              <span className="champ-libelle">
                {aTraiter.length} commentaire{aTraiter.length > 1 ? "s" : ""} à intégrer
                {derniereVersion !== version.version && ` (remplacera la proposition ${derniereVersion} en cours)`} · précision pour Claude (facultatif)
              </span>
              <textarea rows={1} value={consigne} maxLength={4000} onChange={(evenement) => setConsigne(evenement.target.value)} />
            </label>
            <button type="button" className="bouton bouton-principal" disabled={propositionActive} onClick={() => void produire()}>
              Produire la version suivante
            </button>
          </div>
        )}
        <div className="ligne-actions">
          {validee ? (
            <button type="button" className="bouton" onClick={() => void valider(false)}>
              Annuler la validation
            </button>
          ) : (
            <button type="button" className={peutProduire ? "bouton" : "bouton bouton-principal"} onClick={() => void valider(true)}>
              C'est la bonne : valider la version {version.version}
            </button>
          )}
          <span className="note">La version validée sera rendue en pleine qualité à l'export (phase 4).</span>
        </div>
      </div>
    </div>
  );
}

interface ProprietesApercu {
  projet: DetailProjet;
  versions: VersionPlan[];
  taches: Tache[];
  surChangement: () => void;
  allerA: (onglet: "plan" | "validation") => void;
}

export function Apercu({ projet, versions, taches, surChangement, allerA }: ProprietesApercu) {
  const courante = versions[0];
  const rendues = versions.filter(estRendue);
  const aLancer = courante !== undefined && courante.plan?.statut === "valide" && !courante.apercu;
  const enAttente = courante !== undefined && courante.plan !== null && courante.plan.statut !== "valide" && !courante.apercu;
  return (
    <section className="section">
      <h2>Aperçu et commentaires</h2>
      {courante === undefined && (
        <div className="appel-suite">
          <span>Pas encore de plan : demande d'abord une proposition à Claude.</span>
          <button type="button" className="bouton" onClick={() => allerA("plan")}>
            ← Plan
          </button>
        </div>
      )}
      {enAttente && (
        <div className="appel-suite">
          <span>
            Le plan {courante.version} n'est pas encore validé{rendues.length > 0 ? " : l'aperçu de la version précédente reste visible ci-dessous" : ""}.
          </span>
          <button type="button" className="bouton" onClick={() => allerA("plan")}>
            ← Valider le plan
          </button>
        </div>
      )}
      {aLancer && <Lancement projet={projet} version={courante} taches={taches} />}
      {rendues.length > 0 && courante !== undefined && (
        <Visionneuse projet={projet} rendues={rendues} derniereVersion={courante.version} taches={taches} surChangement={surChangement} />
      )}
      {projet.metadata.versionValidee !== null && (
        <div className="appel-suite">
          <span>Version {projet.metadata.versionValidee} validée.</span>
          <button type="button" className="bouton bouton-principal" onClick={() => allerA("validation")}>
            Validation →
          </button>
        </div>
      )}
    </section>
  );
}
