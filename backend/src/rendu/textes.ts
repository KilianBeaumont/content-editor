import { readdir, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { ID_TEXTE, dureeEnImages, type ProprietesCompositionTexte } from "@editeur/animations/compositions";
import type { PlanMontage, StyleTextes, TexteEcran } from "@editeur/shared";
import { bundle } from "@remotion/bundler";
import { ensureBrowser, makeCancelSignal, openBrowser, renderMedia, selectComposition } from "@remotion/renderer";
import { lireParametres } from "../parametres.ts";
import type { OutilsTache } from "../taches/file.ts";
import type { FormatRendu, IncrustationRendu } from "./graphe.ts";
import { policeDesTextes } from "./sous-titres.ts";

const TYPES_POLICE: Record<string, string> = { ".ttf": "font/ttf", ".otf": "font/otf", ".ttc": "font/collection" };

export interface TextesRendu {
  racineDepot: string;
  textes: TexteEcran[];
  style: StyleTextes;
}

let paquet: { signature: string; chemin: Promise<string> } | null = null;

async function signatureSources(dossiers: string[]): Promise<string> {
  const valeurs: string[] = [];
  for (const dossier of dossiers) {
    for (const nom of await readdir(dossier, { recursive: true })) {
      const infos = await stat(join(dossier, nom));
      if (infos.isFile()) valeurs.push(`${nom}:${infos.mtimeMs}`);
    }
  }
  return valeurs.sort().join("|");
}

async function paquetAnimations(racineDepot: string): Promise<string> {
  const signature = await signatureSources([join(racineDepot, "animations", "src"), join(racineDepot, "shared", "src")]);
  if (paquet === null || paquet.signature !== signature) {
    const chemin = bundle({ entryPoint: join(racineDepot, "animations", "src", "Racine.tsx"), outDir: join(tmpdir(), "editeur-animations") });
    const courant = { signature, chemin };
    paquet = courant;
    chemin.catch(() => {
      if (paquet === courant) paquet = null;
    });
  }
  return paquet.chemin;
}

export async function preparerTextes(racineDepot: string, creations: string, plan: PlanMontage): Promise<TextesRendu | null> {
  if (plan.textes.length === 0) return null;
  const { sousTitres: reglages } = await lireParametres(creations);
  const police = await policeDesTextes(creations, reglages);
  const donnees = await readFile(police);
  const type = TYPES_POLICE[extname(police).toLowerCase()] ?? "font/ttf";
  return {
    racineDepot,
    textes: plan.textes,
    style: { couleur: reglages.couleur, couleurAccent: reglages.couleurAccent, police: `data:${type};base64,${donnees.toString("base64")}` },
  };
}

export async function rendreTextes(
  entree: TextesRendu,
  format: FormatRendu,
  ips: number,
  total: number,
  temporaire: string,
  outils: OutilsTache,
  progression: (fraction: number, etape: string) => void,
): Promise<IncrustationRendu[]> {
  const textes = entree.textes.filter((texte) => texte.debut < total).map((texte) => ({ ...texte, fin: Math.min(texte.fin, total) }));
  if (textes.length === 0) return [];
  progression(0, "Préparation des animations des textes");
  await ensureBrowser({
    logLevel: "error",
    onBrowserDownload: () => ({
      version: null,
      onProgress: ({ percent }) => progression(0, `Téléchargement du navigateur de rendu, une seule fois (${Math.round(percent * 100)} %)`),
    }),
  });
  const serveUrl = await paquetAnimations(entree.racineDepot);
  outils.signal.throwIfAborted();
  const navigateur = await openBrowser("chrome", { logLevel: "error" });
  const { cancelSignal, cancel } = makeCancelSignal();
  outils.signal.addEventListener("abort", cancel, { once: true });
  try {
    const incrustations: IncrustationRendu[] = [];
    for (const [index, texte] of textes.entries()) {
      const etape = `Animation du texte ${index + 1}/${textes.length}`;
      progression(index / textes.length, etape);
      const inputProps: ProprietesCompositionTexte = { texte, style: entree.style, largeur: format.largeur, hauteur: format.hauteur, ips };
      const composition = await selectComposition({ serveUrl, id: ID_TEXTE, inputProps, puppeteerInstance: navigateur, logLevel: "error" });
      const chemin = join(temporaire, `texte${String(index + 1).padStart(2, "0")}.mov`);
      await renderMedia({
        composition,
        serveUrl,
        inputProps,
        codec: "prores",
        proResProfile: "4444",
        imageFormat: "png",
        pixelFormat: "yuva444p10le",
        colorSpace: "bt709",
        outputLocation: chemin,
        puppeteerInstance: navigateur,
        cancelSignal,
        logLevel: "error",
        onProgress: ({ progress }) => progression((index + progress) / textes.length, etape),
      });
      incrustations.push({ chemin, position: texte.debut, duree: dureeEnImages(texte, ips) / ips });
    }
    return incrustations;
  } finally {
    outils.signal.removeEventListener("abort", cancel);
    await navigateur.close({ silent: true });
  }
}
