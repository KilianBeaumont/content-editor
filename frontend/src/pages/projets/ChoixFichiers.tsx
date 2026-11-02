import { LIBELLES_GENRES, type Chaine, type FichierMedia, type GenreFichier, type ReponseInbox } from "@editeur/shared";
import type { Dispatch, SetStateAction } from "react";
import { SuiviEnvois, useEnvoisInbox, ZoneDepot } from "../../composants/EnvoisInbox.tsx";
import { Message } from "../../composants/Message.tsx";
import { dureeMedia, resumeMedia } from "../../medias.ts";

export interface Choix {
  destination: string;
  note: string;
}

export function destinationParDefaut(genre: GenreFichier, chaine: Chaine): string {
  if (genre === "video") return "rushes";
  if (genre === "audio") return chaine === "recits" ? "voix/fr" : "rushes";
  if (genre === "texte") return "texte";
  return "assets";
}

export function libelleDestination(destination: string, nomsArtistes: Map<string, string>): string {
  if (destination === "rushes") return "Rushes";
  if (destination === "voix/fr") return "Voix FR";
  if (destination === "voix/en") return "Voix EN";
  if (destination === "texte") return "Texte";
  if (destination === "assets") return "Assets de la vidéo";
  const artiste = destination.replace(/^assets\//, "");
  return `Visuels de ${nomsArtistes.get(artiste) ?? artiste}`;
}

interface ProprietesChoixFichiers {
  inbox: ReponseInbox | null;
  surInbox: Dispatch<SetStateAction<ReponseInbox | null>>;
  recharger: () => void;
  choix: Map<string, Choix>;
  surChoix: Dispatch<SetStateAction<Map<string, Choix>>>;
  chaine: Chaine;
  destinations: string[];
  nomsArtistes: Map<string, string>;
}

export function ChoixFichiers(proprietes: ProprietesChoixFichiers) {
  const { inbox, surInbox, recharger, choix, surChoix, chaine, destinations, nomsArtistes } = proprietes;
  const envois = useEnvoisInbox((recu) => {
    surInbox((actuelle) => (actuelle === null ? actuelle : { ...actuelle, fichiers: [...actuelle.fichiers, recu] }));
    surChoix((actuels) => new Map(actuels).set(recu.chemin, { destination: destinationParDefaut(recu.genre, chaine), note: "" }));
  }, recharger);

  function basculer(fichier: FichierMedia) {
    const suivant = new Map(choix);
    if (suivant.has(fichier.chemin)) suivant.delete(fichier.chemin);
    else suivant.set(fichier.chemin, { destination: destinationParDefaut(fichier.genre, chaine), note: "" });
    surChoix(suivant);
  }

  function modifier(chemin: string, changement: Partial<Choix>) {
    surChoix((actuels) => {
      const actuel = actuels.get(chemin);
      return actuel === undefined ? actuels : new Map(actuels).set(chemin, { ...actuel, ...changement });
    });
  }

  const fichiers = inbox?.fichiers ?? [];
  const tousChoisis = fichiers.length > 0 && fichiers.every((fichier) => choix.has(fichier.chemin));

  return (
    <section className="section">
      <h2>Fichiers</h2>
      <p className="section-intro">
        Coche les fichiers de l'inbox à ranger dans le projet, choisis leur place et ajoute une note si utile : Claude la lira
        pour le montage. Ils seront déplacés de l'inbox vers le projet, sans être modifiés.
      </p>
      <ZoneDepot surFichiers={envois.ajouter} texte="Glisse ici d'autres fichiers : ils arrivent dans l'inbox et sont cochés" />
      <SuiviEnvois envois={envois} espaceLibre={inbox?.espaceLibre ?? null} />

      {inbox === null && <p>Chargement de l'inbox…</p>}
      {inbox !== null && fichiers.length === 0 && <p className="note">L'inbox est vide.</p>}
      {fichiers.length > 0 && (
        <table className="tableau tableau-choix">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label="Tout cocher"
                  checked={tousChoisis}
                  onChange={() =>
                    surChoix(
                      tousChoisis
                        ? new Map()
                        : new Map(
                            fichiers.map((fichier) => [
                              fichier.chemin,
                              choix.get(fichier.chemin) ?? { destination: destinationParDefaut(fichier.genre, chaine), note: "" },
                            ]),
                          ),
                    )
                  }
                />
              </th>
              <th>Fichier</th>
              <th>Infos</th>
              <th>Place dans le projet</th>
              <th>Note pour le montage</th>
            </tr>
          </thead>
          <tbody>
            {fichiers.map((fichier) => {
              const choisi = choix.get(fichier.chemin);
              const destination =
                choisi !== undefined && destinations.includes(choisi.destination)
                  ? choisi.destination
                  : destinationParDefaut(fichier.genre, chaine);
              return (
                <tr key={fichier.chemin} className={choisi ? "ligne-selectionnee" : undefined}>
                  <td>
                    <input type="checkbox" checked={choisi !== undefined} onChange={() => basculer(fichier)} aria-label={fichier.chemin} />
                  </td>
                  <td className="cellule-nom" onClick={() => basculer(fichier)}>
                    {fichier.chemin}
                  </td>
                  <td className="note">
                    {[LIBELLES_GENRES[fichier.genre], dureeMedia(fichier), resumeMedia(fichier)].filter(Boolean).join(" · ")}
                  </td>
                  <td>
                    {choisi && (
                      <select value={destination} onChange={(evenement) => modifier(fichier.chemin, { destination: evenement.target.value })}>
                        {destinations.map((possible) => (
                          <option key={possible} value={possible}>
                            {libelleDestination(possible, nomsArtistes)}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td>
                    {choisi && (
                      <input
                        type="text"
                        value={choisi.note}
                        placeholder="ex. bonne prise vers 3:20"
                        onChange={(evenement) => modifier(fichier.chemin, { note: evenement.target.value })}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {choix.size === 0 && fichiers.length > 0 && (
        <Message type="info">Aucun fichier coché : le projet sera créé vide, tu pourras y ajouter des fichiers plus tard.</Message>
      )}
    </section>
  );
}
