import { plagesImage, schemaPropositionPlan, type AssetBibliotheque, type PropositionPlan, type SegmentPlan } from "@editeur/shared";
import { describe, expect, it } from "vitest";
import { validerPlan, type SourcesPlan } from "./validation.ts";

function segment(id: string, debut: number, fin: number, source = "rushes/a.mp4"): SegmentPlan {
  return { id, source, debut, fin, role: "moment fort", citation: "", raison: "", decalageImage: 0, cadrage: null, transition: "coupe" };
}

function plan(changement: Partial<PropositionPlan> = {}): PropositionPlan {
  return {
    resume: "",
    hook: { segment: "s1", explication: "" },
    segments: [segment("s1", 0, 10), segment("s2", 20, 30)],
    plansDeCoupe: [],
    musiques: [],
    bruitages: [],
    textes: [],
    sousTitres: false,
    pointsAVerifier: [],
    reponsesRetours: [],
    ...changement,
  };
}

const ASSET: AssetBibliotheque = {
  id: "lofi",
  type: "musique",
  chaine: "commun",
  chemin: "commun/musiques/lofi.mp3",
  description: "",
  etiquettes: [],
  langue: null,
  source: "utilisateur",
  artiste: null,
  licence: "",
  utilisations: [],
};

function sources(changement: Partial<SourcesPlan> = {}): SourcesPlan {
  return {
    medias: new Map([
      ["rushes/a.mp4", { genre: "video", duree: 60 }],
      ["assets/musique.mp3", { genre: "audio", duree: 120 }],
      ["assets/logo.png", { genre: "image", duree: null }],
      ["travail/brouillon.mp4", { genre: "video", duree: 30 }],
    ]),
    assets: new Map([["lofi", { asset: ASSET, valide: true }]]),
    assetsChoisis: ["lofi"],
    dureeViseeSecondes: null,
    ...changement,
  };
}

const messages = (problemes: ReturnType<typeof validerPlan>) => problemes.map(({ niveau, message, segment: id }) => `${niveau} ${id ?? "-"} ${message}`);

describe("validerPlan", () => {
  it("accepte un plan correct", () => {
    expect(validerPlan(plan(), sources())).toEqual([]);
  });

  it("refuse les sources absentes, hors du projet utilisable ou qui ne sont pas des médias", () => {
    const problemes = validerPlan(
      plan({ segments: [segment("s1", 0, 5), segment("s2", 0, 5, "rushes/absent.mp4"), segment("s3", 0, 5, "assets/logo.png"), segment("s4", 0, 5, "travail/brouillon.mp4")] }),
      sources(),
    );
    expect(messages(problemes)).toEqual([
      "erreur s2 Source introuvable ou inutilisable : rushes/absent.mp4.",
      "erreur s3 Source introuvable ou inutilisable : assets/logo.png.",
      "erreur s4 Source introuvable ou inutilisable : travail/brouillon.mp4.",
    ]);
  });

  it("vérifie les bornes, les doublons, les chevauchements et l'accroche", () => {
    const problemes = validerPlan(
      plan({
        hook: { segment: "s9", explication: "" },
        segments: [segment("s1", 10, 5), segment("s2", 50, 61), segment("s3", 0, 0.2), segment("s3", 55, 58)],
      }),
      sources(),
    );
    expect(messages(problemes)).toEqual([
      "erreur s1 La fin (0:05,0) doit venir après le début (0:10,0).",
      "erreur s2 La fin (1:01,0) dépasse la durée du rush (1:00,0).",
      "avertissement s3 Segment très court : moins de 0,3 s.",
      "erreur s3 L'identifiant s3 est utilisé deux fois.",
      "avertissement s3 Reprend un passage déjà utilisé par s2.",
      "erreur - L'accroche renvoie à un segment inconnu : s9.",
    ]);
  });

  it("tolère une fin qui dépasse de quelques centièmes et ignore la durée inconnue", () => {
    expect(validerPlan(plan({ segments: [segment("s1", 50, 60.04)] }), sources())).toEqual([]);
    const sansDuree = sources({ medias: new Map([["rushes/a.mp4", { genre: "video", duree: null }]]) });
    expect(validerPlan(plan({ segments: [segment("s1", 0, 500)] }), sansDuree)).toEqual([]);
  });

  it("vérifie les musiques du projet et de la bibliothèque", () => {
    const musique = { debut: 0, fin: null, volumeDb: -18, baisseSousVoix: true, raison: "" };
    const problemes = validerPlan(
      plan({
        musiques: [
          { ...musique, origine: "projet", reference: "assets/musique.mp3" },
          { ...musique, origine: "projet", reference: "rushes/a.mp4" },
          { ...musique, origine: "bibliotheque", reference: "inconnu" },
          { ...musique, origine: "bibliotheque", reference: "lofi", debut: 25 },
          { ...musique, origine: "bibliotheque", reference: "lofi", debut: 5, fin: 4 },
        ],
      }),
      sources({ assetsChoisis: [] }),
    );
    expect(messages(problemes)).toEqual([
      "erreur - Musique introuvable dans le projet : rushes/a.mp4.",
      "erreur - Musique introuvable dans la bibliothèque : inconnu.",
      "avertissement - L'asset lofi n'est pas dans les assets choisis pour ce projet.",
      "erreur - La musique lofi commence après la fin de la vidéo.",
      "avertissement - L'asset lofi n'est pas dans les assets choisis pour ce projet.",
      "erreur - La musique lofi finit avant de commencer.",
    ]);
  });

  it("refuse un asset à vérifier dans la bibliothèque", () => {
    const problemes = validerPlan(
      plan({ musiques: [{ origine: "bibliotheque", reference: "lofi", debut: 0, fin: null, volumeDb: -18, baisseSousVoix: true, raison: "" }] }),
      sources({ assets: new Map([["lofi", { asset: ASSET, valide: false }]]) }),
    );
    expect(messages(problemes)).toEqual(["erreur - L'asset lofi est à vérifier dans la bibliothèque (fichier ou accord d'artiste)."]);
  });

  it("signale un écart de plus de 25 % avec la durée visée, et un plan vide", () => {
    expect(validerPlan(plan(), sources({ dureeViseeSecondes: 22 }))).toEqual([]);
    expect(messages(validerPlan(plan(), sources({ dureeViseeSecondes: 60 })))).toEqual(["avertissement - Durée du plan : 0:20,0, pour 1:00,0 visées."]);
    expect(messages(validerPlan(plan({ segments: [] }), sources()))).toEqual(["erreur - Le plan ne contient aucun segment."]);
  });
});

