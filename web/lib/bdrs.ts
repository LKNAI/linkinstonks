// Lógica do painel de BDRs, portada de seed/etl/bdrs/template.html como funções puras (testáveis).
// Diferença deliberada: volumes chegam em R$ (o seed usava R$ mil) e os 24 meses vêm de `doc.meses`.
import { COR_NEUTRA, corDepositaria } from "@/lib/colors";
import { montarCsv } from "@/lib/csv";
import { formatDinheiro, formatInt, formatPct, rotuloMes, variacao, type Variacao } from "@/lib/format";
import {
  CAT_COR,
  CATEGORIA_COR,
  CATEGORIA_SEM,
  DEPOSITARIAS,
  TIPO_GRUPO_COR,
  TIPO_GRUPO_NOME,
  grupoDoTipo,
  type TipoGrupo,
} from "@/lib/palette";
import type { Bdr } from "@/lib/schemas";
import { normalizar, type Fatia, type Kpi, type Ordem } from "@/lib/acoes";

export interface BdrRow extends Bdr {
  T: TipoGrupo;
  tot: number;
  /** Volume dos últimos 12 meses e dos 12 anteriores. */
  y1: number;
  y0: number;
  /** Negociado no último mês fechado. */
  on: boolean;
  C: string | null;
  ix: string;
}

export function derivarBdrs(bdrs: readonly Bdr[]): BdrRow[] {
  return bdrs.map((d) => {
    const v = d.volume_mensal;
    const T = grupoDoTipo(d.tipo);
    return {
      ...d,
      T,
      tot: d.volume_24m,
      y1: v.slice(12).reduce((a, b) => a + b, 0),
      y0: v.slice(0, 12).reduce((a, b) => a + b, 0),
      on: (v[v.length - 1] ?? 0) > 0,
      C: T === "DRE" ? d.categoria || CATEGORIA_SEM : null,
      ix: normalizar(`${d.ticker} ${d.nome} ${d.isin} ${d.depositaria} ${TIPO_GRUPO_NOME[T]} ${d.tipo}`),
    };
  });
}

// ------------------------------------------------------------------------------------------- filtros
export const DIMS_BDR = ["dep", "type", "cat"] as const;
export type DimBdr = (typeof DIMS_BDR)[number];
export const ROTULO_DIM_BDR: Record<DimBdr, string> = {
  dep: "Depositária",
  type: "Tipo",
  cat: "Classe do ETF",
};

export type Situacao = "all" | "on" | "off";

export interface FiltrosBdrs {
  q: string;
  st: Situacao;
  dep: string | null;
  type: string | null;
  cat: string | null;
  /** Índice (0-based) do mês escolhido para o ranking; `null` = 24 meses. */
  month: number | null;
  sort: Ordem;
  showM: boolean;
}

export const FILTROS_BDR_PADRAO: FiltrosBdrs = {
  q: "",
  st: "all",
  dep: null,
  type: null,
  cat: null,
  month: null,
  sort: { k: "tot", dir: -1 },
  showM: false,
};

const valorDim = (d: BdrRow, k: DimBdr): string | null => ({ dep: d.depositaria, type: d.T, cat: d.C })[k];

export function passaBdr(d: BdrRow, f: FiltrosBdrs, exceto?: DimBdr): boolean {
  if (f.st === "on" && !d.on) return false;
  if (f.st === "off" && d.on) return false;
  if (f.q && !d.ix.includes(f.q)) return false;
  for (const k of DIMS_BDR) {
    if (k === exceto || f[k] == null) continue;
    if (valorDim(d, k) !== f[k]) return false;
  }
  return true;
}

export const filtrarBdrs = (rows: readonly BdrRow[], f: FiltrosBdrs, exceto?: DimBdr): BdrRow[] =>
  rows.filter((d) => passaBdr(d, f, exceto));

export const temFiltroBdr = (f: FiltrosBdrs): boolean =>
  !!f.q || f.st !== "all" || f.month != null || DIMS_BDR.some((k) => f[k] != null);

/** Volume que vale para o ranking: o do mês escolhido ou o acumulado de 24 meses. */
export const volumeDe = (d: BdrRow, f: FiltrosBdrs): number =>
  f.month == null ? d.tot : (d.volume_mensal[f.month] ?? 0);

