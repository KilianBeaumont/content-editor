import {
  CATEGORIES_PAR_CHAINE,
  CHAINES,
  DEFINITIONS_SORTIES,
  LIBELLES_CATEGORIES,
  LIBELLES_CHAINES,
  slug,
  SORTIES,
  SORTIES_PAR_DEFAUT,
  TYPES,
  type Categorie,
  type Chaine,
  type MetadataProjet,
  type ReponseBibliotheque,
  type ReponseListeArtistes,
  type ReponseListeAuteurs,
  type SaisieProjet,
  type Sortie,
} from "@editeur/shared";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { lireJson } from "../../api.ts";
import { ChampTexte } from "../../composants/Champs.tsx";
import { Message } from "../../composants/Message.tsx";
import { BadgeAccord } from "../auteurs-artistes/AuteursArtistes.tsx";
import { CHAMPS_AUTEUR_VIDES, type ChampsAuteur } from "./SectionAuteur.tsx";

export interface Formulaire {
  chaine: Chaine;
  categorie: Categorie;
  titreFr: string;
  titreEn: string;
  date: string;
  anglais: boolean;
  sorties: Sortie[];
  nombreFormatsCourts: number;
  intention: string;
  duree: string;
  aGarder: string;
  aEviter: string;
  vocabulaire: string;
  artistes: string[];
  assets: string[];
}

export type Artistes = ReponseListeArtistes["artistes"];
export type Auteurs = ReponseListeAuteurs["auteurs"];
export type ElementsBibliotheque = ReponseBibliotheque["elements"];