describe("décalages d'image et plans de coupe", () => {
  it("calcule les plages d'image : en avance (négatif) ou en retard (positif) sur le son", () => {
    const segments = [segment("s1", 10, 20), { ...segment("s2", 30, 40), decalageImage: -1.5, cadrage: null }, { ...segment("s3", 50, 55), decalageImage: 0.5, cadrage: null }];
    expect(plagesImage(segments)).toEqual([
      { debut: 10, fin: 18.5 },
      { debut: 28.5, fin: 40.5 },
      { debut: 50.5, fin: 55 },
    ]);
  });

  it("accepte des décalages possibles et refuse les autres", () => {
    expect(validerPlan(plan({ segments: [segment("s1", 0, 10), { ...segment("s2", 20, 30), decalageImage: -2, cadrage: null }] }), sources())).toEqual([]);
    const problemes = validerPlan(
      plan({
        segments: [
          { ...segment("s1", 0, 10), decalageImage: 1, cadrage: null },
          { ...segment("s2", 0.5, 5), decalageImage: -1, cadrage: null },
          { ...segment("s3", 20, 21), decalageImage: 2, cadrage: null },
          { ...segment("s4", 50, 59.9) },
          { ...segment("s5", 30, 31), decalageImage: 0.5, cadrage: null },
        ],
      }),
      sources(),
    );
    expect(messages(problemes)).toEqual([
      "avertissement s2 Reprend un passage déjà utilisé par s1.",
      "erreur s1 Le premier segment ne peut pas avoir de décalage d'image.",
      "erreur s2 Avec le décalage, l'image commence avant le début du rush.",
      "erreur s3 L'image de s2 reste plus longtemps que tout ce segment.",
      "erreur s4 Avec le décalage du segment suivant, l'image dépasse la fin du rush.",
    ]);
  });

  it("vérifie les plans de coupe : vidéo du projet, bornes et place dans la vidéo finale", () => {
    const coupe = { source: "rushes/a.mp4", debut: 40, fin: 42, position: 3, raison: "", cadrage: null };
    expect(validerPlan(plan({ plansDeCoupe: [coupe] }), sources())).toEqual([]);
    const problemes = validerPlan(
      plan({
        plansDeCoupe: [
          { ...coupe, source: "assets/musique.mp3" },
          { ...coupe, fin: 39 },
          { ...coupe, debut: 58, fin: 62 },
          { ...coupe, position: 19 },
        ],
      }),
      sources(),
    );
    expect(messages(problemes)).toEqual([
      "erreur - Plan de coupe 1 : vidéo introuvable ou inutilisable : assets/musique.mp3.",
      "erreur - Plan de coupe 2 : la fin doit venir après le début.",
      "erreur - Plan de coupe 3 : la fin dépasse la durée de la vidéo (1:00,0).",
      "erreur - Plan de coupe 4 : dépasse la fin de la vidéo finale (0:20,0).",
    ]);
  });
});

