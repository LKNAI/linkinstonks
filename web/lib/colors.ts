// GERADO por scripts/gen-colors.mjs a partir de config/instituicoes.yaml. Não edite à mão.
/** Cor de marca de cada instituição como escriturador, pelo nome curto. */
export const COR_ESCRITURADOR: Record<string, string> = {
  "Banco B3": "#0B7FA6",
  "Banco Bradesco": "#CC092F",
  "Banco do Brasil": "#F2C200",
  "Banco do Nordeste": "#8E1B3A",
  "Banco Mercantil do Brasil": "#2F80ED",
  "Banco Opportunity": "#334155",
  "Banco Safra": "#B8962E",
  "Banco Santander": "#FF3B30",
  "Banrisul": "#00579C",
  "Bradesco CTVM": "#E8607A",
  "BRB DTVM": "#0EA5E9",
  "BTG Pactual": "#0B3D91",
  "ID CTVM": "#14B8A6",
  "Itaú Corretora": "#EC7000",
  "Itaú Unibanco": "#F7A04B",
  "Não identificado": "#B9B8C7",
  "Não informado": "#D3D2DE",
  "Oliveira Trust": "#00A86B",
  "Oslo Capital DTVM": "#94A3B8",
  "Própria empresa": "#5B6B82",
  "Vórtx DTVM": "#7B2FF7",
};

/** Cor usada no painel de BDRs quando difere da de escriturador (ex.: Itaú Unibanco). */
export const COR_DEPOSITARIA: Record<string, string> = {
  "Itaú Unibanco": "#EC7000",
};

/** Instituição sem cor definida recebe um cinza neutro. Nunca gerar cor aleatória. */
export const COR_NEUTRA = "#A3A2B5";

export const corEscriturador = (nome: string): string => COR_ESCRITURADOR[nome] ?? COR_NEUTRA;
export const corDepositaria = (nome: string): string => COR_DEPOSITARIA[nome] ?? COR_ESCRITURADOR[nome] ?? COR_NEUTRA;

/** Pares de marcas que se confundem lado a lado; a variante de `ajustado` vale só se `fixo` está no mesmo gráfico. */
const PARES_CONFUSOS = [
  {
    "fixo": "Banco Bradesco",
    "ajustado": "Banco Santander",
    "variante": "#FF493E"
  },
  {
    "fixo": "Itaú Corretora",
    "ajustado": "Itaú Unibanco",
    "variante": "#F8AB5F"
  }
] as const;

/** Cor de cada instituição de UM gráfico: a de marca, com a variante quando o par confuso aparece junto. */
export function coresDoConjunto(nomes: readonly string[]): (nome: string) => string {
  const presentes = new Set(nomes);
  const variantes = new Map<string, string>();
  for (const p of PARES_CONFUSOS) if (presentes.has(p.fixo) && presentes.has(p.ajustado)) variantes.set(p.ajustado, p.variante);
  return (nome) => variantes.get(nome) ?? corEscriturador(nome);
}
