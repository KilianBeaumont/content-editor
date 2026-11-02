import type { BinairesMachine, DiagnosticBinaire, NomBinaire } from "@editeur/shared";
import { codeErreur } from "./erreurs.ts";
import { executer } from "./processus.ts";

const DELAI_MS = 15_000;

const VERIFICATIONS: Record<NomBinaire, { args: string[]; lireVersion: boolean }> = {
  ffmpeg: { args: ["-version"], lireVersion: true },
  ffprobe: { args: ["-version"], lireVersion: true },
  claude: { args: ["--version"], lireVersion: true },
  whisper: { args: ["--help"], lireVersion: false },
};

function premiereLigne(texte: string): string | null {
  return texte.split(/\r?\n/).find((ligne) => ligne.trim() !== "")?.trim() ?? null;
}

export async function diagnostiquerBinaire(nom: NomBinaire, commande: string): Promise<DiagnosticBinaire> {
  const { args, lireVersion } = VERIFICATIONS[nom];
  const base = { nom, commande };
  try {
    const resultat = await executer(commande, args, { delaiMs: DELAI_MS });
    if (resultat.delaiDepasse) {
      return { ...base, trouve: true, version: null, erreur: "Ne répond pas." };
    }
    if (!lireVersion) {
      return { ...base, trouve: true, version: null, erreur: null };
    }
    if (resultat.code !== 0) {
      const detail = premiereLigne(resultat.erreurs) ?? `code de sortie ${resultat.code ?? "inconnu"}`;
      return { ...base, trouve: true, version: null, erreur: detail };
    }
    const version = premiereLigne(resultat.sortie)?.replace(/\s+Copyright.*$/, "") ?? null;
    return { ...base, trouve: true, version, erreur: null };
  } catch (erreur) {
    const message =
      codeErreur(erreur) === "ENOENT"
        ? "Introuvable : vérifie le chemin ou installe le programme."
        : `Impossible de le lancer : ${erreur instanceof Error ? erreur.message : String(erreur)}`;
    return { ...base, trouve: false, version: null, erreur: message };
  }
}

export function diagnostiquerBinaires(binaires: BinairesMachine): Promise<DiagnosticBinaire[]> {
  const noms = Object.keys(VERIFICATIONS) as NomBinaire[];
  return Promise.all(noms.map((nom) => diagnostiquerBinaire(nom, binaires[nom])));
}
