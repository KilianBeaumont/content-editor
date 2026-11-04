import { Easing } from "remotion";

export const COURBES = {
  deceleration: Easing.bezier(0.16, 1, 0.3, 1),
  allerRetour: Easing.bezier(0.83, 0, 0.17, 1),
  acceleration: Easing.bezier(0.7, 0, 0.84, 0),
};

export const RESSORTS = {
  rebond: { damping: 11, stiffness: 170, mass: 0.6 },
  vif: { damping: 13, stiffness: 180, mass: 0.5 },
  doux: { damping: 200 },
};

export const DUREES = {
  entreeDouce: 0.35,
  sortie: 0.2,
  decalageMot: 0.1,
  retardSurlignage: 0.17,
  ouvertureEtiquette: 0.3,
};

export const LIMITE = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
