import { mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { ensureBrowser, openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { ID_TEXTE, dureeEnImages, type ProprietesCompositionTexte } from "@editeur/animations/compositions";
import { APPARITIONS_TEXTE, FONDS_TEXTE, type TexteEcran } from "@editeur/shared";

const RACINE = resolve(import.meta.dirname, "..");
const IPS = 30;
const INSTANTS = [0.1, 0.25, 0.5, 1, 1.9];
const ECHELLE = 0.3;
const sortie = resolve(process.argv[2] ?? join(tmpdir(), "controle-animations.png"));
const police = process.argv[3] ?? null;

const exemples: TexteEcran[] = [
  ...APPARITIONS_TEXTE.map((apparition) => ({ texte: `${apparition} : trois *outils*`, apparition, fond: "aucun" as const })),
  ...FONDS_TEXTE.filter((fond) => fond !== "aucun").map((fond) => ({ texte: `fond ${fond} : *étape* 2`, apparition: "mot-a-mot" as const, fond })),
].map((exemple) => ({ ...exemple, debut: 0, fin: 2, position: "centre" as const, taillePourcent: 7, couleur: null }));

const dossier = join(tmpdir(), `controle-animations-${process.pid}`);
await mkdir(dossier, { recursive: true });
await ensureBrowser({ logLevel: "error" });
const serveUrl = await bundle({ entryPoint: join(RACINE, "animations", "src", "Racine.tsx"), outDir: join(dossier, "paquet") });
const navigateur = await openBrowser("chrome", { logLevel: "error" });
let numero = 0;
try {
  for (const texte of exemples) {
    const inputProps: ProprietesCompositionTexte = {
      texte,
      style: { couleur: "#FFFFFF", couleurAccent: "#FFD43B", police: police === null ? null : `file:///${resolve(police).replaceAll("\\", "/")}` },
      largeur: 1080,
      hauteur: 1920,
      ips: IPS,
    };
    const composition = await selectComposition({ serveUrl, id: ID_TEXTE, inputProps, puppeteerInstance: navigateur, logLevel: "error" });
    for (const instant of INSTANTS) {
      const image = Math.min(dureeEnImages(texte, IPS) - 1, Math.round(instant * IPS));
      await renderStill({ composition, serveUrl, inputProps, frame: image, scale: ECHELLE, imageFormat: "png", output: join(dossier, `${String(numero++).padStart(3, "0")}.png`), puppeteerInstance: navigateur, logLevel: "error" });
    }
  }
} finally {
  await navigateur.close({ silent: true });
}

const largeur = Math.round(1080 * ECHELLE);
const hauteur = Math.round(1920 * ECHELLE);
const resultat = spawnSync(
  "ffmpeg",
  ["-v", "error", "-y", "-f", "lavfi", "-i", `color=c=0x4a5d70:s=${largeur}x${hauteur}:r=1`, "-framerate", "1", "-i", join(dossier, "%03d.png"), "-filter_complex", `[0][1]overlay=shortest=1,tile=${INSTANTS.length}x${exemples.length}:padding=4`, "-frames:v", "1", sortie],
  { stdio: "inherit" },
);
await rm(dossier, { recursive: true, force: true });
if (resultat.status !== 0) process.exit(1);
console.log(`Planche de contrôle : ${sortie}`);
console.log(`Lignes : ${exemples.map((exemple) => `${exemple.apparition}/${exemple.fond}`).join(", ")}. Colonnes : ${INSTANTS.map((instant) => `${instant} s`).join(", ")}.`);