function dansUneSemaine(): string {
  const date = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function sortiesParDefaut(chaine: Chaine, categorie: Categorie, anglais: boolean): Sortie[] {
  return SORTIES_PAR_DEFAUT[categorie].filter((sortie) => {
    const definition = DEFINITIONS_SORTIES[sortie];
    return definition.chaines.includes(chaine) && (anglais || !definition.anglais);
  });
}

export function formulaireVide(): Formulaire {
  return {
    chaine: "creation",
    categorie: "vlog",
    titreFr: "",
    titreEn: "",
    date: dansUneSemaine(),
    anglais: false,
    sorties: sortiesParDefaut("creation", "vlog", false),
    nombreFormatsCourts: 3,
    intention: "",
    duree: "",
    aGarder: "",
    aEviter: "",
    vocabulaire: "",
    artistes: [],
    assets: [],
  };
}

export function formulaireDepuis(metadata: MetadataProjet): Formulaire {
  const { consignes } = metadata;
  return {
    chaine: metadata.chaine,
    categorie: metadata.categorie,
    titreFr: metadata.titre.fr,
    titreEn: metadata.titre.en ?? "",
    date: metadata.datePublicationPrevue,
    anglais: metadata.langues.includes("en"),
    sorties: metadata.sorties,
    nombreFormatsCourts: metadata.nombreFormatsCourts ?? 3,
    intention: consignes.intention,
    duree: consignes.dureeViseeMinutes === null ? "" : String(consignes.dureeViseeMinutes).replace(".", ","),
    aGarder: consignes.aGarder,
    aEviter: consignes.aEviter,
    vocabulaire: metadata.vocabulaire,
    artistes: metadata.artistes,
    assets: metadata.assetsBibliotheque,
  };
}

export function champsAuteurDepuis(metadata: MetadataProjet): ChampsAuteur {
  const { auteur, autorisation } = metadata;
  if (auteur === null) return CHAMPS_AUTEUR_VIDES;
  return {
    mode: auteur.estUtilisateur ? "moi" : "auteur",
    auteurId: auteur.id ?? "",
    nomUtilisateur: auteur.estUtilisateur ? auteur.nom : "",
    source: auteur.source,
    autorisation: autorisation ?? CHAMPS_AUTEUR_VIDES.autorisation,
    preuve: null,
    futurRoman: metadata.futurRoman,
  };
}

export function appliquer(actuel: Formulaire, changement: Partial<Formulaire>, sortiesAuto: boolean): Formulaire {
  const suivant = { ...actuel, ...changement };
  if (!CATEGORIES_PAR_CHAINE[suivant.chaine].includes(suivant.categorie)) {
    suivant.categorie = CATEGORIES_PAR_CHAINE[suivant.chaine][0] ?? "vlog";
  }
  if (suivant.chaine !== "recits") suivant.anglais = false;
  const change = suivant.chaine !== actuel.chaine || suivant.categorie !== actuel.categorie || suivant.anglais !== actuel.anglais;
  if (change && sortiesAuto) {
    suivant.sorties = sortiesParDefaut(suivant.chaine, suivant.categorie, suivant.anglais);
  } else if (!suivant.anglais) {
    suivant.sorties = suivant.sorties.filter((sortie) => !DEFINITIONS_SORTIES[sortie].anglais);
  }
  return suivant;
}

export function saisieCommune(
  formulaire: Formulaire,
  auteur: ChampsAuteur,
  bibliotheque: ElementsBibliotheque,
): Omit<SaisieProjet, "fichiers"> {
  const { chaine, anglais } = formulaire;
  const duree = Number(formulaire.duree.replace(",", "."));
  const recit = chaine === "recits";
  return {
    chaine,
    categorie: formulaire.categorie,
    titre: { fr: formulaire.titreFr, en: anglais ? formulaire.titreEn : null },
    datePublicationPrevue: formulaire.date,
    anglais,
    sorties: formulaire.sorties,
    nombreFormatsCourts: formulaire.sorties.includes("formats-courts") ? formulaire.nombreFormatsCourts : null,
    consignes: {
      intention: formulaire.intention,
      dureeViseeMinutes: formulaire.duree.trim() !== "" && duree > 0 ? duree : null,
      aGarder: formulaire.aGarder,
      aEviter: formulaire.aEviter,
    },
    auteur: !recit
      ? null
      : auteur.mode === "moi"
        ? { id: null, nom: auteur.nomUtilisateur, source: "", estUtilisateur: true }
        : { id: auteur.auteurId || null, nom: "", source: auteur.source.trim(), estUtilisateur: false },
    autorisation: recit && auteur.mode === "auteur" ? auteur.autorisation : null,
    artistes: formulaire.artistes,
    assetsBibliotheque: formulaire.assets.filter((id) =>
      bibliotheque.some(({ asset }) => asset.id === id && (asset.chaine === "commun" || asset.chaine === chaine)),
    ),
    futurRoman: recit && auteur.mode === "moi" && auteur.futurRoman,
    vocabulaire: formulaire.vocabulaire,
  };
}

export function nomDossier(formulaire: Formulaire): string {
  return `${formulaire.date}_${slug(formulaire.titreFr) || "titre"}`;
}

export function useDonneesProjet() {
  const [artistes, setArtistes] = useState<Artistes>([]);
  const [auteurs, setAuteurs] = useState<Auteurs>([]);
  const [bibliotheque, setBibliotheque] = useState<ElementsBibliotheque>([]);

  const chargerAuteurs = useCallback(() => {
    lireJson<ReponseListeAuteurs>("/api/auteurs")
      .then((liste) => setAuteurs(liste.auteurs))
      .catch(() => setAuteurs([]));
  }, []);

  useEffect(() => {
    chargerAuteurs();
    lireJson<ReponseListeArtistes>("/api/artistes")
      .then((liste) => setArtistes(liste.artistes))
      .catch(() => setArtistes([]));
    lireJson<ReponseBibliotheque>("/api/bibliotheque")
      .then((reponse) => setBibliotheque(reponse.elements))
      .catch(() => setBibliotheque([]));
  }, [chargerAuteurs]);

  return { artistes, auteurs, chargerAuteurs, bibliotheque };
}

function basculer<T>(liste: T[], element: T, coche: boolean): T[] {
  return coche ? [...liste, element] : liste.filter((existant) => existant !== element);
}

interface ProprietesSection {
  formulaire: Formulaire;
  modifier: (changement: Partial<Formulaire>) => void;
}

export function SectionInfos({ formulaire, modifier, chaineModifiable }: ProprietesSection & { chaineModifiable: boolean }) {
  const { chaine, anglais } = formulaire;
  return (
    <section className="section">
      <h2>Projet</h2>
      <div className="ligne-champs">
        <label className="champ">
          <span className="champ-libelle">Chaîne</span>
          <select
            value={chaine}
            disabled={!chaineModifiable}
            onChange={(evenement) => {
              const nouvelle = CHAINES.find((element) => element === evenement.target.value);
              if (nouvelle) modifier({ chaine: nouvelle });
            }}
          >
            {CHAINES.map((element) => (
              <option key={element} value={element}>
                {LIBELLES_CHAINES[element]}
              </option>
            ))}
          </select>
        </label>
        <label className="champ">
          <span className="champ-libelle">Catégorie</span>
          <select
            value={formulaire.categorie}
            onChange={(evenement) => {
              const categorie = CATEGORIES_PAR_CHAINE[chaine].find((element) => element === evenement.target.value);
              if (categorie) modifier({ categorie });
            }}
          >
            {CATEGORIES_PAR_CHAINE[chaine].map((element) => (
              <option key={element} value={element}>
                {LIBELLES_CATEGORIES[element]}
              </option>
            ))}
          </select>
        </label>
        <label className="champ">
          <span className="champ-libelle">Publication prévue</span>
          <input type="date" required value={formulaire.date} onChange={(evenement) => modifier({ date: evenement.target.value })} />
        </label>
      </div>
      <ChampTexte large libelle="Titre" valeur={formulaire.titreFr} surChangement={(titreFr) => modifier({ titreFr })} />
      {chaine === "recits" && (
        <label className="case">
          <input type="checkbox" checked={anglais} onChange={(evenement) => modifier({ anglais: evenement.target.checked })} />
          Version anglaise (voix EN, piste audio EN, podcast EN)
        </label>
      )}
      {anglais && <ChampTexte large libelle="Titre anglais" valeur={formulaire.titreEn} surChangement={(titreEn) => modifier({ titreEn })} />}
      <p className="champ-aide">
        Dossier du projet : <code>{nomDossier(formulaire)}</code>
        {!chaineModifiable && " · la chaîne d'un projet existant ne se change pas"}
      </p>
    </section>
  );
}

export function SectionSorties({ formulaire, modifier }: ProprietesSection) {
  const { chaine, anglais } = formulaire;
  return (
    <section className="section">
      <h2>Sorties voulues</h2>
      <p className="section-intro">Cochées par défaut selon la catégorie.</p>
      {SORTIES.filter((sortie) => DEFINITIONS_SORTIES[sortie].chaines.includes(chaine)).map((sortie) => {
        const definition = DEFINITIONS_SORTIES[sortie];
        const indisponible = definition.anglais && !anglais;
        return (
          <label key={sortie} className={indisponible ? "case case-desactivee" : "case"}>
            <input
              type="checkbox"
              disabled={indisponible}
              checked={formulaire.sorties.includes(sortie)}
              onChange={(evenement) => modifier({ sorties: basculer(formulaire.sorties, sortie, evenement.target.checked) })}
            />
            <span>
              <strong>{definition.libelle}</strong> <span className="note">· {definition.aide}</span>
              {indisponible && <span className="note"> (demande la version anglaise)</span>}
            </span>
          </label>
        );
      })}
      {formulaire.sorties.includes("formats-courts") && (
        <label className="champ champ-nombre">
          <span className="champ-libelle">Nombre de formats courts souhaités</span>
          <input
            type="number"
            min={1}
            max={20}
            value={formulaire.nombreFormatsCourts}
            onChange={(evenement) => modifier({ nombreFormatsCourts: evenement.target.valueAsNumber || 1 })}
          />
        </label>
      )}
    </section>
  );
}

export function ZoneTexte({
  libelle,
  valeur,
  surChangement,
  aide,
  lignes = 2,
}: {
  libelle: string;
  valeur: string;
  surChangement: (valeur: string) => void;
  aide?: string;
  lignes?: number;
}) {
  return (
    <label className="champ">
      <span className="champ-libelle">{libelle}</span>
      <textarea rows={lignes} value={valeur} onChange={(evenement) => surChangement(evenement.target.value)} />
      {aide && <span className="champ-aide">{aide}</span>}
    </label>
  );
}

export function SectionConsignes({ formulaire, modifier }: ProprietesSection) {
  return (
    <section className="section">
      <h2>Consignes de montage</h2>
      <p className="section-intro">Tout est facultatif. Claude les lira avec le guide de style de la catégorie.</p>
      <ZoneTexte
        libelle="Intention"
        valeur={formulaire.intention}
        surChangement={(intention) => modifier({ intention })}
        aide="Ce que la vidéo doit raconter ou faire ressentir."
      />
      <label className="champ champ-nombre">
        <span className="champ-libelle">Durée visée</span>
        <span className="champ-avec-unite">
          <input type="text" inputMode="decimal" value={formulaire.duree} onChange={(evenement) => modifier({ duree: evenement.target.value })} />
          <span className="champ-unite">min</span>
        </span>
      </label>
      <ZoneTexte libelle="À garder absolument" valeur={formulaire.aGarder} surChangement={(aGarder) => modifier({ aGarder })} />
      <ZoneTexte libelle="À éviter" valeur={formulaire.aEviter} surChangement={(aEviter) => modifier({ aEviter })} />
      <ZoneTexte
        libelle="Vocabulaire des rushes"
        valeur={formulaire.vocabulaire}
        surChangement={(vocabulaire) => modifier({ vocabulaire })}
        aide="Noms et termes propres à cette vidéo (jeu, personnages, lieux, techniques), séparés par des virgules : la transcription les écrira mieux."
      />
    </section>
  );
}

export function SectionArtistes({ formulaire, modifier, artistes }: ProprietesSection & { artistes: Artistes }) {
  return (
    <section className="section">
      <h2>Artistes invités</h2>
      <p className="section-intro">
        Chaque artiste coché a son dossier <code>assets/&lt;artiste&gt;/</code>, proposé comme place pour ses visuels.
      </p>
      {artistes.length === 0 ? (
        <p className="note">
          Aucune fiche d'artiste. <Link to="/auteurs-artistes/artistes/nouveau">Créer une fiche</Link>
        </p>
      ) : (
        artistes.map((artiste) => (
          <label key={artiste.id} className="case">
            <input
              type="checkbox"
              checked={formulaire.artistes.includes(artiste.id)}
              onChange={(evenement) => modifier({ artistes: basculer(formulaire.artistes, artiste.id, evenement.target.checked) })}
            />
            {artiste.fiche.nom} <BadgeAccord statut={artiste.statut} />
          </label>
        ))
      )}
      {formulaire.artistes.some((id) => artistes.find((artiste) => artiste.id === id)?.statut.valide === false) && (
        <Message type="alerte">Tant que l'accord d'un artiste coché est incomplet, la vidéo ne pourra pas être exportée.</Message>
      )}
    </section>
  );
}

export function SectionAssets({ formulaire, modifier, bibliotheque }: ProprietesSection & { bibliotheque: ElementsBibliotheque }) {
  const [recherche, setRecherche] = useState("");
  const texte = recherche.trim().toLowerCase();
  const possibles = bibliotheque.filter(
    ({ asset }) =>
      (asset.chaine === "commun" || asset.chaine === formulaire.chaine) &&
      (texte === "" || `${asset.chemin} ${asset.description} ${asset.etiquettes.join(" ")}`.toLowerCase().includes(texte)),
  );
  return (
    <section className="section">
      <h2>Assets de la bibliothèque</h2>
      <p className="section-intro">Ceux que tu veux voir dans cette vidéo. Claude pourra en proposer d'autres au montage.</p>
      {bibliotheque.length === 0 ? (
        <p className="note">La bibliothèque est vide.</p>
      ) : (
        <>
          <input type="text" placeholder="Rechercher…" value={recherche} onChange={(evenement) => setRecherche(evenement.target.value)} />
          <div className="liste-choix">
            {possibles.map(({ asset }) => (
              <label key={asset.id} className="case">
                <input
                  type="checkbox"
                  checked={formulaire.assets.includes(asset.id)}
                  onChange={(evenement) => modifier({ assets: basculer(formulaire.assets, asset.id, evenement.target.checked) })}
                />
                <span>
                  {asset.chemin.split("/").at(-1)} <span className="badge">{TYPES[asset.type].libelle}</span>
                  {asset.description && <span className="note"> · {asset.description}</span>}
                </span>
              </label>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
