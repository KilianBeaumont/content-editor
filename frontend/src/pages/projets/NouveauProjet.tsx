import {
  CATEGORIES_PAR_CHAINE,
  CHAINES,
  DEFINITIONS_SORTIES,
  destinationsPossibles,
  LIBELLES_CATEGORIES,
  LIBELLES_CHAINES,
  slug,
  SORTIES,
  SORTIES_PAR_DEFAUT,
  TYPES,
  type Categorie,
  type Chaine,
  type ReponseBibliotheque,
  type ReponseCreationProjet,
  type ReponseInbox,
  type ReponseListeArtistes,
  type ReponseListeAuteurs,
  type SaisieProjet,
  type Sortie,
  type VerificationExport,
} from "@editeur/shared";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { envoyerFichier, envoyerJson, lireJson, messageErreur } from "../../api.ts";
import { ChampTexte } from "../../composants/Champs.tsx";
import { Message } from "../../composants/Message.tsx";
import { Verification } from "../../composants/Verification.tsx";
import { BadgeAccord } from "../auteurs-artistes/AuteursArtistes.tsx";
import { ChoixFichiers, destinationParDefaut, libelleDestination, type Choix } from "./ChoixFichiers.tsx";
import { CHAMPS_AUTEUR_VIDES, SectionAuteur, type ChampsAuteur } from "./SectionAuteur.tsx";

interface Formulaire {
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
  artistes: string[];
  assets: string[];
}

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

function formulaireVide(): Formulaire {
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
    artistes: [],
    assets: [],
  };
}

function ZoneTexte({ libelle, valeur, surChangement, aide }: { libelle: string; valeur: string; surChangement: (valeur: string) => void; aide?: string }) {
  return (
    <label className="champ">
      <span className="champ-libelle">{libelle}</span>
      <textarea rows={2} value={valeur} onChange={(evenement) => surChangement(evenement.target.value)} />
      {aide && <span className="champ-aide">{aide}</span>}
    </label>
  );
}

function basculer<T>(liste: T[], element: T, coche: boolean): T[] {
  return coche ? [...liste, element] : liste.filter((existant) => existant !== element);
}

