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

export async function envoyerFichier<T>(chemin: string, fichier: File): Promise<T> {
  const formulaire = new FormData();
  formulaire.append("fichier", fichier);
  return lireReponse<T>(await fetch(chemin, { method: "POST", body: formulaire }));
}

export function urlFichier(cheminRelatif: string): string {
  return `/api/fichiers/${cheminRelatif.split("/").map(encodeURIComponent).join("/")}`;
}

export function messageErreur(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : String(erreur);
}
