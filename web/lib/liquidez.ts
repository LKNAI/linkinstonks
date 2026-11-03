// Agregações e tabela da liquidez das ações, em funções puras. Definições em docs/metodologia.md.
import { type AcaoRow, type Fatia } from "@/lib/acoes";
import { montarCsv } from "@/lib/csv";
import { formatDate } from "@/lib/format";
import { LIQUIDEZ_COR, SEGMENTO_NOME } from "@/lib/palette";
import { ROTULO_LIQUIDEZ } from "@/lib/rotulos-liquidez";

/** Do que mais negocia para o que menos negocia; "sem_ticker" fica fora dos gráficos e é informado à parte. */
export const ORDEM_LIQUIDEZ = [
  "presenca_alta",
  "presenca_media",
  "presenca_baixa",
  "sem_negocios",
  "listagem_recente",
  "sem_cotacao_no_periodo",
] as const;

export function fatiasLiquidez(rows: readonly AcaoRow[]): Fatia[] {
  const c: Record<string, number> = {};
  for (const d of rows) if (d.liq) c[d.liq] = (c[d.liq] ?? 0) + 1;
  return ORDEM_LIQUIDEZ.filter((k) => c[k]).map((k) => ({
    k,
    label: ROTULO_LIQUIDEZ[k],
    n: c[k],
    color: LIQUIDEZ_COR[k],
  }));
}

export const semTicker = (rows: readonly AcaoRow[]): number =>
  rows.filter((d) => d.liq === "sem_ticker").length;

export function composicaoPorSegmento(rows: readonly AcaoRow[]) {
  const porSeg: Record<string, Record<string, number>> = {};
  for (const d of rows) {
    if (!d.liq || d.liq === "sem_ticker") continue;
    (porSeg[d.segmento] ??= {})[d.liq] = (porSeg[d.segmento]?.[d.liq] ?? 0) + 1;
  }
  return Object.keys(SEGMENTO_NOME)
    .filter((k) => porSeg[k])
    .map((k) => {
      const partes = ORDEM_LIQUIDEZ.filter((c) => porSeg[k][c]).map((c) => ({
        k: c,
        nome: ROTULO_LIQUIDEZ[c],
        n: porSeg[k][c],
        cor: LIQUIDEZ_COR[c],
      }));
      return { k, rotulo: SEGMENTO_NOME[k], total: partes.reduce((a, p) => a + p.n, 0), partes };
    });
}

// ------------------------------------------------------------------------------------------- tabela
export const COLUNAS_TEXTO_LIQUIDEZ = ["pregao", "tk", "liq", "crit", "ult"];

export function ordenarLiquidez(rows: readonly AcaoRow[], k: string, dir: 1 | -1): AcaoRow[] {
  const ag = (d: AcaoRow, j: "3m" | "6m" | "12m") => d.vol?.agregados[j];
  const val = (d: AcaoRow): string | number => {
    switch (k) {
      case "tk":
        return d.vol?.ticker_principal ?? d.tickers[0]?.ticker ?? "~";
      case "liq":
        return ORDEM_LIQUIDEZ.indexOf(d.liq as (typeof ORDEM_LIQUIDEZ)[number]);
      case "crit":
        return d.liquidez?.criterio_texto ?? "~";
      case "v3":
        return ag(d, "3m")?.volume ?? -1;
      case "v6":
        return ag(d, "6m")?.volume ?? -1;
      case "v12":
        return ag(d, "12m")?.volume ?? -1;
      case "p3":
        return ag(d, "3m")?.presenca ?? -1;
      case "p6":
        return ag(d, "6m")?.presenca ?? -1;
      case "p12":
        return ag(d, "12m")?.presenca ?? -1;
      case "t12":
        return ag(d, "12m")?.ticket_medio ?? -1;
      case "ult":
        return d.vol?.ultimo_pregao ?? "";
      default:
        return d.pregao;
    }
  };
  return [...rows].sort((a, b) => {
    const x = val(a);
    const y = val(b);
    const c =
      typeof x === "number" && typeof y === "number"
        ? x - y
        : String(x).localeCompare(String(y), "pt", { numeric: true });
    return c * dir || a.pregao.localeCompare(b.pregao, "pt");
  });
}

const decimal = (v: number | null | undefined): string => (v == null ? "" : String(v).replace(".", ","));

export function csvLiquidez(rows: readonly AcaoRow[]): string {
  const cab = [
    "Empresa",
    "Código CVM",
    "Ticker principal",
    "Categoria",
    "Critério",
    "Volume 3m (R$)",
    "Volume 6m (R$)",
    "Volume 12m (R$)",
    "Presença 3m",
    "Presença 6m",
    "Presença 12m",
    "Ticket médio 12m (R$)",
    "Negócios podem estar subestimados",
    "Último pregão",
  ];
  const linhas = rows.map((d) => {
    const a = d.vol?.agregados;
    return [
      d.pregao,
      d.codigo_cvm,
      d.vol?.ticker_principal ?? d.tickers[0]?.ticker ?? "",
      d.liq ? (ROTULO_LIQUIDEZ[d.liq] ?? d.liq) : "",
      d.liquidez?.criterio_texto ?? "",
      a?.["3m"].volume ?? "",
      a?.["6m"].volume ?? "",
      a?.["12m"].volume ?? "",
      decimal(a?.["3m"].presenca),
      decimal(a?.["6m"].presenca),
      decimal(a?.["12m"].presenca),
      decimal(a?.["12m"].ticket_medio),
      d.vol?.meses_negocios_suspeitos.length ? "sim" : "",
      d.vol?.ultimo_pregao ? formatDate(d.vol.ultimo_pregao) : "",
    ];
  });
  return montarCsv(cab, linhas);
}

export const NOME_ARQUIVO_CSV_LIQUIDEZ = "liquidez_acoes_b3.csv";
