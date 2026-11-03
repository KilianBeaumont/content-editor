import {
  EXTENSIONS_INSPIRATION,
  LIBELLES_CATEGORIES,
  tacheActive,
  type Categorie,
  type EtatAnalyse,
  type GuideCategorie,
  type ProfilInspiration,
  type VideoInspiration,
} from "@editeur/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { envoyerJson, formaterTaille, lireJson, messageErreur, urlFichier } from "../../api.ts";
import { BarreEnvoi, useEnvoi } from "../../composants/Envoi.tsx";
import { ZoneDepot } from "../../composants/EnvoisInbox.tsx";
import { Message } from "../../composants/Message.tsx";
import { LigneTache, useTaches } from "../../composants/Taches.tsx";

const ETATS: Record<EtatAnalyse, { texte: string; classe: string }> = {
  absente: { texte: "À analyser", classe: "badge" },
  "a-jour": { texte: "✓ Analysée", classe: "badge badge-ok" },
  perimee: { texte: "Vidéo modifiée depuis", classe: "badge badge-alerte" },
};

function nombre(valeur: number | null, unite = "", decimales = 1): string {
  return valeur === null ? "?" : `${valeur.toFixed(decimales).replace(".", ",")}${unite}`;
}

function Profil({ profil }: { profil: ProfilInspiration }) {
  const lignes: [string, string][] = [
    ["Durée", `${nombre(profil.duree, " s")}${profil.largeur !== null ? ` · ${profil.largeur}x${profil.hauteur ?? "?"}` : ""}`],
    ["Coupes", `${profil.coupes} · ${nombre(profil.coupesParMinute)} par minute · première à ${nombre(profil.premiereCoupe, " s")}`],
    ["Plans", `médiane ${nombre(profil.dureeMedianePlan, " s")} · moyenne ${nombre(profil.dureeMoyennePlan, " s")} · le plus long ${nombre(profil.plusLongPlan, " s")}`],
    ["Parole", `${nombre(profil.motsParMinute, "", 0)} mots par minute · premier mot à ${nombre(profil.premierMot, " s")} · ${profil.partParole === null ? "?" : `${Math.round(profil.partParole * 100)} %`} du temps`],
    ["Silences", `le plus long : ${nombre(profil.plusLongSilence, " s")}`],
  ];
  return (
    <table className="tableau tableau-profil">
      <tbody>
        {lignes.map(([libelle, valeur]) => (
          <tr key={libelle}>
            <th>{libelle}</th>
            <td>{valeur}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DetailVideo({ video }: { video: VideoInspiration }) {
  return (
    <div className="detail-inspiration">
      <div>
        <video className="video-inspiration" src={urlFichier(video.chemin)} controls preload="metadata" />
        {video.profil !== null && <Profil profil={video.profil} />}
      </div>
      <div>
        {video.claude === null ? (
          <p className="note">Pas encore d'analyse de Claude.</p>
        ) : (
          <>
            <div className="bloc-texte">
              <span className="champ-libelle">Ce qu'on en retient</span>
              <p>{video.claude.resume}</p>
            </div>
            <span className="champ-libelle">Techniques repérées</span>
            <ul>
              {video.claude.techniques.map((technique) => (
                <li key={technique}>{technique}</li>
              ))}
            </ul>
            <details>
              <summary>Analyse complète</summary>
              <div className="analyse-texte">{video.claude.analyse}</div>
            </details>
          </>
        )}
        {video.planches.length > 0 && (
          <details className="planches">
            <summary>Images analysées ({video.planches.length})</summary>
            {video.planches.map((planche) => (
              <a key={planche} href={urlFichier(planche)} target="_blank" rel="noreferrer">
                <img src={urlFichier(planche)} alt={planche.split("/").at(-1)} loading="lazy" />
              </a>
            ))}
          </details>
        )}
      </div>
    </div>
  );
}

export function PageGuide() {
  const { categorie = "vlog" } = useParams();
  const [guide, setGuide] = useState<GuideCategorie | null>(null);
  const [style, setStyle] = useState("");
  const [hooks, setHooks] = useState("");
  const [modifie, setModifie] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const { progression, envoyer, annuler } = useEnvoi();
  const { taches } = useTaches();
  const analyses = taches.filter((tache) => tache.type === "analyse-inspiration" && tache.parametres.categorie === categorie);
  const actives = analyses.filter(tacheActive);
  const nombreActives = actives.length;
  const precedent = useRef(nombreActives);

  const charger = useCallback(
    (garderTextes: boolean) => {
      lireJson<GuideCategorie>(`/api/guides/${categorie}`)
        .then((reponse) => {
          setGuide(reponse);
          if (!garderTextes) {
            setStyle(reponse.style);
            setHooks(reponse.hooks);
            setModifie(false);
          }
        })
        .catch((e: unknown) => setErreur(messageErreur(e)));
    },
    [categorie],
  );

  useEffect(() => charger(false), [charger]);
  useEffect(() => {
    if (nombreActives < precedent.current) charger(true);
    precedent.current = nombreActives;
  }, [nombreActives, charger]);

  async function agir(action: () => Promise<unknown>, succes?: string) {
    setErreur(null);
    setMessage(null);
    try {
      await action();
      if (succes) setMessage(succes);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  async function enregistrer() {
    await agir(async () => {
      setGuide(await envoyerJson<GuideCategorie>("PUT", `/api/guides/${categorie}`, { style, hooks }));
      setModifie(false);
    }, "Guide enregistré.");
  }

  async function deposer(fichiers: File[]) {
    for (const fichier of fichiers) {
      const extension = fichier.name.slice(fichier.name.lastIndexOf(".")).toLowerCase();
      if (!(EXTENSIONS_INSPIRATION as readonly string[]).includes(extension)) {
        setErreur(`Format non accepté : ${fichier.name}. Formats possibles : ${EXTENSIONS_INSPIRATION.join(", ")}.`);
        continue;
      }
      await agir(() => envoyer<VideoInspiration>(`/api/guides/${categorie}/videos`, fichier));
    }
    charger(true);
  }

  const analyser = (noms: string[] | null) => agir(() => envoyerJson("POST", `/api/guides/${categorie}/analyses`, { noms }));
  const aAnalyser = (guide?.videos ?? []).filter(
    (video) => (video.etat !== "a-jour" || video.claude === null) && !actives.some((tache) => tache.parametres.nom === video.nom),
  );
  const libelle = LIBELLES_CATEGORIES[categorie as Categorie] ?? categorie;

  return (
    <>
      <p>
        <Link to="/guides">← Guides</Link>
      </p>
      <h1>Guide : {libelle}</h1>
      {erreur && <Message type="erreur">{erreur}</Message>}
      {message && <Message type="ok">{message}</Message>}
      {guide === null && !erreur && <p>Chargement…</p>}
      {guide !== null && (
        <>
          <section className="section">
            <div className="entete-section">
              <h2>Style et accroches</h2>
              <button type="button" className="bouton bouton-principal" disabled={!modifie} onClick={() => void enregistrer()}>
                Enregistrer
              </button>
            </div>
            <p className="section-intro">
              Claude lit ces deux textes avant chaque proposition de plan. Écris-y la direction que tu veux : structure, rythme, visuels, son, ce
              qu'il faut éviter, et les accroches qui marchent.
            </p>
            <div className="editeurs-guide">
              <label className="champ">
                <span className="champ-libelle">
                  <code>style.md</code>
                </span>
                <textarea rows={22} value={style} onChange={(evenement) => { setStyle(evenement.target.value); setModifie(true); }} />
              </label>
              <label className="champ">
                <span className="champ-libelle">
                  <code>hooks.md</code>
                </span>
                <textarea rows={22} value={hooks} onChange={(evenement) => { setHooks(evenement.target.value); setModifie(true); }} />
              </label>
            </div>
          </section>

          <section className="section">
            <div className="entete-section">
              <h2>Vidéos d'inspiration</h2>
              {aAnalyser.length > 0 && (
                <button type="button" className="bouton bouton-principal" onClick={() => void analyser(null)}>
                  Analyser {aAnalyser.length === 1 ? "la vidéo restante" : `les ${aAnalyser.length} vidéos restantes`}
                </button>
              )}
            </div>
            <p className="section-intro">
              Dépose des vidéos que tu trouves réussies (formats courts téléchargés, extraits de vlogs…). Elles restent privées et ne servent que de
              référence : rien n'en sera jamais repris dans un export. L'analyse mesure le rythme et repère les coupes sur cette machine, puis Claude
              en tire les techniques (accroche, zooms, sous-titres, boucle…).
            </p>
            {progression !== null ? <BarreEnvoi progression={progression} surAnnulation={annuler} /> : <ZoneDepot surFichiers={(fichiers) => void deposer(fichiers)} texte="Glisse ici des vidéos d'inspiration (MP4, MOV, WebM)" />}
            {actives.length > 0 && (
              <ul className="liste-taches">
                {actives.map((tache) => (
                  <LigneTache key={tache.id} tache={tache} />
                ))}
              </ul>
            )}
            {analyses
              .filter((tache) => tache.etat === "echouee" && !actives.some((active) => active.parametres.nom === tache.parametres.nom))
              .slice(0, 3)
              .map((tache) => (
                <ul key={tache.id} className="liste-taches">
                  <LigneTache tache={tache} />
                </ul>
              ))}
            {guide.videos.length === 0 ? (
              <p className="note">Aucune vidéo d'inspiration pour cette catégorie.</p>
            ) : (
              <table className="tableau tableau-inbox">
                <tbody>
                  {guide.videos.map((video) => {
                    const etat = ETATS[video.etat];
                    const enCours = actives.some((tache) => tache.parametres.nom === video.nom);
                    return (
                      <tr key={video.nom} className={video.nom === ouverte ? "ligne-selectionnee" : undefined}>
                        <td className="cellule-nom">{video.nom}</td>
                        <td>
                          <span className={etat.classe}>{enCours ? "Analyse en cours" : etat.texte}</span>
                        </td>
                        <td className="note">
                          {formaterTaille(video.taille)}
                          {video.claude !== null && ` · ${video.claude.techniques.length} techniques`}
                        </td>
                        <td className="cellule-action">
                          <button type="button" className="bouton bouton-discret" onClick={() => setOuverte(video.nom === ouverte ? null : video.nom)}>
                            {video.nom === ouverte ? "Fermer" : "Voir"}
                          </button>
                          {!enCours && (
                            <button type="button" className="bouton bouton-discret" onClick={() => void analyser([video.nom])}>
                              {video.etat === "absente" ? "Analyser" : "Réanalyser"}
                            </button>
                          )}
                          <button
                            type="button"
                            className="bouton bouton-discret"
                            onClick={() => {
                              if (window.confirm(`Mettre « ${video.nom} » et son analyse à la corbeille ?`)) {
                                void agir(() => envoyerJson("DELETE", `/api/guides/${categorie}/videos/${encodeURIComponent(video.nom)}`)).then(() => charger(true));
                              }
                            }}
                          >
                            Corbeille
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {guide.videos.filter((video) => video.nom === ouverte).map((video) => <DetailVideo key={video.nom} video={video} />)}
          </section>
        </>
      )}
    </>
  );
}
