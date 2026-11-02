import { useState } from "react";
import { SectionClaude } from "./SectionClaude.tsx";
import { SectionMachine } from "./SectionMachine.tsx";
import { SectionReglages } from "./SectionReglages.tsx";

export function Parametres() {
  const [versionCreations, setVersionCreations] = useState(0);

  return (
    <>
      <h1>Paramètres</h1>
      <SectionMachine surEnregistrement={() => setVersionCreations((version) => version + 1)} />
      <SectionClaude />
      <SectionReglages key={versionCreations} />
    </>
  );
}