// ------------------------------------------------------------------------------------------- agregações
export function kpisBdrs(
  rows: readonly BdrRow[],
  meses: readonly string[],
): { kpis: Kpi[]; ultimoMes: Variacao; anos: Variacao } {
  const ult = meses.length - 1;
  const total = rows.reduce((a, d) => a + d.tot, 0);
  const mesAtual = rows.reduce((a, d) => a + (d.volume_mensal[ult] ?? 0), 0);
  const mesAno = rows.reduce((a, d) => a + (d.volume_mensal[ult - 12] ?? 0), 0);
  const y1 = rows.reduce((a, d) => a + d.y1, 0);
  const y0 = rows.reduce((a, d) => a + d.y0, 0);
  const ativos = rows.filter((d) => d.on).length;
  const dv: Record<string, number> = {};
  for (const d of rows) dv[d.depositaria] = (dv[d.depositaria] ?? 0) + d.tot;
  const lider = Object.entries(dv).sort((a, b) => b[1] - a[1])[0];
  const topo = [...rows].sort((a, b) => b.tot - a.tot)[0];
  const rot = rotuloMes(meses[ult] ?? "");
  const vMes = variacao(mesAtual, mesAno);
  const vAnos = variacao(y1, y0);
  return {
    ultimoMes: vMes,
    anos: vAnos,
    kpis: [
      {
        rotulo: "BDRs no filtro",
        valor: formatInt(rows.length),
        sub: `${formatInt(ativos)} negociados em ${rot}`,
        cor: "var(--accent)",
      },
      {
        rotulo: "Volume em 24 meses",
        valor: formatDinheiro(total),
        sub: `média de ${formatDinheiro(total / (meses.length || 1))} por mês`,
        cor: "var(--accent)",
      },
      {
        rotulo: `Volume em ${rot}`,
        valor: formatDinheiro(mesAtual),
        sub: `${vMes.texto} vs ${rotuloMes(meses[ult - 12] ?? "")}`,
        cor: "var(--accent)",
      },
      {
        rotulo: "Últimos 12 × 12 anteriores",
        valor: vAnos.texto || "—",
        sub: `${formatDinheiro(y1)} vs ${formatDinheiro(y0)}`,
        cor: "var(--accent)",
      },
      {
        rotulo: "Maior depositária",
        valor: lider ? formatPct(lider[1], total) : "—",
        sub: lider ? `${lider[0]} · ${formatDinheiro(lider[1])}` : "",
        cor: lider ? corDepositaria(lider[0]) : COR_NEUTRA,
      },
      {
        rotulo: "BDR mais negociado",
        valor: topo?.ticker ?? "—",
        sub: topo ? `${topo.nome} · ${formatDinheiro(topo.tot)}` : "",
        cor: "var(--accent)",
      },
    ],
  };
}

export interface MesTotal {
  mes: string;
  total: number;
  porTipo: Record<TipoGrupo, number>;
}

export function totaisMensais(rows: readonly BdrRow[], meses: readonly string[]): MesTotal[] {
  const out: MesTotal[] = meses.map((mes) => ({ mes, total: 0, porTipo: { DRN: 0, DRE: 0, SPO: 0 } }));
  for (const d of rows)
    d.volume_mensal.forEach((v, i) => {
      if (out[i]) {
        out[i].porTipo[d.T] += v;
        out[i].total += v;
      }
    });
  return out;
}

/** Degrau "bonito" do eixo Y (em R$): 1, 2 ou 5 x 10^n, com no máximo 5 linhas de grade (como no seed). */
export function escalaEixo(max: number): { passo: number; topo: number } {
  const passos: number[] = [];
  for (let e = 1e6; e <= 1e10; e *= 10) passos.push(e, 2 * e, 5 * e);
  const passo = passos.find((s) => max / s <= 5) ?? 1e11;
  return { passo, topo: Math.max(passo, Math.ceil(max / passo) * passo) };
}

export function fatiasDepositaria(rowsSemDep: readonly BdrRow[]): Fatia[] {
  const v: Record<string, number> = {};
  const c: Record<string, number> = {};
  for (const d of rowsSemDep) {
    v[d.depositaria] = (v[d.depositaria] ?? 0) + d.tot;
    c[d.depositaria] = (c[d.depositaria] ?? 0) + 1;
  }
  const ordem = [
    ...DEPOSITARIAS,
    ...Object.keys(c).filter((k) => !(DEPOSITARIAS as readonly string[]).includes(k)),
  ];
  return ordem
    .filter((k) => c[k])
    .map((k) => ({ k, label: k, n: v[k], color: corDepositaria(k), extra: [["BDRs", formatInt(c[k])]] }));
}

export function fatiasTipo(rowsSemTipo: readonly BdrRow[]): Fatia[] {
  const c: Record<string, number> = {};
  const v: Record<string, number> = {};
  for (const d of rowsSemTipo) {
    c[d.T] = (c[d.T] ?? 0) + 1;
    v[d.T] = (v[d.T] ?? 0) + d.tot;
  }
  return (["DRN", "DRE", "SPO"] as const)
    .filter((k) => c[k])
    .map((k) => ({
      k,
      label: TIPO_GRUPO_NOME[k],
      n: c[k],
      color: TIPO_GRUPO_COR[k],
      extra: [["Volume 24m", formatDinheiro(v[k])]],
    }));
}

export function fatiasCategoria(rowsSemCat: readonly BdrRow[]): Fatia[] {
  const v: Record<string, number> = {};
  const c: Record<string, number> = {};
  for (const d of rowsSemCat) {
    if (d.T !== "DRE" || !d.C) continue;
    v[d.C] = (v[d.C] ?? 0) + d.tot;
    c[d.C] = (c[d.C] ?? 0) + 1;
  }
  const ordem = [
    ...Object.keys(CATEGORIA_COR).filter((k) => c[k]),
    ...Object.keys(c).filter((k) => !(k in CATEGORIA_COR)),
  ];
  return ordem.map((k) => ({
    k,
    label: k,
    n: v[k],
    color: CATEGORIA_COR[k] ?? COR_NEUTRA,
    extra: [["ETFs", formatInt(c[k])]],
  }));
}

