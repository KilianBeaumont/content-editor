const verrous = new Map<string, Promise<unknown>>();

export function enSerie<T>(cle: string, operation: () => Promise<T>): Promise<T> {
  const suite = (verrous.get(cle) ?? Promise.resolve()).then(operation, operation);
  verrous.set(cle, suite.catch(() => undefined));
  return suite;
}
