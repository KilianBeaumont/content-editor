import type { ConfigMachine } from "./config.ts";

export interface ReponseSante {
  ok: true;
}

export interface ReponseErreur {
  erreur: string;
}

export interface ReponseConfigMachine {
  config: ConfigMachine;
  crees: string[];
}
