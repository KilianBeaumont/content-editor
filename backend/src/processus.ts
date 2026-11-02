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

export interface OptionsLancement {
  signal?: AbortSignal;
  cwd?: string;
  surLigne?: (ligne: string, flux: "sortie" | "erreurs") => void;
}

export interface ResultatLancement {
  code: number | null;
  dernieresErreurs: string[];
}

export function lancer(commande: string, args: string[], options: OptionsLancement = {}): Promise<ResultatLancement> {
  return new Promise((resoudre, rejeter) => {
    const enfant = spawn(commande, args, { cwd: options.cwd, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    const dernieresErreurs: string[] = [];
    const lire = (flux: "sortie" | "erreurs") => {
      let reste = "";
      return (morceau: string) => {
        const lignes = (reste + morceau).split(/\r?\n|\r/);
        reste = lignes.pop() ?? "";
        for (const ligne of lignes) {
          if (ligne.trim() === "") continue;
          if (flux === "erreurs") {
            dernieresErreurs.push(ligne);
            if (dernieresErreurs.length > 20) dernieresErreurs.shift();
          }
          options.surLigne?.(ligne, flux);
        }
      };
    };
    enfant.stdout.setEncoding("utf8").on("data", lire("sortie"));
    enfant.stderr.setEncoding("utf8").on("data", lire("erreurs"));

    const arreter = () => enfant.kill();
    options.signal?.addEventListener("abort", arreter, { once: true });
    enfant.on("error", (erreur) => {
      options.signal?.removeEventListener("abort", arreter);
      rejeter(erreur);
    });
    enfant.on("close", (code) => {
      options.signal?.removeEventListener("abort", arreter);
      resoudre({ code, dernieresErreurs });
    });
  });
}
