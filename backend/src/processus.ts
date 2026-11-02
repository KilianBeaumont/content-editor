import { spawn } from "node:child_process";

export interface OptionsProcessus {
  delaiMs: number;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}

export interface ResultatProcessus {
  code: number | null;
  sortie: string;
  erreurs: string;
  delaiDepasse: boolean;
}

export function executer(commande: string, args: string[], options: OptionsProcessus): Promise<ResultatProcessus> {
  return new Promise((resoudre, rejeter) => {
    const enfant = spawn(commande, args, {
      cwd: options.cwd,
      env: options.env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let sortie = "";
    let erreurs = "";
    let delaiDepasse = false;
    enfant.stdout.setEncoding("utf8").on("data", (morceau: string) => (sortie += morceau));
    enfant.stderr.setEncoding("utf8").on("data", (morceau: string) => (erreurs += morceau));

    const minuteur = setTimeout(() => {
      delaiDepasse = true;
      enfant.kill();
    }, options.delaiMs);

    enfant.on("error", (erreur) => {
      clearTimeout(minuteur);
      rejeter(erreur);
    });
    enfant.on("close", (code) => {
      clearTimeout(minuteur);
      resoudre({ code, sortie, erreurs, delaiDepasse });
    });
  });
}
