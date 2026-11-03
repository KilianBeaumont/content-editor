import {
  CRITERES_EXTRAIT,
  LIBELLES_CRITERES,
  tacheActive,
  type CandidatPropose,
  type DetailProjet,
  type PassageExtrait,
  type Projet,
  type ReponseExtraits,
  type Tache,
} from "@editeur/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { envoyerJson, lireJson, messageErreur, urlFichier } from "../../api.ts";
import { Message } from "../../composants/Message.tsx";
import { LigneTache } from "../../composants/Taches.tsx";
import { resumeCadrage } from "./Cadrages.tsx";
import { temps } from "./ChampsPlan.tsx";

function ecart(valeur: number): string {
  return valeur === 0 ? "" : `${valeur > 0 ? "+" : ""}${valeur.toFixed(2).replace(".", ",")} s`;
}

interface ProprietesCarte {
  candidat: CandidatPropose;
  lire: (passage: PassageExtrait) => void;
  creer: (titre: string) => Promise<void>;
}

function CarteExtrait({ candidat, lire, creer }: ProprietesCarte) {
  const [titre, setTitre] = useState(candidat.titre);
  const [enCours, setEnCours] = useState(false);
  return (
    <div className="carte-extrait">
      <div className="entete-section">
        <h4>
          {candidat.numero}. {candidat.titre}
        </h4>
        <span className="badge">{candidat.noteGlobale.toFixed(1).replace(".", ",")} / 10</span>
      </div>
      <p className="note">
        {temps(candidat.duree)} · {candidat.passages.length} passage{candidat.passages.length > 1 ? "s" : ""}
      </p>
      <ul className="notes-extrait">
        {CRITERES_EXTRAIT.map((critere) => (
          <li key={critere}>
            <span>{LIBELLES_CRITERES[critere]}</span>
            <meter min={0} max={10} value={candidat.notes[critere]} />
            <span className="note">{candidat.notes[critere]}</span>
          </li>
        ))}
      </ul>
      <p>
        <strong>Accroche : </strong>
        {candidat.accroche}
      </p>
      <p className="note">{candidat.justification}</p>
      <ol className="passages-extrait">
        {candidat.passages.map((passage, index) => {
          const recalage = candidat.recalages[index];
          const ecarts = recalage === undefined ? "" : [ecart(recalage.debut) && `début ${ecart(recalage.debut)}`, ecart(recalage.fin) && `fin ${ecart(recalage.fin)}`].filter(Boolean).join(", ");
          return (
            <li key={`${passage.source}-${passage.debut}`}>
              <button type="button" className="bouton bouton-discret" onClick={() => lire(passage)}>
                ▶
              </button>{" "}
              {temps(passage.debut)} → {temps(passage.fin)} <span className="note">· {resumeCadrage(passage.cadrage)}{ecarts && ` · recalé : ${ecarts}`}</span>
              <br />
              <span className="cellule-citation">« {passage.citation} »</span>
            </li>
          );
        })}
      </ol>
      {candidat.projet !== null ? (
        <Link className="bouton" to={`/projets/${candidat.projet}?etape=plan`}>
          Ouvrir le format court →
        </Link>
      ) : (
        <div className="formulaire-plan">
          <label className="champ">
            <span className="champ-libelle">Titre du format court</span>
            <input type="text" value={titre} maxLength={150} onChange={(evenement) => setTitre(evenement.target.value)} />
          </label>
          <button
            type="button"
            className="bouton bouton-principal"
            disabled={enCours || titre.trim() === ""}
            onClick={() => {
              setEnCours(true);
              void creer(titre).finally(() => setEnCours(false));
            }}
          >
            Créer le format court
          </button>
        </div>
      )}
    </div>
  );
}

interface ProprietesExtraits {
  projet: DetailProjet;
  taches: Tache[];
  proxies: Map<string, string>;
}

