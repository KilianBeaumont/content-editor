import { EXTENSIONS_AUDIO, EXTENSIONS_IMAGE, EXTENSIONS_POLICE, EXTENSIONS_VIDEO } from "@editeur/shared";
import { useEffect, useState } from "react";
import { urlFichier } from "../api.ts";

type Genre = "image" | "audio" | "video" | "police" | "pdf" | "autre";

function extension(chemin: string): string {
  const nom = chemin.split("/").at(-1) ?? "";
  const point = nom.lastIndexOf(".");
  return point > 0 ? nom.slice(point).toLowerCase() : "";
}

function genre(chemin: string): Genre {
  const ext = extension(chemin);
  const dans = (liste: readonly string[]) => liste.includes(ext);
  if (dans(EXTENSIONS_IMAGE)) return "image";
  if (dans(EXTENSIONS_AUDIO)) return "audio";
  if (dans(EXTENSIONS_VIDEO) || [".m4v", ".mts", ".m2ts", ".avi"].includes(ext)) return "video";
  if (dans(EXTENSIONS_POLICE)) return "police";
  if (ext === ".pdf") return "pdf";
  return "autre";
}

function ApercuPolice({ url, compact }: { url: string; compact: boolean }) {
  const [famille, setFamille] = useState<string | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    const nom = `apercu-${Math.random().toString(36).slice(2)}`;
    const police = new FontFace(nom, `url("${url}")`);
    let actif = true;
    police
      .load()
      .then((chargee) => {
        if (!actif) return;
        document.fonts.add(chargee);
        setFamille(nom);
      })
      .catch(() => actif && setErreur(true));
    return () => {
      actif = false;
      document.fonts.delete(police);
    };
  }, [url]);

  if (erreur) return <p className="note">Police illisible.</p>;
  if (famille === null) return <p className="note">Chargement…</p>;
  return (
    <p className="apercu-police" style={{ fontFamily: famille }}>
      {compact ? "Aa" : "Le dernier dragon veillait sur la forge des mondes. 0123456789"}
    </p>
  );
}

export function ApercuFichier({ chemin, compact = false }: { chemin: string; compact?: boolean }) {
  const [illisible, setIllisible] = useState(false);
  const url = urlFichier(chemin);
  const nom = chemin.split("/").at(-1) ?? chemin;
  const type = genre(chemin);

  useEffect(() => setIllisible(false), [chemin]);

  return (
    <div className={compact ? "apercu-fichier apercu-compact" : "apercu-fichier"}>
      {illisible ? (
        <p className="note">
          {compact ? extension(chemin) : "Le navigateur ne sait pas lire ce format. Le fichier reste utilisable pour le montage."}
        </p>
      ) : (
        <>
          {type === "image" && <img src={url} alt={nom} loading="lazy" onError={() => setIllisible(true)} />}
          {type === "audio" &&
            (compact ? (
              <p className="apercu-icone">♪ {extension(chemin)}</p>
            ) : (
              <audio src={url} controls preload="none" onError={() => setIllisible(true)} />
            ))}
          {type === "video" && (
            <video
              src={`${url}#t=0.5`}
              controls={!compact}
              muted={compact}
              preload="metadata"
              onError={() => setIllisible(true)}
            />
          )}
          {type === "police" && <ApercuPolice url={url} compact={compact} />}
          {type === "pdf" && !compact && <iframe src={url} title={nom} />}
          {(type === "autre" || (type === "pdf" && compact)) && <p className="apercu-icone">{extension(chemin) || "dossier"}</p>}
        </>
      )}
      {!compact && (
        <a href={url} target="_blank" rel="noreferrer">
          Ouvrir {nom}
        </a>
      )}
    </div>
  );
}
