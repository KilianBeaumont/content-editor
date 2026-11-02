import type { ReponseErreur } from "@editeur/shared";

async function lireReponse<T>(reponse: Response): Promise<T> {
  if (!reponse.ok) {
    const corps = (await reponse.json().catch(() => null)) as ReponseErreur | null;
    throw new Error(corps?.erreur ?? `Erreur ${reponse.status}`);
  }
  return (await reponse.json()) as T;
}

export async function lireJson<T>(chemin: string): Promise<T> {
  return lireReponse<T>(await fetch(chemin));
}

export async function envoyerJson<T>(methode: "POST" | "PUT" | "DELETE", chemin: string, corps?: unknown): Promise<T> {
  const reponse = await fetch(chemin, {
    method: methode,
    headers: corps === undefined ? {} : { "content-type": "application/json" },
    body: corps === undefined ? null : JSON.stringify(corps),
  });
  return lireReponse<T>(reponse);
}

export interface OptionsEnvoi {
  surProgression?: (envoye: number, total: number) => void;
  signal?: AbortSignal;
}

export function envoyerFichier<T>(chemin: string, fichier: File, options: OptionsEnvoi = {}): Promise<T> {
  return new Promise((resoudre, rejeter) => {
    const requete = new XMLHttpRequest();
    requete.open("POST", chemin);
    requete.upload.onprogress = (evenement) => {
      if (evenement.lengthComputable) options.surProgression?.(evenement.loaded, evenement.total);
    };
    requete.onload = () => {
      let corps: unknown;
      try {
        corps = JSON.parse(requete.responseText);
      } catch {
        corps = null;
      }
      if (requete.status >= 200 && requete.status < 300) {
        resoudre(corps as T);
      } else {
        const message = (corps as ReponseErreur | null)?.erreur;
        rejeter(new Error(message ?? `Erreur ${requete.status}`));
      }
    };
    requete.onerror = () => rejeter(new Error("La connexion avec le serveur a été coupée pendant l'envoi."));
    requete.onabort = () => rejeter(new Error("Envoi annulé."));
    options.signal?.addEventListener("abort", () => requete.abort());
    const formulaire = new FormData();
    formulaire.append("fichier", fichier);
    requete.send(formulaire);
  });
}

export function formaterTaille(octets: number): string {
  if (octets < 1024 * 1024) return `${Math.max(1, Math.round(octets / 1024))} Ko`;
  if (octets < 1024 * 1024 * 1024) return `${(octets / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
  return `${(octets / 1024 / 1024 / 1024).toFixed(2).replace(".", ",")} Go`;
}

export function verifierFichier(fichier: File, extensions: readonly string[], tailleMax: number): string | null {
  const point = fichier.name.lastIndexOf(".");
  const extension = point > 0 ? fichier.name.slice(point).toLowerCase() : "";
  if (!extensions.includes(extension)) {
    return `Format non accepté (${extension || "sans extension"}). Formats possibles : ${extensions.join(", ")}.`;
  }
  if (fichier.size > tailleMax) {
    return `Fichier trop volumineux : ${formaterTaille(fichier.size)}, la limite est de ${formaterTaille(tailleMax)}.`;
  }
  return null;
}

export function urlFichier(cheminRelatif: string): string {
  return `/api/fichiers/${cheminRelatif.split("/").map(encodeURIComponent).join("/")}`;
}

export function messageErreur(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : String(erreur);
}
