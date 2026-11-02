import type { ReponseErreur } from "@editeur/shared";

export async function lireJson<T>(chemin: string): Promise<T> {
  const reponse = await fetch(chemin);
  if (!reponse.ok) {
    const corps = (await reponse.json().catch(() => null)) as ReponseErreur | null;
    throw new Error(corps?.erreur ?? `Erreur ${reponse.status}`);
  }
  return (await reponse.json()) as T;
}