export function ExtraitsCourts({ projet, taches, proxies }: ProprietesExtraits) {
  const [extraits, setExtraits] = useState<ReponseExtraits | null>(null);
  const [consigne, setConsigne] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [passage, setPassage] = useState<PassageExtrait | null>(null);
  const lecteur = useRef<HTMLVideoElement>(null);
  const naviguer = useNavigate();
  const tachesExtraits = taches.filter((tache) => tache.type === "proposition-extraits" && tache.projet === projet.id);
  const active = tachesExtraits.find(tacheActive) ?? null;
  const derniere = tachesExtraits[0] ?? null;
  const precedente = useRef(active?.id ?? null);

  const charger = useCallback(() => {
    lireJson<ReponseExtraits>(`/api/projets/${projet.id}/extraits`)
      .then(setExtraits)
      .catch((e: unknown) => setErreur(messageErreur(e)));
  }, [projet.id]);
  useEffect(charger, [charger]);
  useEffect(() => {
    const id = active?.id ?? null;
    if (precedente.current !== null && id === null) charger();
    precedente.current = id;
  }, [active?.id, charger]);

  useEffect(() => {
    const element = lecteur.current;
    if (element === null || passage === null) return;
    const source = urlFichier(`${projet.chemin}/${proxies.get(passage.source) ?? passage.source}`);
    const demarrer = () => {
      element.currentTime = passage.debut;
      void element.play();
    };
    const arreter = () => {
      if (element.currentTime >= passage.fin) element.pause();
    };
    element.addEventListener("timeupdate", arreter);
    if (element.getAttribute("src") !== source) {
      element.src = source;
      element.addEventListener("loadedmetadata", demarrer, { once: true });
    } else demarrer();
    return () => element.removeEventListener("timeupdate", arreter);
  }, [passage, projet.chemin, proxies]);

  async function proposer() {
    setErreur(null);
    try {
      await envoyerJson("POST", `/api/projets/${projet.id}/extraits/proposer`, { consigne });
      setConsigne("");
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  async function creer(numero: number, titre: string) {
    setErreur(null);
    try {
      const enfant = await envoyerJson<Projet>("POST", `/api/projets/${projet.id}/extraits/creer`, { numero, titre });
      void naviguer(`/projets/${enfant.id}?etape=plan`);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  const nombre = extraits?.nombreDemande ?? 3;
  const propositions = extraits?.propositions ?? null;
  const sansVersion = projet.metadata.versionValidee === null;

  return (
    <section className="section">
      <h2>Formats courts tirés de cette vidéo</h2>
      <p className="section-intro">
        Claude choisit dans la version validée les meilleurs passages pour des formats courts 9:16 (TikTok, Reels, Shorts), les note sur cinq
        critères et propose un cadrage. L'outil recale les bornes au mot près. Chaque extrait retenu devient un projet « format court » lié à
        celui-ci, qui partage ses rushes sans les copier.
      </p>
      {erreur && <Message type="erreur">{erreur}</Message>}
      {sansVersion ? (
        <p className="note">Valide d'abord une version de la vidéo longue (onglet Aperçu).</p>
      ) : active !== null ? (
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
          <div className="formulaire-plan">
            <label className="champ">
              <span className="champ-libelle">Consigne pour Claude (facultatif)</span>
              <textarea rows={1} value={consigne} maxLength={4000} placeholder="par exemple : un extrait drôle, un extrait conseil" onChange={(evenement) => setConsigne(evenement.target.value)} />
            </label>
            <button type="button" className={propositions === null ? "bouton bouton-principal" : "bouton"} onClick={() => void proposer()}>
              {propositions === null ? `Proposer ${nombre} extraits` : "Proposer d'autres extraits"}
            </button>
          </div>
        </>
      )}

      {propositions !== null && propositions.candidats.length > 0 && (
        <>
          <p className="note">
            Proposés à partir de la version {propositions.version}, du plus fort au moins fort. ▶ joue un passage dans le lecteur.
          </p>
          <video ref={lecteur} className="video-extraits" controls preload="none" />
          <div className="grille-extraits">
            {propositions.candidats.map((candidat) => (
              <CarteExtrait key={candidat.numero} candidat={candidat} lire={setPassage} creer={(titre) => creer(candidat.numero, titre)} />
            ))}
          </div>
        </>
      )}

      {extraits !== null && extraits.enfants.length > 0 && (
        <>
          <h3>Formats courts créés</h3>
          <ul>
            {extraits.enfants.map((enfant) => (
              <li key={enfant.id}>
                <Link to={`/projets/${enfant.id}`}>{enfant.titre}</Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