export function NouveauProjet() {
  const [formulaire, setFormulaire] = useState<Formulaire>(formulaireVide);
  const [auteur, setAuteur] = useState<ChampsAuteur>(CHAMPS_AUTEUR_VIDES);
  const [choix, setChoix] = useState<Map<string, Choix>>(new Map());
  const [inbox, setInbox] = useState<ReponseInbox | null>(null);
  const [artistes, setArtistes] = useState<ReponseListeArtistes["artistes"]>([]);
  const [auteurs, setAuteurs] = useState<ReponseListeAuteurs["auteurs"]>([]);
  const [bibliotheque, setBibliotheque] = useState<ReponseBibliotheque["elements"]>([]);
  const [rechercheAsset, setRechercheAsset] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [cree, setCree] = useState<ReponseCreationProjet | null>(null);
  const [erreurPreuve, setErreurPreuve] = useState<string | null>(null);
  const [verification, setVerification] = useState<VerificationExport | null>(null);

  const chargerInbox = useCallback(() => {
    lireJson<ReponseInbox>("/api/inbox")
      .then(setInbox)
      .catch((e: unknown) => setErreur(messageErreur(e)));
  }, []);

  const chargerAuteurs = useCallback(() => {
    lireJson<ReponseListeAuteurs>("/api/auteurs")
      .then((liste) => setAuteurs(liste.auteurs))
      .catch(() => setAuteurs([]));
  }, []);

  useEffect(() => {
    chargerInbox();
    chargerAuteurs();
    lireJson<ReponseListeArtistes>("/api/artistes")
      .then((liste) => setArtistes(liste.artistes))
      .catch(() => setArtistes([]));
    lireJson<ReponseBibliotheque>("/api/bibliotheque")
      .then((reponse) => setBibliotheque(reponse.elements))
      .catch(() => setBibliotheque([]));
  }, [chargerInbox, chargerAuteurs]);

  function modifier(changement: Partial<Formulaire>) {
    setFormulaire((actuel) => {
      const suivant = { ...actuel, ...changement };
      if (!CATEGORIES_PAR_CHAINE[suivant.chaine].includes(suivant.categorie)) {
        suivant.categorie = CATEGORIES_PAR_CHAINE[suivant.chaine][0] ?? "vlog";
      }
      if (suivant.chaine !== "recits") suivant.anglais = false;
      if (suivant.chaine !== actuel.chaine || suivant.categorie !== actuel.categorie || suivant.anglais !== actuel.anglais) {
        suivant.sorties = sortiesParDefaut(suivant.chaine, suivant.categorie, suivant.anglais);
      }
      return suivant;
    });
  }

  const { chaine, anglais } = formulaire;
  const destinations = destinationsPossibles(chaine, anglais, formulaire.artistes);
  const nomsArtistes = new Map(artistes.map((artiste) => [artiste.id, artiste.fiche.nom]));
  const nomDossier = `${formulaire.date}_${slug(formulaire.titreFr) || "titre"}`;
  const sortiesPossibles = SORTIES.filter((sortie) => DEFINITIONS_SORTIES[sortie].chaines.includes(chaine));
  const texteAsset = rechercheAsset.trim().toLowerCase();
  const assetsPossibles = bibliotheque.filter(
    ({ asset }) =>
      (asset.chaine === "commun" || asset.chaine === chaine) &&
      (texteAsset === "" || `${asset.chemin} ${asset.description} ${asset.etiquettes.join(" ")}`.toLowerCase().includes(texteAsset)),
  );

  function saisie(): SaisieProjet {
    const duree = Number(formulaire.duree.replace(",", "."));
    const inboxParChemin = new Map((inbox?.fichiers ?? []).map((fichier) => [fichier.chemin, fichier]));
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
      fichiers: [...choix].map(([chemin, { destination, note }]) => {
        const genre = inboxParChemin.get(chemin)?.genre ?? "autre";
        return { chemin, note, destination: destinations.includes(destination) ? destination : destinationParDefaut(genre, chaine) };
      }),
      auteur:
        chaine !== "recits"
          ? null
          : auteur.mode === "moi"
            ? { id: null, nom: auteur.nomUtilisateur, source: "", estUtilisateur: true }
            : { id: auteur.auteurId || null, nom: "", source: auteur.source.trim(), estUtilisateur: false },
      autorisation: chaine === "recits" && auteur.mode === "auteur" ? auteur.autorisation : null,
      artistes: formulaire.artistes,
      assetsBibliotheque: formulaire.assets.filter((id) =>
        bibliotheque.some(({ asset }) => asset.id === id && (asset.chaine === "commun" || asset.chaine === chaine)),
      ),
    };
  }

  async function creer(evenement: FormEvent) {
    evenement.preventDefault();
    setEnCours(true);
    setErreur(null);
    setErreurPreuve(null);
    try {
      const reponse = await envoyerJson<ReponseCreationProjet>("POST", "/api/projets", saisie());
      if (auteur.preuve !== null && reponse.projet.metadata.autorisation !== null) {
        try {
          await envoyerFichier(`/api/projets/${reponse.projet.id}/autorisation/preuve`, auteur.preuve);
        } catch (e) {
          setErreurPreuve(messageErreur(e));
        }
      }
      setCree(reponse);
      lireJson<VerificationExport>(`/api/projets/${reponse.projet.id}/verification`)
        .then(setVerification)
        .catch(() => setVerification(null));
      window.scrollTo({ top: 0 });
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  function recommencer() {
    setCree(null);
    setVerification(null);
    setFormulaire(formulaireVide());
    setAuteur(CHAMPS_AUTEUR_VIDES);
    setChoix(new Map());
    chargerInbox();
  }

  const fichiersRetenus = saisie().fichiers;
  const parDestination = Map.groupBy(fichiersRetenus, (fichier) => fichier.destination);

  if (cree !== null) {
    const { projet, avertissements } = cree;
    return (
      <>
        <h1>Projet créé</h1>
        <section className="section">
          <h2>{projet.metadata.titre.fr}</h2>
          <p>
            Dossier : <code>{projet.chemin}</code>
          </p>
          {projet.metadata.fichiers.length > 0 ? (
            <>
              <p>Fichiers rangés :</p>
              <ul>
                {projet.metadata.fichiers.map((fichier) => (
                  <li key={fichier.chemin}>
                    <code>{fichier.chemin}</code>
                    {fichier.note && <span className="note"> · {fichier.note}</span>}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="note">Aucun fichier rangé pour l'instant.</p>
          )}
          {avertissements.length > 0 && (
            <Message type="alerte">
              <ul>
                {avertissements.map((avertissement) => (
                  <li key={avertissement}>{avertissement}</li>
                ))}
              </ul>
            </Message>
          )}
          {erreurPreuve && <Message type="erreur">Le projet est créé, mais la preuve n'a pas pu être enregistrée : {erreurPreuve}</Message>}
          <h3>Avant l'export</h3>
          {verification === null ? <p className="note">Vérification…</p> : <Verification verification={verification} />}
          <p className="note">L'écran Projet (suivi, plan de montage, aperçus) arrive à l'étape 9.</p>
          <div className="actions">
            <button type="button" className="bouton bouton-principal" onClick={recommencer}>
              Créer un autre projet
            </button>
            <Link className="bouton" to="/inbox">
              Retour à l'inbox
            </Link>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <h1>Nouveau projet</h1>
      <form onSubmit={creer}>
        <section className="section">
          <h2>Projet</h2>
          <div className="ligne-champs">
            <label className="champ">
              <span className="champ-libelle">Chaîne</span>
              <select
                value={chaine}
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
          {anglais && (
            <ChampTexte large libelle="Titre anglais" valeur={formulaire.titreEn} surChangement={(titreEn) => modifier({ titreEn })} />
          )}
          <p className="champ-aide">
            Dossier du projet : <code>{nomDossier}</code>
          </p>
        </section>

        <section className="section">
          <h2>Sorties voulues</h2>
          <p className="section-intro">Cochées par défaut selon la catégorie.</p>
          {sortiesPossibles.map((sortie) => {
            const definition = DEFINITIONS_SORTIES[sortie];
            const indisponible = definition.anglais && !anglais;
            return (
              <label key={sortie} className={indisponible ? "case case-desactivee" : "case"}>
                <input
                  type="checkbox"
                  disabled={indisponible}
                  checked={formulaire.sorties.includes(sortie)}
                  onChange={(evenement) =>
                    setFormulaire((actuel) => ({ ...actuel, sorties: basculer(actuel.sorties, sortie, evenement.target.checked) }))
                  }
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
        </section>

        <ChoixFichiers
          inbox={inbox}
          surInbox={setInbox}
          recharger={chargerInbox}
          choix={choix}
          surChoix={setChoix}
          chaine={chaine}
          destinations={destinations}
          nomsArtistes={nomsArtistes}
        />

        {chaine === "recits" && (
          <SectionAuteur
            champs={auteur}
            surChangement={(changement) => setAuteur((actuel) => ({ ...actuel, ...changement }))}
            auteurs={auteurs}
            surActualiser={chargerAuteurs}
            anglais={anglais}
          />
        )}

        <section className="section">
          <h2>Artistes invités</h2>
          <p className="section-intro">
            Chaque artiste coché a son dossier <code>assets/&lt;artiste&gt;/</code>, proposé comme place pour ses visuels ci-dessus.
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

        <section className="section">
          <h2>Assets de la bibliothèque</h2>
          <p className="section-intro">Ceux que tu veux voir dans cette vidéo. Claude pourra en proposer d'autres au montage.</p>
          {bibliotheque.length === 0 ? (
            <p className="note">La bibliothèque est vide.</p>
          ) : (
            <>
              <input type="text" placeholder="Rechercher…" value={rechercheAsset} onChange={(evenement) => setRechercheAsset(evenement.target.value)} />
              <div className="liste-choix">
                {assetsPossibles.map(({ asset }) => (
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

        <section className="section">
          <h2>Récapitulatif</h2>
          <p>
            <code>{nomDossier}</code> · {LIBELLES_CHAINES[chaine]} · {LIBELLES_CATEGORIES[formulaire.categorie]} ·{" "}
            {choix.size} {choix.size === 1 ? "fichier" : "fichiers"}
          </p>
          {parDestination.size > 0 && (
            <ul className="note">
              {[...parDestination].map(([destination, fichiers]) => (
                <li key={destination}>
                  {libelleDestination(destination, nomsArtistes)} : {fichiers.length}
                </li>
              ))}
            </ul>
          )}
          <div className="actions">
            <button type="submit" className="bouton bouton-principal" disabled={enCours}>
              {enCours ? "Création…" : "Créer le projet"}
            </button>
          </div>
          {erreur && <Message type="erreur">{erreur}</Message>}
        </section>
      </form>
    </>
  );
}
