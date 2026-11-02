export function codeErreur(erreur: unknown): string | undefined {
  if (erreur instanceof Error && "code" in erreur && typeof erreur.code === "string") {
    return erreur.code;
  }
  return undefined;
}
