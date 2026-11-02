import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { rm } from "node:fs/promises";
import { extname, join } from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { slug } from "@editeur/shared";
import { ErreurHttp } from "./erreurs.ts";
import { existe, renommer } from "./fichiers.ts";

export function verifierExtension(nomFichier: string, extensions: readonly string[]): string {
  const extension = extname(nomFichier).toLowerCase();
  if (!extensions.includes(extension)) {
    throw new ErreurHttp(400, `Format non accepté (${extension || "sans extension"}). Formats possibles : ${extensions.join(", ")}.`);
  }
  return extension;
}

export async function nomLibre(dossier: string, nomFichier: string, defaut: string): Promise<string> {
  const extension = extname(nomFichier).toLowerCase();
  const base = slug(nomFichier.slice(0, nomFichier.length - extension.length)) || defaut;
  for (let numero = 1; ; numero++) {
    const nom = numero === 1 ? `${base}${extension}` : `${base}-${numero}${extension}`;
    if (!(await existe(join(dossier, nom)))) {
      return nom;
    }
  }
}

export async function enregistrerFlux(flux: Readable, dossier: string, nom: string): Promise<void> {
  const temporaire = join(dossier, `.${randomUUID()}.tmp`);
  try {
    await pipeline(flux, createWriteStream(temporaire, { flags: "wx" }));
    if ("truncated" in flux && flux.truncated === true) {
      throw new ErreurHttp(413, "Fichier trop volumineux.");
    }
    await renommer(temporaire, join(dossier, nom));
  } catch (erreur) {
    await rm(temporaire, { force: true });
    throw erreur;
  }
}
