import { randomUUID } from "node:crypto";
import { ETATS_TACHE, TYPES_TACHE, tacheActive, type ParametresTache, type Tache, type TypeTache } from "@editeur/shared";
import { z } from "zod";
import { ErreurHttp } from "../erreurs.ts";
import { ecrireJsonAtomique, lireJsonAvecDefauts } from "../fichiers.ts";

const HISTORIQUE = 100;
const INTERVALLE_PROGRESSION_MS = 250;

export class TacheAnnulee extends Error {
  constructor() {
    super("Tâche annulée.");
  }
}

export interface OutilsTache {
  signal: AbortSignal;
  progression: (fraction: number | null, etape?: string) => void;
}

export type Executeur = (tache: Tache, outils: OutilsTache) => Promise<string | null>;

const schemaTaches = z.object({
  taches: z.array(
    z.object({
      id: z.string(),
      type: z.enum(TYPES_TACHE),
      libelle: z.string(),
      projet: z.string().nullable(),
      parametres: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
      etat: z.enum(ETATS_TACHE),
      progression: z.number().nullable(),
      etape: z.string().nullable(),
      resteSecondes: z.number().nullable(),
      creeLe: z.string(),
      demarreLe: z.string().nullable(),
      termineLe: z.string().nullable(),
      resultat: z.string().nullable(),
      erreur: z.string().nullable(),
    }),
  ),
}) satisfies z.ZodType<{ taches: Tache[] }>;

export class FileDeTaches {
  private taches: Tache[] = [];
  private readonly controleurs = new Map<string, AbortController>();
  private readonly abonnes = new Set<(taches: Tache[]) => void>();
  private enCours = 0;
  private derniereDiffusion = 0;
  private diffusionPrevue: ReturnType<typeof setTimeout> | null = null;
  private ecriture: Promise<void> = Promise.resolve();
  private readonly fichier: () => string;
  private readonly executeurs: Record<TypeTache, Executeur>;
  private readonly simultanees: () => number;

  constructor(fichier: () => string, executeurs: Record<TypeTache, Executeur>, simultanees: () => number = () => 1) {
    this.fichier = fichier;
    this.executeurs = executeurs;
    this.simultanees = simultanees;
  }

  async charger(): Promise<void> {
    const { taches } = await lireJsonAvecDefauts(this.fichier(), schemaTaches, { taches: [] });
    const maintenant = new Date().toISOString();
    this.taches = taches.map((tache) =>
      tacheActive(tache)
        ? { ...tache, etat: "interrompue", termineLe: maintenant, resteSecondes: null, erreur: "L'outil a été arrêté pendant la tâche." }
        : tache,
    );
    await this.enregistrer();
  }

  liste(): Tache[] {
    return this.taches;
  }

  abonner(abonne: (taches: Tache[]) => void): () => void {
    this.abonnes.add(abonne);
    abonne(this.taches);
    return () => this.abonnes.delete(abonne);
  }

  ajouter(type: TypeTache, libelle: string, projet: string | null, parametres: ParametresTache): Tache {
    const tache: Tache = {
      id: randomUUID(),
      type,
      libelle,
      projet,
      parametres,
      etat: "attente",
      progression: null,
      etape: null,
      resteSecondes: null,
      creeLe: new Date().toISOString(),
      demarreLe: null,
      termineLe: null,
      resultat: null,
      erreur: null,
    };
    this.taches = [tache, ...this.taches];
    this.changer();
    this.demarrerSuivantes();
    return tache;
  }

  annuler(id: string): Tache {
    const tache = this.trouver(id);
    if (!tacheActive(tache)) throw new ErreurHttp(409, "Cette tâche est déjà terminée.");
    if (tache.etat === "attente") {
      this.modifier(id, { etat: "annulee", termineLe: new Date().toISOString() });
    } else {
      this.controleurs.get(id)?.abort();
    }
    return this.trouver(id);
  }

  relancer(id: string): Tache {
    const tache = this.trouver(id);
    if (tacheActive(tache)) throw new ErreurHttp(409, "Cette tâche n'est pas terminée.");
    return this.ajouter(tache.type, tache.libelle, tache.projet, tache.parametres);
  }