export interface ItemRanking {
  d: BdrRow;
  volume: number;
  parte: number;
}

export function ranking(
  rows: readonly BdrRow[],
  f: FiltrosBdrs,
  n = 15,
): { itens: ItemRanking[]; total: number; todos: BdrRow[] } {
  const todos = rows
    .filter((d) => volumeDe(d, f) > 0)
    .sort((a, b) => volumeDe(b, f) - volumeDe(a, f) || a.ticker.localeCompare(b.ticker));
  const total = todos.reduce((a, d) => a + volumeDe(d, f), 0);
  return {
    itens: todos
      .slice(0, n)
      .map((d) => ({ d, volume: volumeDe(d, f), parte: total ? volumeDe(d, f) / total : 0 })),
    total,
    todos,
  };
}

export interface Concentracao {
  cortes: { n: number; cor: string; parte: number }[];
  precisam80: number;
  comVolume: number;
}

export function concentracao(todos: readonly BdrRow[], total: number, f: FiltrosBdrs): Concentracao {
  const cores: [number, string][] = [
    [1, CAT_COR[0]],
    [5, CAT_COR[1]],
    [10, CAT_COR[2]],
    [50, CAT_COR[3]],
  ]; // fmt: skip
  const parte = (n: number) =>
    total ? todos.slice(0, n).reduce((a, d) => a + volumeDe(d, f), 0) / total : 0;
  let acc = 0;
  let precisam = todos.length;
  for (let i = 0; i < todos.length; i++) {
    acc += volumeDe(todos[i], f);
    if (acc >= total * 0.8) {
      precisam = i + 1;
      break;
    }
  }
  return {
    cortes: cores.map(([n, cor]) => ({ n, cor, parte: parte(n) })),
    precisam80: precisam,
    comVolume: todos.length,
  };
}

// ------------------------------------------------------------------------------------------- tabela
export function ordenarBdrs(rows: readonly BdrRow[], { k, dir }: Ordem): BdrRow[] {
  const val = (d: BdrRow): string | number => {
    switch (k) {
      case "last":
        return d.volume_mensal[d.volume_mensal.length - 1] ?? 0;
      case "var":
        return d.y0 ? d.y1 / d.y0 : d.y1 ? 1e9 : -1;
      case "T":
        return TIPO_GRUPO_NOME[d.T];
      case "on":
        return d.on ? 1 : 0;
      case "t":
        return d.ticker;
      case "d":
        return d.depositaria;
      case "g":
        return d.negocios_24m;
      case "p":
        return d.ultimo_preco;
      case "f":
        return d.primeiro_pregao ?? "";
      case "l":
        return d.ultimo_pregao;
      case "i":
        return d.isin;
      case "tot":
        return d.tot;
      default:
        return k.startsWith("m") ? (d.volume_mensal[Number(k.slice(1))] ?? 0) : d.tot;
    }
  };
  return [...rows].sort((a, b) => {
    const x = val(a);
    const y = val(b);
    const c =
      typeof x === "number" && typeof y === "number"
        ? x - y
        : String(x).localeCompare(String(y), "pt", { numeric: true });
    return c * dir || a.ticker.localeCompare(b.ticker);
  });
}

/** Sentido inicial de cada coluna ao clicar: texto crescente, números decrescentes (como no seed). */
export const COLUNAS_TEXTO = ["t", "d", "T", "f", "i"];

export function csvBdrs(rows: readonly BdrRow[], meses: readonly string[]): string {
  const cab = [
    "Ticker",
    "Nome",
    "Tipo",
    "Programa",
    "Classe ETF",
    "Restrito a qualificados",
    "Instituição depositária",
    "Fonte da depositária",
    "ISIN",
    "Primeiro pregão no período",
    "Último pregão",
    "Último preço (R$)",
    "Negócios 24m",
    "Volume 24m (R$)",
    ...meses.map((m) => `Volume ${m} (R$)`),
  ]; // fmt: skip
  const linhas = rows.map((d) => [
    d.ticker,
    d.nome,
    d.tipo,
    TIPO_GRUPO_NOME[d.T],
    d.C ?? "",
    d.qualificado ? "sim" : "",
    d.depositaria,
    d.fonte_depositaria,
    d.isin,
    d.primeiro_pregao ?? "",
    d.ultimo_pregao,
    String(d.ultimo_preco).replace(".", ","),
    d.negocios_24m,
    d.tot,
    ...d.volume_mensal,
  ]); // fmt: skip
  return montarCsv(cab, linhas);
}

export const NOME_ARQUIVO_CSV_BDRS = "bdrs_b3_volume_mensal.csv";
