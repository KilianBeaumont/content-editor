import { tacheActive, type ReponsePlans, type ReponseTranscriptions, type Tache, type VersionPlan } from "@editeur/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { lireJson, messageErreur } from "../../api.ts";

export interface DonneesPlans {
  plans: ReponsePlans | null;
  proxies: Map<string, string>;
  erreur: string | null;
  remplacer: (version: VersionPlan) => void;
}

export function usePlans(projet: string, taches: Tache[], surChangement: () => void): DonneesPlans {
  const [plans, setPlans] = useState<ReponsePlans | null>(null);
  const [proxies, setProxies] = useState<Map<string, string>>(new Map());
  const [erreur, setErreur] = useState<string | null>(null);
  const actives = taches
    .filter((tache) => (tache.type === "proposition-plan" || tache.type === "rendu-apercu" || tache.type === "preparation-rush") && tache.projet === projet && tacheActive(tache))
    .map((tache) => tache.id)
    .join(",");
  const precedentes = useRef(actives);

  const charger = useCallback(() => {
    lireJson<ReponsePlans>(`/api/projets/${projet}/plans`)
      .then((reponse) => {
        setPlans(reponse);
        setErreur(null);
      })
      .catch((e: unknown) => setErreur(messageErreur(e)));
    lireJson<ReponseTranscriptions>(`/api/projets/${projet}/transcriptions`)
      .then(({ fichiers }) =>
        setProxies(new Map(fichiers.flatMap((fichier) => (fichier.preparation === "a-jour" && fichier.proxy !== null ? [[fichier.chemin, fichier.proxy]] : [])))),
      )
      .catch(() => setProxies(new Map()));
  }, [projet]);

  useEffect(charger, [charger]);
  useEffect(() => {
    if (precedentes.current.split(",").some((id) => id !== "" && !actives.split(",").includes(id))) {
      charger();
      surChangement();
    }
    precedentes.current = actives;
  }, [actives, charger, surChangement]);

  const remplacer = useCallback(
    (version: VersionPlan) => {
      setPlans((actuel) => actuel && { versions: actuel.versions.map((element) => (element.version === version.version ? version : element)) });
      surChangement();
    },
    [surChangement],
  );

  return { plans, proxies, erreur, remplacer };
}
