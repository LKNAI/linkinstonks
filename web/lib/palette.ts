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

const luminancia = (hex: string): number => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Razão de contraste WCAG entre duas cores `#rrggbb`. */
export const contraste = (a: string, b: string): number => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

/** Cor do texto (branco ou o grafite do site) com contraste AA sobre um fundo de categoria. */
export const textoSobre = (fundo: string): string =>
  contraste("#ffffff", fundo) >= 4.5 ? "#ffffff" : "#16152b";

/** Escurece `hex` (misturando com preto) até atingir `minimo`:1 de contraste sobre branco; devolve a própria cor se já passa. */
export const legivelSobreBranco = (hex: string, minimo = 3): string => {
  const mistura = (p: number) =>
    "#" +
    [1, 3, 5]
      .map((i) =>
        Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - p))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");
  for (let p = 0; p <= 0.6; p += 0.05) {
    const c = mistura(p);
    if (contraste(c, "#ffffff") >= minimo) return c;
  }
  return mistura(0.6);
};
