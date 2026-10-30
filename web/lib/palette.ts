// Cores de categoria (rampa ameixa da direção A). Espelham os tokens `--cat-*` de styles/tokens.css
// (o teste tests/unit/palette.test.ts garante que não divergem). As cores das INSTITUIÇÕES vêm de lib/colors.ts.
import type { Bdr } from "@/lib/schemas";

export const CAT_COR = ["#5a265e", "#99419f", "#c175c7", "#c9cfdb"] as const; // --cat-1..3 e --cat-none
export const CAT_ALT_COR = ["#5b6578", "#7a8499", "#98a1b4", "#b3bacb"] as const; // --cat-alt-1..4
export const COR_SEM_DADOS = CAT_COR[3];
export const COR_TEXTO = "#141a2a"; // --text

export const SEGMENTO_COR: Record<string, string> = {
  NM: CAT_COR[0],
  N2: CAT_COR[1],
  N1: CAT_COR[2],
  MP: CAT_ALT_COR[0],
  B: CAT_ALT_COR[1],
  SO: CAT_ALT_COR[2],
  BN: CAT_ALT_COR[3],
  "?": COR_SEM_DADOS,
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
  "Trocou de escriturador": CAT_COR[0],
  "Sem troca registrada": CAT_COR[2],
  "Sem dados na CVM": COR_SEM_DADOS,
};

/** Painel de BDRs agrupa DR1/DR2/DR3 em "Patrocinado" (SPO). */
export type TipoGrupo = "DRN" | "DRE" | "SPO";
export const TIPO_GRUPO_NOME: Record<TipoGrupo, string> = {
  DRN: "Não patrocinado",
  DRE: "ETF",
  SPO: "Patrocinado",
};
export const TIPO_GRUPO_COR: Record<TipoGrupo, string> = {
  DRN: CAT_COR[0],
  DRE: CAT_COR[2],
  SPO: CAT_COR[1],
};
export const grupoDoTipo = (t: Bdr["tipo"]): TipoGrupo => (t === "DRN" || t === "DRE" ? t : "SPO");

export const CATEGORIA_SEM = "Sem categoria";
export const CATEGORIA_COR: Record<string, string> = {
  "Renda Variável": CAT_COR[0],
  "Renda Fixa": CAT_COR[1],
  Commodities: CAT_COR[2],
  Moeda: CAT_ALT_COR[0], // 4ª classe: a rampa foi validada com 3 passos; segue neutro, sempre com rótulo
  [CATEGORIA_SEM]: COR_SEM_DADOS,
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
  contraste("#ffffff", fundo) >= 4.5 ? "#ffffff" : COR_TEXTO;

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
