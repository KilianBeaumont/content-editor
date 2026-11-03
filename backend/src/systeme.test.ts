import { describe, expect, it } from "vitest";
import { commandeAffichage } from "./systeme.ts";

describe("afficher un fichier dans l'explorateur", () => {
  it("sélectionne le fichier dans l'Explorateur ou le Finder, ouvre le dossier ailleurs", () => {
    expect(commandeAffichage("C:\\creations\\exports\\youtube\\video.mp4", "win32")).toEqual({
      commande: "explorer.exe",
      args: ["/select,C:\\creations\\exports\\youtube\\video.mp4"],
    });
    expect(commandeAffichage("/creations/exports/youtube/video.mp4", "darwin")).toEqual({ commande: "open", args: ["-R", "/creations/exports/youtube/video.mp4"] });
    expect(commandeAffichage("/creations/exports/youtube/video.mp4", "linux")).toEqual({ commande: "xdg-open", args: ["/creations/exports/youtube"] });
  });
});
