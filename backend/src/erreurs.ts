export class ErreurHttp extends Error {
  readonly statut: number;

  constructor(statut: number, message: string) {
    super(message);
    this.statut = statut;
  }
}

export function codeErreur(erreur: unknown): string | undefined {
  if (typeof erreur === "object" && erreur !== null && "code" in erreur && typeof erreur.code === "string") {
    return erreur.code;
  }
  return undefined;
}
