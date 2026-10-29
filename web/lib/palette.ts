// Cores de categoria (seção 11.3). As cores das INSTITUIÇÕES vêm de lib/colors.ts (gerado do YAML).
import type { Bdr } from "@/lib/schemas";

export const SEGMENTO_COR: Record<string, string> = {
  NM: "#4a3aa7",
  N2: "#8f80e6",
  N1: "#c4bcf3",
  MP: "#e87ba4",
  B: "#1baf7a",
  SO: "#eda100",
  BN: "#9aa3b5",
  "?": "#d3d2de",
};

export const SEGMENTO_NOME: Record<string, string> = {
  NM: "Novo Mercado",
  N2: "Nível 2",
  N1: "Nível 1",
  MP: "Bovespa Mais",
  B: "Tradicional",
  SO: "Balcão organizado (SOMA)",
  BN: "Balcão não organizado",
  "?": "Sem dados",
};

export const HISTORICO = ["Trocou de escriturador", "Sem troca registrada", "Sem dados na CVM"] as const;
export type Historico = (typeof HISTORICO)[number];
export const HISTORICO_COR: Record<Historico, string> = {
  "Trocou de escriturador": "#6250d6",
  "Sem troca registrada": "#1baf7a",
  "Sem dados na CVM": "#d3d2de",
};

/** Painel de BDRs agrupa DR1/DR2/DR3 em "Patrocinado" (SPO). */
export type TipoGrupo = "DRN" | "DRE" | "SPO";
export const TIPO_GRUPO_NOME: Record<TipoGrupo, string> = {
  DRN: "Não patrocinado",
  DRE: "ETF",
  SPO: "Patrocinado",
};
export const TIPO_GRUPO_COR: Record<TipoGrupo, string> = { DRN: "#6250d6", DRE: "#1baf7a", SPO: "#eda100" };
export const grupoDoTipo = (t: Bdr["tipo"]): TipoGrupo => (t === "DRN" || t === "DRE" ? t : "SPO");

export const CATEGORIA_SEM = "Sem categoria";
export const CATEGORIA_COR: Record<string, string> = {
  "Renda Variável": "#2a78d6",
  "Renda Fixa": "#e87ba4",
  Commodities: "#eda100",
  Moeda: "#14b8a6",
  [CATEGORIA_SEM]: "#B9B8C7",
};

/** Ordem em que as depositárias aparecem no donut. */
export const DEPOSITARIAS = ["Banco B3", "Banco Bradesco", "Itaú Unibanco", "Não identificado"] as const;