  oublierTerminees(): void {
    this.taches = this.taches.filter(tacheActive);
    this.changer();
  }

  async attendre(id: string): Promise<Tache> {
    for (;;) {
      const tache = this.trouver(id);
      if (!tacheActive(tache)) return tache;
      await new Promise((resoudre) => setTimeout(resoudre, 20));
    }
  }

  private trouver(id: string): Tache {
    const tache = this.taches.find((element) => element.id === id);
    if (tache === undefined) throw new ErreurHttp(404, "Tâche introuvable.");
    return tache;
  }

  private modifier(id: string, changement: Partial<Tache>, progressionSeule = false): void {
    this.taches = this.taches.map((tache) => (tache.id === id ? { ...tache, ...changement } : tache));
    this.changer(progressionSeule);
  }

  private demarrerSuivantes(): void {
    while (this.enCours < this.simultanees()) {
      const suivante = [...this.taches].reverse().find((tache) => tache.etat === "attente");
      if (suivante === undefined) return;
      this.enCours++;
      void this.executer(suivante).finally(() => {
        this.enCours--;
        this.demarrerSuivantes();
      });
    }
  }

  private async executer(tache: Tache): Promise<void> {
    const controleur = new AbortController();
    this.controleurs.set(tache.id, controleur);
    const debut = Date.now();
    this.modifier(tache.id, { etat: "en-cours", demarreLe: new Date(debut).toISOString(), progression: null });

    const outils: OutilsTache = {
      signal: controleur.signal,
      progression: (fraction, etape) => {
        const borne = fraction === null ? null : Math.min(1, Math.max(0, fraction));
        const ecoule = (Date.now() - debut) / 1000;
        const resteSecondes = borne !== null && borne > 0.03 && ecoule > 3 ? Math.round((ecoule * (1 - borne)) / borne) : null;
        this.modifier(tache.id, { progression: borne, resteSecondes, ...(etape === undefined ? {} : { etape }) }, true);
      },
    };

    try {
      const resultat = await this.executeurs[tache.type](this.trouver(tache.id), outils);
      if (controleur.signal.aborted) throw new TacheAnnulee();
      this.modifier(tache.id, { etat: "terminee", progression: 1, resteSecondes: null, termineLe: new Date().toISOString(), resultat });
    } catch (erreur) {
      const annulee = controleur.signal.aborted || erreur instanceof TacheAnnulee;
      this.modifier(tache.id, {
        etat: annulee ? "annulee" : "echouee",
        resteSecondes: null,
        termineLe: new Date().toISOString(),
        erreur: annulee ? null : erreur instanceof Error ? erreur.message : String(erreur),
      });
    } finally {
      this.controleurs.delete(tache.id);
    }
  }

  private changer(progressionSeule = false): void {
    if (!progressionSeule) {
      const actives = this.taches.filter(tacheActive);
      const terminees = this.taches.filter((tache) => !tacheActive(tache)).slice(0, HISTORIQUE);
      this.taches = this.taches.filter((tache) => actives.includes(tache) || terminees.includes(tache));
      void this.enregistrer();
      this.diffuser();
      return;
    }
    const attente = INTERVALLE_PROGRESSION_MS - (Date.now() - this.derniereDiffusion);
    if (attente <= 0) {
      this.diffuser();
    } else if (this.diffusionPrevue === null) {
      this.diffusionPrevue = setTimeout(() => this.diffuser(), attente);
    }
  }

  private diffuser(): void {
    if (this.diffusionPrevue !== null) clearTimeout(this.diffusionPrevue);
    this.diffusionPrevue = null;
    this.derniereDiffusion = Date.now();
    for (const abonne of this.abonnes) abonne(this.taches);
  }

  private enregistrer(): Promise<void> {
    const taches = this.taches;
    this.ecriture = this.ecriture.then(async () => {
      try {
        await ecrireJsonAtomique(this.fichier(), { taches });
      } catch (erreur) {
        console.error(`Impossible d'enregistrer la liste des tâches : ${erreur instanceof Error ? erreur.message : String(erreur)}`);
      }
    });
    return this.ecriture;
  }
}
