import type { Parametres, PreReglageVideo } from "@editeur/shared";
import { useEffect, useState } from "react";
import { envoyerJson, lireJson, messageErreur } from "../../api.ts";
import { ChampNombre, ChampTexte } from "../../composants/Champs.tsx";
import { Message } from "../../composants/Message.tsx";

function ChampsVideo({ valeur, surChangement }: { valeur: PreReglageVideo; surChangement: (v: PreReglageVideo) => void }) {
  return (
    <>
      <ChampNombre libelle="Largeur" unite="px" valeur={valeur.largeur} surChangement={(largeur) => surChangement({ ...valeur, largeur })} />
      <ChampNombre libelle="Hauteur" unite="px" valeur={valeur.hauteur} surChangement={(hauteur) => surChangement({ ...valeur, hauteur })} />
      <ChampNombre
        libelle="Volume"
        unite="LUFS"
        pas={0.5}
        valeur={valeur.loudnessLufs}
        surChangement={(loudnessLufs) => surChangement({ ...valeur, loudnessLufs })}
      />
    </>
  );
}

export function SectionReglages() {
  const [parametres, setParametres] = useState<Parametres | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "erreur"; texte: string } | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    lireJson<Parametres>("/api/parametres")
      .then(setParametres)
      .catch((erreur: unknown) => setMessage({ type: "erreur", texte: messageErreur(erreur) }));
  }, []);

  function modifier(changement: (copie: Parametres) => void) {
    setParametres((actuels) => {
      if (actuels === null) return actuels;
      const copie = structuredClone(actuels);
      changement(copie);
      return copie;
    });
  }

  async function enregistrer() {
    if (parametres === null) return;
    setEnCours(true);
    setMessage(null);
    try {
      setParametres(await envoyerJson<Parametres>("PUT", "/api/parametres", parametres));
      setMessage({ type: "ok", texte: "Enregistré." });
    } catch (erreur) {
      setMessage({ type: "erreur", texte: messageErreur(erreur) });
    } finally {
      setEnCours(false);
    }
  }

  return (
    <section className="section">
      <h2>Réglages communs</h2>
      <p className="section-intro">
        Partagés par toutes les machines, enregistrés dans <code>creations/parametres.json</code>.
      </p>
      {parametres === null ? (
        !message && <p>Chargement…</p>
      ) : (
        <>
          <h3>Préréglages d'export</h3>
          <div className="grille-reglages">
            <span className="grille-titre">YouTube (vidéo longue)</span>
            <div className="ligne-champs">
              <ChampsVideo valeur={parametres.exports.youtube} surChangement={(v) => modifier((p) => (p.exports.youtube = v))} />
            </div>
            <span className="grille-titre">Format court 9:16</span>
            <div className="ligne-champs">
              <ChampsVideo
                valeur={parametres.exports.formatCourt}
                surChangement={(v) => modifier((p) => (p.exports.formatCourt = v))}
              />
            </div>
            <span className="grille-titre">Aperçu de relecture</span>
            <div className="ligne-champs">
              <ChampNombre
                libelle="Largeur"
                unite="px"
                valeur={parametres.exports.apercu.largeur}
                surChangement={(largeur) => modifier((p) => (p.exports.apercu.largeur = largeur))}
              />
            </div>
            <span className="grille-titre">Post Instagram 4:5</span>
            <div className="ligne-champs">
              <ChampNombre
                libelle="Largeur"
                unite="px"
                valeur={parametres.exports.instagram.largeur}
                surChangement={(largeur) => modifier((p) => (p.exports.instagram.largeur = largeur))}
              />
              <ChampNombre
                libelle="Hauteur"
                unite="px"
                valeur={parametres.exports.instagram.hauteur}
                surChangement={(hauteur) => modifier((p) => (p.exports.instagram.hauteur = hauteur))}
              />
            </div>
            <span className="grille-titre">Podcast (MP3)</span>
            <div className="ligne-champs">
              <ChampNombre
                libelle="Débit"
                unite="kbps"
                valeur={parametres.exports.podcast.debitKbps}
                surChangement={(debitKbps) => modifier((p) => (p.exports.podcast.debitKbps = debitKbps))}
              />
              <ChampNombre
                libelle="Volume"
                unite="LUFS"
                pas={0.5}
                valeur={parametres.exports.podcast.loudnessLufs}
                surChangement={(loudnessLufs) => modifier((p) => (p.exports.podcast.loudnessLufs = loudnessLufs))}
              />
            </div>
            <span className="grille-titre">Pochette de podcast</span>
            <div className="ligne-champs">
              <ChampNombre
                libelle="Côté"
                unite="px"
                valeur={parametres.exports.pochettePodcast.cote}
                surChangement={(cote) => modifier((p) => (p.exports.pochettePodcast.cote = cote))}
              />
            </div>
          </div>

          <h3>Traitements</h3>
          <div className="ligne-champs">
            <ChampTexte
              libelle="Modèle de transcription"
              valeur={parametres.transcription.modele}
              surChangement={(modele) => modifier((p) => (p.transcription.modele = modele))}
            />
            <ChampTexte
              libelle="Modèle Claude"
              indication="par défaut"
              valeur={parametres.claude.modele ?? ""}
              surChangement={(modele) => modifier((p) => (p.claude.modele = modele.trim() === "" ? null : modele))}
              aide="Vide : le modèle par défaut de Claude Code."
            />
            <ChampNombre
              libelle="Rendus simultanés"
              min={1}
              max={8}
              valeur={parametres.rendusSimultanes}
              surChangement={(rendusSimultanes) => modifier((p) => (p.rendusSimultanes = rendusSimultanes))}
            />
          </div>

          <div className="actions">
            <button type="button" className="bouton bouton-principal" disabled={enCours} onClick={enregistrer}>
              Enregistrer
            </button>
          </div>
        </>
      )}
      {message && <Message type={message.type}>{message.texte}</Message>}
    </section>
  );
}
