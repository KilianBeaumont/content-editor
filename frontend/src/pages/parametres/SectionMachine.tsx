import type {
  ConfigMachine,
  DiagnosticBinaire,
  NomBinaire,
  ReponseConfigMachine,
  ReponseDiagnostic,
} from "@editeur/shared";
import { useCallback, useEffect, useState } from "react";
import { envoyerJson, lireJson, messageErreur } from "../../api.ts";
import { ChampTexte } from "../../composants/Champs.tsx";
import { Message } from "../../composants/Message.tsx";

const BINAIRES: Array<{ nom: NomBinaire; libelle: string; note?: string }> = [
  { nom: "ffmpeg", libelle: "ffmpeg" },
  { nom: "ffprobe", libelle: "ffprobe" },
  { nom: "claude", libelle: "Claude Code (claude)" },
  { nom: "whisper", libelle: "whisper.cpp (whisper-cli)", note: "Pour la transcription : voir la section Transcription ci-dessous." },
];

function EtatBinaire({ diagnostic }: { diagnostic: DiagnosticBinaire | undefined }) {
  if (diagnostic === undefined) {
    return <span className="badge">Vérification…</span>;
  }
  if (diagnostic.trouve && diagnostic.erreur === null) {
    return <span className="badge badge-ok">✓ {diagnostic.version ?? "trouvé"}</span>;
  }
  return <span className={diagnostic.trouve ? "badge badge-alerte" : "badge badge-erreur"}>✗ {diagnostic.erreur}</span>;
}

export function SectionMachine({ surEnregistrement }: { surEnregistrement: () => void }) {
  const [config, setConfig] = useState<ConfigMachine | null>(null);
  const [diagnostic, setDiagnostic] = useState<DiagnosticBinaire[] | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "erreur"; texte: string } | null>(null);
  const [enCours, setEnCours] = useState(false);

  const verifier = useCallback(() => {
    setDiagnostic(null);
    lireJson<ReponseDiagnostic>("/api/diagnostic")
      .then((reponse) => setDiagnostic(reponse.binaires))
      .catch((erreur: unknown) => setMessage({ type: "erreur", texte: messageErreur(erreur) }));
  }, []);

  useEffect(() => {
    lireJson<ConfigMachine>("/api/config-machine")
      .then(setConfig)
      .catch((erreur: unknown) => setMessage({ type: "erreur", texte: messageErreur(erreur) }));
    verifier();
  }, [verifier]);

  async function enregistrer() {
    if (config === null) return;
    setEnCours(true);
    setMessage(null);
    try {
      const reponse = await envoyerJson<ReponseConfigMachine>("PUT", "/api/config-machine", config);
      setConfig(reponse.config);
      const crees = reponse.crees.length;
      setMessage({
        type: "ok",
        texte:
          crees === 0
            ? "Enregistré."
            : `Enregistré. ${crees} ${crees === 1 ? "élément créé" : "éléments créés"} dans le dossier creations.`,
      });
      verifier();
      surEnregistrement();
    } catch (erreur) {
      setMessage({ type: "erreur", texte: messageErreur(erreur) });
    } finally {
      setEnCours(false);
    }
  }

  return (
    <section className="section">
      <h2>Cette machine</h2>
      <p className="section-intro">
        Propre à cet ordinateur, enregistré dans <code>config.local.json</code> (non partagé entre le PC et le Mac).
      </p>
      {config === null ? (
        <p>Chargement…</p>
      ) : (
        <>
          <ChampTexte
            large
            libelle="Dossier creations"
            valeur={config.creations}
            surChangement={(creations) => setConfig({ ...config, creations })}
            aide="S'il n'existe pas, il est créé avec toute l'arborescence à l'enregistrement."
          />
          <ChampTexte
            large
            libelle="Dossier des modèles whisper"
            valeur={config.modeles}
            surChangement={(modeles) => setConfig({ ...config, modeles })}
            aide="Où ranger les modèles de transcription (fichiers ggml-….bin, environ 1,6 Go chacun)."
          />
          {BINAIRES.map(({ nom, libelle, note }) => (
            <ChampTexte
              key={nom}
              large
              libelle={libelle}
              valeur={config.binaires[nom]}
              surChangement={(valeur) => setConfig({ ...config, binaires: { ...config.binaires, [nom]: valeur } })}
              aide={
                <>
                  <EtatBinaire diagnostic={diagnostic?.find((element) => element.nom === nom)} />
                  {note && <span className="note"> {note}</span>}
                </>
              }
            />
          ))}
          <div className="actions">
            <button type="button" className="bouton bouton-principal" disabled={enCours} onClick={enregistrer}>
              Enregistrer
            </button>
            <button type="button" className="bouton" onClick={verifier}>
              Revérifier les programmes
            </button>
          </div>
        </>
      )}
      {message && <Message type={message.type}>{message.texte}</Message>}
    </section>
  );
}
