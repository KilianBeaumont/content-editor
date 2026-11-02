import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync, utimesSync } from "node:fs";
import { join, resolve } from "node:path";

const RACINE = resolve(import.meta.dirname, "..");
const PORT = Number(process.env.EDITEUR_PORT) || 4317;
const ADRESSE = `http://127.0.0.1:${PORT}`;
const WINDOWS = process.platform === "win32";

function date(chemin: string): number {
  if (!existsSync(chemin)) return 0;
  const infos = statSync(chemin);
  if (!infos.isDirectory()) return infos.mtimeMs;
  return Math.max(infos.mtimeMs, ...readdirSync(chemin).map((nom) => date(join(chemin, nom))));
}

function npm(...args: string[]): void {
  const [commande, debut] = WINDOWS ? ["cmd.exe", ["/d", "/c", "npm"]] : ["npm", []];
  const resultat = spawnSync(commande, [...debut, ...args], { cwd: RACINE, stdio: "inherit" });
  if (resultat.status !== 0) {
    console.error(`\nLa commande « npm ${args.join(" ")} » a échoué (voir ci-dessus).`);
    process.exit(1);
  }
}

async function repond(): Promise<boolean> {
  try {
    const reponse = await fetch(`${ADRESSE}/api/sante`, { signal: AbortSignal.timeout(1000) });
    return reponse.ok;
  } catch {
    return false;
  }
}

function ouvrirNavigateur(): void {
  if (process.env.EDITEUR_NAVIGATEUR === "non") return;
  const [commande, args] = WINDOWS ? ["cmd", ["/c", "start", "", ADRESSE]] : ["open", [ADRESSE]];
  spawn(commande, args, { detached: true, stdio: "ignore" }).unref();
}

const majeure = Number(process.versions.node.split(".")[0]);
if (majeure < 24) {
  console.error(`Node.js ${process.versions.node} est trop ancien : installe Node.js 24 ou plus récent depuis https://nodejs.org.`);
  process.exit(1);
}

if (await repond()) {
  console.log(`L'éditeur tourne déjà : ouverture de ${ADRESSE}.`);
  ouvrirNavigateur();
  process.exit(0);
}

const temoin = join(RACINE, "node_modules", ".package-lock.json");
if (date(temoin) < date(join(RACINE, "package-lock.json"))) {
  console.log("Installation des dépendances…");
  npm("install", "--no-audit", "--no-fund");
  const maintenant = new Date();
  if (existsSync(temoin)) utimesSync(temoin, maintenant, maintenant);
}

const sources = ["frontend/src", "frontend/index.html", "frontend/vite.config.ts", "shared/src"].map((chemin) => date(join(RACINE, chemin)));
if (date(join(RACINE, "frontend", "dist", "index.html")) < Math.max(...sources)) {
  console.log("Préparation de l'interface…");
  npm("run", "build", "--silent");
}

const serveur = spawn(process.execPath, ["backend/src/server.ts"], {
  cwd: RACINE,
  stdio: "inherit",
  env: { ...process.env, EDITEUR_PORT: String(PORT) },
});
serveur.on("exit", (code) => process.exit(code ?? 0));

for (let essai = 0; essai < 120 && serveur.exitCode === null; essai++) {
  if (await repond()) {
    console.log("\nGarde cette fenêtre ouverte pendant que tu utilises l'éditeur. Ferme-la pour l'arrêter.\n");
    ouvrirNavigateur();
    break;
  }
  await new Promise((resoudre) => setTimeout(resoudre, 500));
}
