import { spawn } from "node:child_process";
import { dirname } from "node:path";

export function commandeAffichage(chemin: string, plateforme: NodeJS.Platform = process.platform): { commande: string; args: string[] } {
  if (plateforme === "win32") return { commande: "explorer.exe", args: [`/select,${chemin}`] };
  if (plateforme === "darwin") return { commande: "open", args: ["-R", chemin] };
  return { commande: "xdg-open", args: [dirname(chemin)] };
}

export function afficherDansExplorateur(chemin: string): void {
  const { commande, args } = commandeAffichage(chemin);
  const enfant = spawn(commande, args, { detached: true, stdio: "ignore" });
  enfant.on("error", () => undefined);
  enfant.unref();
}
