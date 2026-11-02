import { DEFINITIONS_SORTIES, type Sortie, type VerificationExport } from "@editeur/shared";
import { Message } from "./Message.tsx";

export function Verification({ verification }: { verification: VerificationExport }) {
  const blocages = verification.problemes.filter(({ niveau }) => niveau === "blocage");
  const avertissements = verification.problemes.filter(({ niveau }) => niveau === "avertissement");
  const libelles = (sorties: Sortie[]) => sorties.map((sortie) => DEFINITIONS_SORTIES[sortie].libelle).join(", ");

  if (verification.problemes.length === 0) {
    return <Message type="ok">Rien ne bloque l'export : auteur, artistes et assets sont en règle.</Message>;
  }
  return (
    <>
      {blocages.length > 0 && (
        <Message type="erreur">
          À régler avant l'export
          {verification.sortiesBloquees.length > 0 && ` (bloque : ${libelles(verification.sortiesBloquees)})`} :
          <ul>
            {blocages.map(({ message, sorties }) => (
              <li key={message}>
                {message}
                {sorties.length > 0 && <span className="note"> · {libelles(sorties)}</span>}
              </li>
            ))}
          </ul>
        </Message>
      )}
      {avertissements.length > 0 && (
        <Message type="alerte">
          À savoir :
          <ul>
            {avertissements.map(({ message }) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </Message>
      )}
    </>
  );
}
