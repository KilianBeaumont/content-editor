import {
  DEFINITIONS_SORTIES,
  tacheActive,
  type DetailProjet,
  type CouleursExport,
  type ExportSortie,
  type QualiteExport,
  type ReponseDescription,
  type ReponseExports,
  type Sortie,
  type Tache,
} from "@editeur/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { envoyerJson, formaterTaille, lireJson, messageErreur, urlFichier } from "../../api.ts";
import { Message } from "../../composants/Message.tsx";
import { afficherExport, NOM_EXPLORATEUR } from "../../explorateur.ts";
import { LigneTache } from "../../composants/Taches.tsx";
import { temps } from "./ChampsPlan.tsx";

const PHASES_A_VENIR: Partial<Record<Sortie, string>> = {
  "formats-courts": "les extraits courts arrivent en phase 5",
  instagram: "les posts et carrousels viendront plus tard",
  "podcast-fr": "le podcast arrive en phase 6",
  "podcast-en": "le podcast arrive en phase 6",
  "youtube-piste-en": "la piste anglaise arrive en phase 6",
};

function dateHeure(date: string): string {
  return new Date(date).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

interface ProprietesFiche {
  projet: DetailProjet;
  fiche: ExportSortie;
  emplacement: string | null;
  publier: (publie: boolean) => Promise<void>;
  afficher: () => Promise<void>;
}

function FicheExport({ projet, fiche, emplacement, publier, afficher }: ProprietesFiche) {
  const url = urlFichier(`${projet.chemin}/${fiche.fichier}`);
  const verticale = fiche.hauteur > fiche.largeur;
  return (
    <div className="fiche-export">
      <video className={verticale ? "video-export video-verticale" : "video-export"} src={url} controls preload="metadata" />
      <div>
        <p>
          <strong>{fiche.fichier.split("/").at(-1)}</strong>
        </p>
        <ul className="details-export">
          <li>
            Version {fiche.version}, exportée le {dateHeure(fiche.creeLe)} en {Math.round(fiche.dureeRenduSecondes)} s
          </li>
          <li>
            {fiche.largeur}x{fiche.hauteur} à {fiche.imagesParSeconde} i/s · {fiche.couleurs === "hdr" ? "HDR (HLG)" : "SDR"} · {temps(fiche.duree ?? fiche.dureePlan)} · {formaterTaille(fiche.taille)}
          </li>
          <li>
            Volume {fiche.volumeLufs?.toFixed(1).replace(".", ",") ?? "?"} LUFS · crêtes {fiche.creteDb?.toFixed(1).replace(".", ",") ?? "?"} dBTP · encodé avec{" "}
            {fiche.encodeur === "libx264" || fiche.encodeur === "libx265" ? "le processeur" : fiche.encodeur.endsWith("nvenc") ? "la carte graphique (NVENC)" : "VideoToolbox"}
          </li>
        </ul>
        {fiche.controles.length === 0 ? (
          <p className="badge badge-ok">✓ Fichier vérifié</p>
        ) : (
          <Message type="alerte">
            <ul>
              {fiche.controles.map((controle) => (
                <li key={controle}>{controle}</li>
              ))}
            </ul>
          </Message>
        )}
        <p className="ligne-actions">
          <button type="button" className="bouton" onClick={() => void afficher()}>
            Afficher dans {NOM_EXPLORATEUR}
          </button>
        </p>
        <p className="note emplacement-export">
          Le fichier est déjà rangé dans le dossier du projet : <code>{emplacement ?? `${projet.chemin}/${fiche.fichier}`}</code>
        </p>
        <label className="case-publication">
          <input type="checkbox" checked={fiche.publieLe !== null} onChange={(evenement) => void publier(evenement.target.checked)} /> Publié sur{" "}
          {DEFINITIONS_SORTIES[fiche.sortie].libelle}
          {fiche.publieLe !== null && <span className="note"> le {dateHeure(fiche.publieLe)}</span>}
        </label>
      </div>
    </div>
  );
}

interface ProprietesExport {
  projet: DetailProjet;
  taches: Tache[];
  surChangement: () => void;
  allerA: (onglet: "apercu" | "validation") => void;
}

export function Export({ projet, taches, surChangement, allerA }: ProprietesExport) {
  const [exports, setExports] = useState<ReponseExports | null>(null);
  const [description, setDescription] = useState<string>("");
  const [copie, setCopie] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [choix, setChoix] = useState<Partial<Record<Sortie, QualiteExport>>>({});
  const [choixCouleurs, setChoixCouleurs] = useState<Partial<Record<Sortie, CouleursExport>>>({});
  const tachesExport = taches.filter((tache) => tache.type === "export-final" && tache.projet === projet.id);
  const actives = tachesExport.filter(tacheActive).map((tache) => tache.id).join(",");
  const precedentes = useRef(actives);

  const charger = useCallback(() => {
    lireJson<ReponseExports>(`/api/projets/${projet.id}/exports`)
      .then(setExports)
      .catch((e: unknown) => setErreur(messageErreur(e)));
    lireJson<ReponseDescription>(`/api/projets/${projet.id}/description`)
      .then((reponse) => setDescription(reponse.texte))
      .catch(() => setDescription(""));
  }, [projet.id]);

  useEffect(charger, [charger]);
  useEffect(() => {
    if (precedentes.current !== "" && actives === "") {
      charger();
      surChangement();
    }
    precedentes.current = actives;
  }, [actives, charger, surChangement]);

  async function exporter(sortie: Sortie, qualite: QualiteExport, couleurs: CouleursExport, remplace: boolean) {
    if (remplace && !window.confirm("Refaire l'export remplacera le fichier actuel. Continuer ?")) return;
    setErreur(null);
    try {
      await envoyerJson("POST", `/api/projets/${projet.id}/exports`, { sortie, qualite, couleurs });
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  async function publier(sortie: Sortie, publie: boolean) {
    setErreur(null);
    try {
      setExports(await envoyerJson<ReponseExports>("POST", `/api/projets/${projet.id}/exports/${sortie}/publication`, { publie }));
      surChangement();
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  async function afficher(sortie: Sortie) {
    setErreur(null);
    try {
      await afficherExport(projet.id, sortie);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  async function copier() {
    try {
      await navigator.clipboard.writeText(description);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      setErreur("Copie impossible : sélectionne le texte et copie-le à la main.");
    }
  }

  const validee = projet.metadata.versionValidee;
  const autres = projet.metadata.sorties.filter((sortie) => !(exports?.sortiesVideo ?? []).includes(sortie));

  return (
    <section className="section">
      <h2>Export</h2>
      {erreur && <Message type="erreur">{erreur}</Message>}
      {validee === null ? (
        <div className="appel-suite">
          <span>Aucune version validée : valide d'abord la version à exporter.</span>
          <button type="button" className="bouton" onClick={() => allerA("apercu")}>
            ← Aperçu
          </button>
        </div>
      ) : (
        <p className="section-intro">
          L'export rend la version validée <strong>{validee}</strong> en pleine qualité à partir des rushes d'origine (couleurs converties en SDR,
          volume normalisé en deux passes), vérifie le fichier et le range dans <code>exports/</code>, prêt à publier.
        </p>
      )}

      {(exports?.sortiesVideo ?? []).map((sortie) => {
        const fiche = exports?.exports.find((element) => element.sortie === sortie) ?? null;
        const active = tachesExport.find((tache) => tache.parametres.sortie === sortie && tacheActive(tache)) ?? null;
        const derniere = tachesExport.find((tache) => tache.parametres.sortie === sortie) ?? null;
        const options = exports?.qualites.find((element) => element.sortie === sortie) ?? null;
        const qualite: QualiteExport = choix[sortie] ?? (options?.uhd ? "4k" : "standard");
        const couleurs: CouleursExport = options?.hdr ? (choixCouleurs[sortie] ?? "hdr") : "sdr";
        return (
          <div key={sortie} className="bloc-apercu">
            <div className="entete-section">
              <h3>
                {DEFINITIONS_SORTIES[sortie].libelle} <span className="note">· {DEFINITIONS_SORTIES[sortie].aide}</span>
              </h3>
              {validee !== null && active === null && (
                <button type="button" className={fiche === null ? "bouton bouton-principal" : "bouton"} onClick={() => void exporter(sortie, qualite, couleurs, fiche !== null)}>
                  {fiche === null ? `Exporter la version ${validee}` : `Refaire l'export (${validee})`}
                  {qualite === "4k" ? " en 4K" : ""}
                  {couleurs === "hdr" ? " HDR" : ""}
                </button>
              )}
            </div>
            {validee !== null && active === null && options !== null && (
              <div className="choix-qualite" role="radiogroup" aria-label="Qualité">
                <label>
                  <input type="radio" checked={qualite === "standard"} onChange={() => setChoix({ ...choix, [sortie]: "standard" })} /> Standard ·{" "}
                  {options.standard.largeur}x{options.standard.hauteur}
                </label>
                <label className={options.uhd === null ? "note" : undefined}>
                  <input type="radio" checked={qualite === "4k"} disabled={options.uhd === null} onChange={() => setChoix({ ...choix, [sortie]: "4k" })} /> 4K ·{" "}
                  {options.uhd === null
                    ? `indisponible${options.rushes === null ? "" : ` : rushes en ${options.rushes.largeur}x${options.rushes.hauteur}`}`
                    : `${options.uhd.largeur}x${options.uhd.hauteur}, recommandé : YouTube compresse mieux une vidéo envoyée en 4K, même regardée en 1080p`}
                </label>
                {options.hdr && (
                  <>
                    <label>
                      <input type="radio" checked={couleurs === "hdr"} onChange={() => setChoixCouleurs({ ...choixCouleurs, [sortie]: "hdr" })} /> Couleurs HDR (HLG,
                      HEVC 10 bits) : garde la luminosité et les couleurs de tes rushes HDR, YouTube les affiche en HDR sur les écrans compatibles
                    </label>
                    <label>
                      <input type="radio" checked={couleurs === "sdr"} onChange={() => setChoixCouleurs({ ...choixCouleurs, [sortie]: "sdr" })} /> Couleurs SDR (H.264) :
                      converties, identiques partout
                    </label>
                  </>
                )}
              </div>
            )}
            {active !== null && (
              <ul className="liste-taches">
                <LigneTache tache={active} />
              </ul>
            )}
            {active === null && derniere?.etat === "echouee" && (
              <ul className="liste-taches">
                <LigneTache tache={derniere} />
              </ul>
            )}
            {fiche !== null && validee !== null && fiche.version !== validee && (
              <Message type="alerte">
                Ce fichier vient de la version {fiche.version}, mais la version validée est {validee} : refais l'export avant de publier.
              </Message>
            )}
            {fiche !== null ? (
              <FicheExport
                projet={projet}
                fiche={fiche}
                emplacement={exports?.emplacements[sortie] ?? null}
                publier={(publie) => publier(sortie, publie)}
                afficher={() => afficher(sortie)}
              />
            ) : (
              active === null && <p className="note">Pas encore exporté.</p>
            )}
          </div>
        );
      })}

      {autres.length > 0 && (
        <p className="note">
          Autres sorties voulues :{" "}
          {autres.map((sortie) => `${DEFINITIONS_SORTIES[sortie].libelle} (${PHASES_A_VENIR[sortie] ?? "plus tard"})`).join(", ")}.
        </p>
      )}

      <div className="bloc-apercu">
        <div className="entete-section">
          <h3>Description à copier</h3>
          <button type="button" className="bouton" disabled={description === ""} onClick={() => void copier()}>
            {copie ? "✓ Copiée" : "Copier"}
          </button>
        </div>
        <p className="note">
          Ta description (écran Modifier) suivie des crédits de l'auteur, des artistes et des musiques externes, avec leurs liens. Elle est aussi
          enregistrée à côté du fichier exporté (<code>description.txt</code>).
        </p>
        <textarea className="description-export" readOnly rows={Math.min(14, description.split("\n").length + 1)} value={description} />
      </div>
      {projet.metadata.versionValidee !== null && (
        <p className="note">
          Un problème de droits empêche l'export ?{" "}
          <button type="button" className="bouton-lien" onClick={() => allerA("validation")}>
            Voir l'onglet Validation
          </button>
        </p>
      )}
    </section>
  );
}