describe("habillage", () => {
  const SON: AssetBibliotheque = { ...ASSET, id: "whoosh", type: "son", chemin: "commun/sons/whoosh.wav" };

  it("vérifie les bruitages : son de la bibliothèque, dans la vidéo", () => {
    const assets = new Map([
      ["lofi", { asset: ASSET, valide: true }],
      ["whoosh", { asset: SON, valide: true }],
    ]);
    const bruitage = (reference: string, position: number) => ({ origine: "bibliotheque" as const, reference, position, volumeDb: -6, raison: "" });
    const problemes = validerPlan(plan({ bruitages: [bruitage("whoosh", 3), bruitage("lofi", 4), bruitage("whoosh", 25)] }), sources({ assets, assetsChoisis: ["lofi", "whoosh"] }));
    expect(messages(problemes)).toEqual(["erreur - Bruitage introuvable dans la bibliothèque : lofi.", "erreur - Le bruitage whoosh tombe après la fin de la vidéo."]);
  });

  it("vérifie les textes à l'écran : bornes, fin de vidéo, place des sous-titres", () => {
    const texte = (debut: number, fin: number, position: "haut" | "bas" = "haut") => ({ texte: "Titre", debut, fin, position, taillePourcent: 10, couleur: null, apparition: "pop" as const, fond: "aucun" as const });
    const problemes = validerPlan(plan({ sousTitres: true, textes: [texte(0, 2), texte(3, 2), texte(19, 22), texte(25, 26), texte(1, 2, "bas")] }), sources());
    expect(messages(problemes)).toEqual([
      "erreur - Texte 2 (« Titre ») : la fin doit venir après le début.",
      "avertissement - Texte 3 (« Titre ») : dépasse la fin de la vidéo, il sera coupé.",
      "erreur - Texte 4 (« Titre ») : commence après la fin de la vidéo.",
      "avertissement - Texte 5 (« Titre ») : en bas, il risque de chevaucher les sous-titres.",
    ]);
  });
});

describe("cadrage et orientation", () => {
  it("prévient des bandes noires quand l'orientation change sans cadrage", () => {
    const medias = new Map([["rushes/a.mp4", { genre: "video" as const, duree: 60, largeur: 1920, hauteur: 1080 }]]);
    const vertical = sources({ medias, formatVertical: true });
    expect(messages(validerPlan(plan({ segments: [segment("s1", 0, 10)] }), vertical))).toEqual([
      "avertissement s1 Image horizontale dans une vidéo verticale, sans cadrage : bandes noires en haut et en bas. Ajoute un cadrage (recadré ou fond flou).",
    ]);
    const recadre = { ...segment("s1", 0, 10), cadrage: { mode: "recadre" as const, debut: { x: 0.5, y: 0.5, zoom: 1 }, fin: null } };
    expect(validerPlan(plan({ segments: [recadre] }), vertical)).toEqual([]);
    expect(validerPlan(plan({ segments: [segment("s1", 0, 10)] }), sources({ medias, formatVertical: false }))).toEqual([]);
  });
});

describe("schemaPropositionPlan", () => {
  it("refuse des identifiants de segment libres et un volume positif", () => {
    expect(schemaPropositionPlan.safeParse(plan()).success).toBe(true);
    expect(schemaPropositionPlan.safeParse(plan({ segments: [segment("intro", 0, 1)] })).success).toBe(false);
    const musique = { origine: "projet", reference: "a.mp3", debut: 0, fin: null, volumeDb: 3, baisseSousVoix: false, raison: "" } as const;
    expect(schemaPropositionPlan.safeParse(plan({ musiques: [musique] })).success).toBe(false);
  });
});
