const VARIABLES_CONSERVEES = new Set(["CLAUDE_CONFIG_DIR"]);

export function environnementClaude(environnement: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const resultat: NodeJS.ProcessEnv = {};
  for (const [nom, valeur] of Object.entries(environnement)) {
    const nomMajuscule = nom.toUpperCase();
    const retiree =
      (nomMajuscule.startsWith("ANTHROPIC") || nomMajuscule.startsWith("CLAUDE")) &&
      !VARIABLES_CONSERVEES.has(nomMajuscule);
    if (!retiree) {
      resultat[nom] = valeur;
    }
  }
  return resultat;
}
