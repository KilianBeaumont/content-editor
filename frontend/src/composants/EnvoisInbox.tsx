import type { FichierMedia, ReponseEnvoiInbox } from "@editeur/shared";
import { useRef, useState, type DragEvent } from "react";
import { formaterTaille, messageErreur } from "../api.ts";
import { BarreEnvoi, useEnvoi } from "./Envoi.tsx";
import { Message } from "./Message.tsx";

interface Resultat {
  nom: string;
  erreur: string | null;
}

export function useEnvoisInbox(surRecu: (fichier: FichierMedia) => void, surFin: () => void) {
  const [enAttente, setEnAttente] = useState<File[]>([]);
  const [resultats, setResultats] = useState<Resultat[]>([]);
  const file = useRef<File[]>([]);
  const actif = useRef(false);
  const { progression, envoyer, annuler } = useEnvoi();

  async function traiter() {
    if (actif.current) return;
    actif.current = true;
    try {
      for (let fichier = file.current.shift(); fichier !== undefined; fichier = file.current.shift()) {
        setEnAttente([...file.current]);
        const nom = fichier.name;
        try {
          const { fichier: recu } = await envoyer<ReponseEnvoiInbox>("/api/inbox", fichier);
          setResultats((actuels) => [...actuels, { nom, erreur: null }]);
          surRecu(recu);
        } catch (e) {
          setResultats((actuels) => [...actuels, { nom, erreur: messageErreur(e) }]);
        }
      }
    } finally {
      actif.current = false;
      setEnAttente([]);
      surFin();
    }
  }

  return {
    progression,
    enAttente,
    resultats,
    ajouter(fichiers: File[]) {
      file.current.push(...fichiers);
      setEnAttente([...file.current]);
      void traiter();
    },
    toutAnnuler() {
      file.current = [];
      setEnAttente([]);
      annuler();
    },
  };
}

export function ZoneDepot({ surFichiers, texte }: { surFichiers: (fichiers: File[]) => void; texte: string }) {
  const [survol, setSurvol] = useState(false);
  const [alerte, setAlerte] = useState<string | null>(null);

  function deposer(evenement: DragEvent) {
    evenement.preventDefault();
    setSurvol(false);
    const elements = [...evenement.dataTransfer.items];
    const dossiers = elements.filter((element) => element.webkitGetAsEntry()?.isDirectory === true).length;
    const fichiers = elements
      .filter((element) => element.kind === "file" && element.webkitGetAsEntry()?.isDirectory !== true)
      .map((element) => element.getAsFile())
      .filter((fichier) => fichier !== null);
    setAlerte(dossiers > 0 ? "Les dossiers ne sont pas pris en charge : ouvre-les et dépose les fichiers qu'ils contiennent." : null);
    if (fichiers.length > 0) surFichiers(fichiers);
  }

  return (
    <>
      <div
        className={survol ? "zone-depot zone-depot-survol" : "zone-depot"}
        onDragOver={(evenement) => {
          evenement.preventDefault();
          setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={deposer}
      >
        <p>{texte}</p>
        <label className="bouton">
          Choisir des fichiers
          <input
            type="file"
            multiple
            hidden
            onChange={(evenement) => {
              surFichiers([...(evenement.target.files ?? [])]);
              evenement.target.value = "";
            }}
          />
        </label>
      </div>
      {alerte && <Message type="alerte">{alerte}</Message>}
    </>
  );
}

interface ProprietesSuiviEnvois {
  envois: ReturnType<typeof useEnvoisInbox>;
  espaceLibre: number | null;
}

export function SuiviEnvois({ envois, espaceLibre }: ProprietesSuiviEnvois) {
  const { progression, enAttente, resultats, toutAnnuler } = envois;
  const tailleEnAttente = enAttente.reduce((total, fichier) => total + fichier.size, 0);
  const echecs = resultats.filter((resultat) => resultat.erreur !== null);
  const reussis = resultats.length - echecs.length;

  return (
    <>
      {progression !== null && (
        <>
          <BarreEnvoi progression={progression} surAnnulation={toutAnnuler} />
          {enAttente.length > 0 && (
            <p className="note">
              Ensuite : {enAttente.length} {enAttente.length === 1 ? "fichier" : "fichiers"} ({formaterTaille(tailleEnAttente)}).
            </p>
          )}
        </>
      )}
      {espaceLibre !== null && tailleEnAttente > espaceLibre && (
        <Message type="alerte">
          Les fichiers en attente ({formaterTaille(tailleEnAttente)}) dépassent l'espace libre ({formaterTaille(espaceLibre)}).
        </Message>
      )}
      {progression === null && resultats.length > 0 && (
        <Message type={echecs.length > 0 ? "erreur" : "ok"}>
          {reussis} {reussis === 1 ? "fichier ajouté" : "fichiers ajoutés"}.
          {echecs.length > 0 && (
            <ul>
              {echecs.map((echec, index) => (
                <li key={`${echec.nom}-${index}`}>
                  <strong>{echec.nom}</strong> : {echec.erreur}
                </li>
              ))}
            </ul>
          )}
        </Message>
      )}
    </>
  );
}
