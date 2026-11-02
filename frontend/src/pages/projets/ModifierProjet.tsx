import type { DetailProjet, ModificationProjet, ReponseModificationProjet } from "@editeur/shared";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { envoyerFichier, envoyerJson, lireJson, messageErreur } from "../../api.ts";
import { Message } from "../../composants/Message.tsx";
import { CHAMPS_AUTEUR_VIDES, SectionAuteur, type ChampsAuteur } from "./SectionAuteur.tsx";
import {
  appliquer,
  champsAuteurDepuis,
  formulaireDepuis,
  formulaireVide,
  nomDossier,
  saisieCommune,
  SectionArtistes,
  SectionAssets,
  SectionConsignes,
  SectionInfos,
  SectionSorties,
  useDonneesProjet,
  ZoneTexte,
  type Formulaire,
} from "./SectionsProjet.tsx";

export interface EtatRetourProjet {
  avertissements: string[];
}

export function ModifierProjet() {
  const { id = "" } = useParams();
  const naviguer = useNavigate();
  const [projet, setProjet] = useState<DetailProjet | null>(null);
  const [formulaire, setFormulaire] = useState<Formulaire>(formulaireVide);
  const [auteur, setAuteur] = useState<ChampsAuteur>(CHAMPS_AUTEUR_VIDES);
  const [description, setDescription] = useState({ fr: "", en: "" });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const { artistes, auteurs, chargerAuteurs, bibliotheque } = useDonneesProjet();
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    lireJson<DetailProjet>(`/api/projets/${id}`)
      .then((charge) => {
        setProjet(charge);
        setFormulaire(formulaireDepuis(charge.metadata));
        setAuteur(champsAuteurDepuis(charge.metadata));
        setDescription(charge.metadata.description);
        setNotes(Object.fromEntries(charge.metadata.fichiers.map((fichier) => [fichier.chemin, fichier.note])));
      })
      .catch((e: unknown) => setErreur(messageErreur(e)));
  }, [id]);

  const modifier = (changement: Partial<Formulaire>) => setFormulaire((actuel) => appliquer(actuel, changement, false));

  async function enregistrer(evenement: FormEvent) {
    evenement.preventDefault();
    setEnCours(true);
    setErreur(null);
    try {
      const { chaine, ...commun } = saisieCommune(formulaire, auteur, bibliotheque);
      const corps: ModificationProjet = { ...commun, description, notes };
      const { projet: modifie, avertissements } = await envoyerJson<ReponseModificationProjet>("PUT", `/api/projets/${id}`, corps);
      if (auteur.preuve !== null && modifie.metadata.autorisation !== null) {
        try {
          await envoyerFichier(`/api/projets/${modifie.id}/autorisation/preuve`, auteur.preuve);
        } catch (e) {
          avertissements.push(`La preuve n'a pas pu être enregistrée : ${messageErreur(e)}`);
        }
      }
      const etat: EtatRetourProjet = { avertissements };
      void naviguer(`/projets/${modifie.id}`, { state: etat });
    } catch (e) {
      setErreur(messageErreur(e));
      setEnCours(false);
    }
  }

  const retour = (
    <p>
      <Link to={`/projets/${id}`}>← Retour au projet</Link>
    </p>
  );

  if (projet === null) {
    return (
      <>
        {retour}
        {erreur ? <Message type="erreur">{erreur}</Message> : <p>Chargement…</p>}
      </>
    );
  }

  const nouveauNom = nomDossier(formulaire);
  const preuve = projet.metadata.autorisation?.preuve ?? null;

  return (
    <>
      {retour}
      <h1>Modifier « {projet.metadata.titre.fr} »</h1>
      <form onSubmit={enregistrer}>
        <SectionInfos formulaire={formulaire} modifier={modifier} chaineModifiable={false} />
        <SectionSorties formulaire={formulaire} modifier={modifier} />
        <SectionConsignes formulaire={formulaire} modifier={modifier} />

        <section className="section">
          <h2>Description</h2>
          <p className="section-intro">Le texte de la description de la vidéo, à copier au moment de publier.</p>
          <ZoneTexte libelle="Description" lignes={4} valeur={description.fr} surChangement={(fr) => setDescription((actuelle) => ({ ...actuelle, fr }))} />
          {formulaire.anglais && (
            <ZoneTexte
              libelle="Description anglaise"
              lignes={4}
              valeur={description.en}
              surChangement={(en) => setDescription((actuelle) => ({ ...actuelle, en }))}
            />
          )}
        </section>

        {projet.metadata.fichiers.length > 0 && (
          <section className="section">
            <h2>Notes des fichiers</h2>
            <table className="tableau tableau-choix">
              <tbody>
                {projet.metadata.fichiers.map((fichier) => (
                  <tr key={fichier.chemin}>
                    <td className="cellule-nom">
                      <code>{fichier.chemin}</code>
                    </td>
                    <td>
                      <input
                        type="text"
                        value={notes[fichier.chemin] ?? ""}
                        placeholder="ex. bonne prise vers 3:20"
                        onChange={(evenement) => setNotes((actuelles) => ({ ...actuelles, [fichier.chemin]: evenement.target.value }))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {formulaire.chaine === "recits" && (
          <SectionAuteur
            champs={auteur}
            surChangement={(changement) => setAuteur((actuel) => ({ ...actuel, ...changement }))}
            auteurs={auteurs}
            surActualiser={chargerAuteurs}
            anglais={formulaire.anglais}
            preuveActuelle={preuve === null ? null : `${projet.chemin}/${preuve}`}
          />
        )}
        <SectionArtistes formulaire={formulaire} modifier={modifier} artistes={artistes} />
        <SectionAssets formulaire={formulaire} modifier={modifier} bibliotheque={bibliotheque} />

        <section className="section">
          {nouveauNom !== projet.id && (
            <Message type="info">
              Le dossier sera renommé en <code>{nouveauNom}</code>. Les fiches des artistes, de l'auteur et de la bibliothèque seront
              mises à jour. Ferme d'abord les fichiers du projet ouverts dans d'autres programmes.
            </Message>
          )}
          <div className="actions">
            <button type="submit" className="bouton bouton-principal" disabled={enCours}>
              {enCours ? "Enregistrement…" : "Enregistrer"}
            </button>
            <Link className="bouton" to={`/projets/${id}`}>
              Annuler
            </Link>
          </div>
          {erreur && <Message type="erreur">{erreur}</Message>}
        </section>
      </form>
    </>
  );
}
