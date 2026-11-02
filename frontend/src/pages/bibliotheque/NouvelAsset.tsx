import {
  CHAINES_BIBLIOTHEQUE,
  EXTENSIONS_BIBLIOTHEQUE,
  LIBELLES_CHAINES_BIBLIOTHEQUE,
  TAILLE_MAX_ASSET,
  TYPES,
  TYPES_ASSET,
  type ChaineBibliotheque,
  type ElementBibliotheque,
  type ReponseTeleversementAsset,
  type TypeAsset,
} from "@editeur/shared";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { envoyerJson, formaterTaille, messageErreur, verifierFichier } from "../../api.ts";
import { ApercuFichier } from "../../composants/ApercuFichier.tsx";
import { BarreEnvoi, useEnvoi } from "../../composants/Envoi.tsx";
import { Message } from "../../composants/Message.tsx";
import { CHAMPS_VIDES, ChampsAsset, versSaisie, type Champs } from "./ChampsAsset.tsx";

function typeDuChemin(chemin: string): TypeAsset | null {
  const dossier = chemin.split("/")[1];
  return TYPES_ASSET.find((type) => TYPES[type].dossier === dossier) ?? null;
}

function extension(nom: string): string {
  const point = nom.lastIndexOf(".");
  return point > 0 ? nom.slice(point).toLowerCase() : "";
}

function typeProbable(fichier: File, actuel: TypeAsset): TypeAsset {
  const ext = extension(fichier.name);
  if (TYPES[actuel].extensions.includes(ext)) return actuel;
  return TYPES_ASSET.find((type) => TYPES[type].extensions.includes(ext)) ?? actuel;
}

export function NouvelAsset() {
  const naviguer = useNavigate();
  const [parametres] = useSearchParams();
  const [chemin, setChemin] = useState<string | null>(parametres.get("chemin"));
  const [chaine, setChaine] = useState<ChaineBibliotheque>("commun");
  const [type, setType] = useState<TypeAsset>("image");
  const [fichier, setFichier] = useState<File | null>(null);
  const [champs, setChamps] = useState<Champs>(CHAMPS_VIDES);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const { progression, envoyer, annuler } = useEnvoi();

  function verifier(choisi: File | null, typeChoisi: TypeAsset): string | null {
    return choisi === null ? null : verifierFichier(choisi, TYPES[typeChoisi].extensions, TAILLE_MAX_ASSET);
  }

  function choisirFichier(choisi: File | null) {
    const nouveauType = choisi === null ? type : typeProbable(choisi, type);
    setFichier(choisi);
    setType(nouveauType);
    setErreur(verifier(choisi, nouveauType));
  }

  function choisirType(valeur: string) {
    const nouveau = TYPES_ASSET.find((element) => element === valeur);
    if (nouveau === undefined) return;
    setType(nouveau);
    setErreur(verifier(fichier, nouveau));
  }

  async function ajouter(evenement: FormEvent) {
    evenement.preventDefault();
    setEnCours(true);
    setErreur(null);
    try {
      let cheminAjoute = chemin;
      if (cheminAjoute === null) {
        if (fichier === null) throw new Error("Choisis un fichier.");
        const probleme = verifier(fichier, type);
        if (probleme !== null) throw new Error(probleme);
        const envoi = await envoyer<ReponseTeleversementAsset>(`/api/bibliotheque/fichiers/${chaine}/${type}`, fichier);
        cheminAjoute = envoi.chemin;
        setChemin(cheminAjoute);
      }
      const { asset } = await envoyerJson<ElementBibliotheque>("POST", "/api/bibliotheque/assets", {
        ...versSaisie(champs),
        chemin: cheminAjoute,
      });
      void naviguer(`/bibliotheque/assets/${asset.id}`, { replace: true });
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <>
      <p>
        <Link to="/bibliotheque">← Bibliothèque</Link>
      </p>
      <h1>Ajouter un asset</h1>

      <form className="section" onSubmit={ajouter}>
        <h2>Fichier</h2>
        {chemin !== null ? (
          <>
            <p>
              <code>bibliotheque/{chemin}</code>
            </p>
            <ApercuFichier chemin={`bibliotheque/${chemin}`} />
          </>
        ) : (
          <>
            <label className="champ">
              <span className="champ-libelle">Fichier</span>
              <input
                type="file"
                accept={EXTENSIONS_BIBLIOTHEQUE.join(",")}
                disabled={enCours}
                onChange={(evenement) => choisirFichier(evenement.target.files?.[0] ?? null)}
              />
              {fichier !== null && <span className="champ-aide">{formaterTaille(fichier.size)}</span>}
            </label>
            <div className="ligne-champs">
              <label className="champ">
                <span className="champ-libelle">Type</span>
                <select value={type} onChange={(evenement) => choisirType(evenement.target.value)}>
                  {TYPES_ASSET.map((element) => (
                    <option key={element} value={element}>
                      {TYPES[element].libelle}
                    </option>
                  ))}
                </select>
                <span className="champ-aide">{TYPES[type].aide}</span>
              </label>
              <label className="champ">
                <span className="champ-libelle">Chaîne</span>
                <select
                  value={chaine}
                  onChange={(evenement) => {
                    const nouvelle = CHAINES_BIBLIOTHEQUE.find((element) => element === evenement.target.value);
                    if (nouvelle) setChaine(nouvelle);
                  }}
                >
                  {CHAINES_BIBLIOTHEQUE.map((element) => (
                    <option key={element} value={element}>
                      {LIBELLES_CHAINES_BIBLIOTHEQUE[element]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="champ-aide">
              Formats acceptés : {TYPES[type].extensions.join(", ")}. Le fichier sera rangé dans{" "}
              <code>
                bibliotheque/{chaine}/{TYPES[type].dossier}/
              </code>
              .
            </p>
          </>
        )}

        <h2>Description</h2>
        <ChampsAsset
          champs={champs}
          surChangement={(changement) => setChamps((actuels) => ({ ...actuels, ...changement }))}
          type={chemin !== null ? typeDuChemin(chemin) : type}
        />

        {progression !== null && <BarreEnvoi progression={progression} surAnnulation={annuler} />}
        <div className="actions">
          <button type="submit" className="bouton bouton-principal" disabled={enCours}>
            {enCours ? "Ajout…" : "Ajouter à la bibliothèque"}
          </button>
        </div>
        {erreur && <Message type="erreur">{erreur}</Message>}
      </form>
    </>
  );
}
