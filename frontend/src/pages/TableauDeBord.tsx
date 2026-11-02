import type { ReponseSante } from "@editeur/shared";
import { useEffect, useState } from "react";
import { lireJson } from "../api.ts";

type EtatBackend = "chargement" | "ok" | "injoignable";

export function TableauDeBord() {
  const [etat, setEtat] = useState<EtatBackend>("chargement");

  useEffect(() => {
    lireJson<ReponseSante>("/api/sante")
      .then(() => setEtat("ok"))
      .catch(() => setEtat("injoignable"));
  }, []);

  return (
    <>
      <h1>Tableau de bord</h1>
      <p className={`etat etat-${etat}`}>
        {etat === "chargement" && "Connexion au backend…"}
        {etat === "ok" && "Backend OK"}
        {etat === "injoignable" && "Backend injoignable"}
      </p>
    </>
  );
}
