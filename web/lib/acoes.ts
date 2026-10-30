// Lógica do painel de ações, portada de seed/etl/acoes/dash2_template.html como funções puras (testáveis).
import { COR_NEUTRA, coresDoConjunto, corEscriturador } from "@/lib/colors";
import { montarCsv } from "@/lib/csv";
import { formatDate, formatInt, formatPct } from "@/lib/format";
import { HISTORICO, HISTORICO_COR, SEGMENTO_COR, SEGMENTO_NOME, type Historico } from "@/lib/palette";
import { CLASSES } from "@/lib/constantes";
import type { Acao } from "@/lib/schemas";

export const SEM_INFORMACAO = "Não informado";
export const ANO_INICIAL = 2010;

export interface AcaoRow extends Acao {
  /** Escriturador das ações ON segundo a B3 (ou PN, ou "Não informado"). */
  b: string;
  sec: string;
  cls: string[];
  hist: Historico;
  /** Ano da troca (só trocas com data real). Antes de 2010 vira "2010" (barra "≤10"). */
  yr: string | null;
  inE: string | null;
  outE: string | null;
  since: string;
  ix: string;
}

export const normalizar = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function derivar(acoes: readonly Acao[]): AcaoRow[] {
  return acoes.map((d) => {
    const b3 = d.escriturador_b3;
    const f = d.escriturador_cvm;
    const b = b3.on ?? b3.pn ?? SEM_INFORMACAO;
    const hist: Historico = !f
      ? "Sem dados na CVM"
      : f.anterior
        ? "Trocou de escriturador"
        : "Sem troca registrada";
    const yr =
      f && f.anterior && !f.inicio_aproximado && f.inicio
        ? f.inicio.slice(0, 4) < String(ANO_INICIAL)
          ? String(ANO_INICIAL)
          : f.inicio.slice(0, 4)
        : null;
    return {
      ...d,
      b,
      sec: /^n[aã]o classificad/i.test(d.setor) ? "Não classificado" : d.setor,
      cls: [...new Set(d.tickers.map((t) => t.classe))],
      hist,
      yr,
      inE: f?.anterior ? f.atual : null,
      outE: f?.anterior ? f.anterior : null,
      since: f?.inicio ?? "",
      ix: normalizar(
        [
          d.pregao,
          d.razao_social,
          d.emissor,
          d.tickers.map((t) => t.ticker).join(" "),
          d.cnpj,
          d.cnpj.replace(/\D/g, ""),
          d.setor,
          b,
          b3.pn ?? "",
          b3.bruto_on,
          b3.bruto_pn,
          SEGMENTO_NOME[d.segmento] ?? "",
          f ? `${f.atual} ${f.anterior ?? ""}` : "",
        ].join(" "),
      ),
    };
  });
}

// ------------------------------------------------------------------------------------------- filtros
export const DIMS = ["bank", "mkt", "cls", "sec", "hist", "yr", "inE", "outE"] as const;
export type Dim = (typeof DIMS)[number];
export const ROTULO_DIM: Record<Dim, string> = {
  bank: "Escriturador",
  mkt: "Segmento",
  cls: "Classe",
  sec: "Setor",
  hist: "Histórico",
  yr: "Troca em",
  inE: "Conquistou",
  outE: "Perdeu",
};

export interface Ordem {
  k: string;
  dir: 1 | -1;
}

export interface FiltrosAcoes extends Record<Dim, string | null> {
  q: string;
  onlyT: boolean;
  sort: Ordem;
}

export const FILTROS_PADRAO: FiltrosAcoes = {
  q: "",
  onlyT: true,
  bank: null,
  mkt: null,
  cls: null,
  sec: null,
  hist: null,
  yr: null,
  inE: null,
  outE: null,
  sort: { k: "pregao", dir: 1 },
};

const valorDim = (d: AcaoRow, k: Dim): string | string[] | null =>
  ({ bank: d.b, mkt: d.segmento, cls: d.cls, sec: d.sec, hist: d.hist, yr: d.yr, inE: d.inE, outE: d.outE })[
    k
  ];

/** Cada gráfico recalcula com todos os filtros EXCETO o seu próprio (`exceto`), como no seed. */
export function passa(d: AcaoRow, f: FiltrosAcoes, exceto?: Dim | readonly Dim[]): boolean {
  if (f.onlyT && !d.tickers.length) return false;
  if (f.q && !d.ix.includes(f.q)) return false;
  const ignorar = exceto === undefined ? [] : Array.isArray(exceto) ? exceto : [exceto];
  for (const k of DIMS) {
    const alvo = f[k];
    if (ignorar.includes(k) || alvo == null) continue;
    const v = valorDim(d, k);
    if (Array.isArray(v) ? !v.includes(alvo) : v !== alvo) return false;
  }
  return true;
}

export const filtrar = (
  rows: readonly AcaoRow[],
  f: FiltrosAcoes,
  exceto?: Dim | readonly Dim[],
): AcaoRow[] => rows.filter((d) => passa(d, f, exceto));

export const temFiltro = (f: FiltrosAcoes): boolean => !!f.q || DIMS.some((k) => f[k] != null);

// ------------------------------------------------------------------------------------------- agregações
export interface Fatia {
  k: string;
  label: string;
  n: number;
  color: string;
  extra?: [string, string][];
}

export function fatiasPorBanco(rows: readonly AcaoRow[]): Fatia[] {
  const c: Record<string, number> = {};
  const tk: Record<string, number> = {};
  for (const d of rows) {
    c[d.b] = (c[d.b] ?? 0) + 1;
    tk[d.b] = (tk[d.b] ?? 0) + d.tickers.length;
  }
  const cor = coresDoConjunto(Object.keys(c));
  return Object.keys(c)
    .sort((a, b) => c[b] - c[a] || a.localeCompare(b, "pt"))
    .map((k) => ({
      k,
      label: k,
      n: c[k],
      color: cor(k),
      extra: [["Tickers", formatInt(tk[k])]],
    }));
}

export function fatiasPorSegmento(rows: readonly AcaoRow[]): Fatia[] {
  const c: Record<string, number> = {};
  for (const d of rows) c[d.segmento] = (c[d.segmento] ?? 0) + 1;
  return Object.keys(SEGMENTO_NOME)
    .filter((k) => c[k])
    .map((k) => ({ k, label: SEGMENTO_NOME[k], n: c[k], color: SEGMENTO_COR[k] }));
}

export function fatiasPorHistorico(rows: readonly AcaoRow[]): Fatia[] {
  const c: Record<string, number> = {};
  for (const d of rows) c[d.hist] = (c[d.hist] ?? 0) + 1;
  return HISTORICO.filter((k) => c[k]).map((k) => ({ k, label: k, n: c[k], color: HISTORICO_COR[k] }));
}

export interface Kpi {
  rotulo: string;
  valor: string;
  sub: string;
  cor: string;
  /** 0..1, para a barra de proporção. */
  p?: number;
}

export function kpisAcoes(rows: readonly AcaoRow[], total: number, anoRef: number): Kpi[] {
  const comTicker = rows.filter((d) => d.tickers.length).length;
  const tickers = rows.reduce((a, d) => a + d.tickers.length, 0);
  const cvm = rows.filter((d) => d.escriturador_cvm);
  const trocaram = cvm.filter((d) => d.escriturador_cvm?.anterior).length;
  const anoRecente = String(anoRef - 3);
  const recentes = rows.filter((d) => d.yr && d.yr >= anoRecente).length;
  const bc: Record<string, number> = {};
  for (const d of rows) bc[d.b] = (bc[d.b] ?? 0) + 1;
  const lider = Object.entries(bc).sort((a, b) => b[1] - a[1])[0];
  const n = rows.length;
  return [
    {
      rotulo: "Empresas no filtro",
      valor: formatInt(n),
      sub: `de ${formatInt(total)} emissoras de ações`,
      cor: "var(--accent)",
      p: total ? n / total : 0,
    },
    {
      rotulo: "Negociadas (com ticker)",
      valor: formatInt(comTicker),
      sub: `${formatInt(tickers)} tickers de ações`,
      cor: "var(--accent)",
      p: n ? comTicker / n : 0,
    },
    {
      rotulo: "Com histórico na CVM",
      valor: formatInt(cvm.length),
      sub: `${formatPct(cvm.length, n)} das empresas filtradas`,
      cor: "var(--accent)",
      p: n ? cvm.length / n : 0,
    },
    {
      rotulo: "Trocaram de escriturador",
      valor: formatPct(trocaram, cvm.length),
      sub: `${formatInt(trocaram)} empresas desde ${ANO_INICIAL}`,
      cor: "var(--accent)",
      p: cvm.length ? trocaram / cvm.length : 0,
    },
    {
      rotulo: `Trocas desde ${anoRecente}`,
      valor: formatInt(recentes),
      sub: `escriturador atual assumiu em ${anoRecente}+`,
      cor: "var(--accent)",
    },
    {
      rotulo: "Maior escriturador",
      valor: lider ? formatPct(lider[1], n) : "—",
      sub: lider ? `${lider[0]} · ${formatInt(lider[1])}` : "sem dados",
      cor: lider ? corEscriturador(lider[0]) : COR_NEUTRA,
      p: lider && n ? lider[1] / n : 0,
    },
  ];
}

export interface TrocasPorAno {
  anos: string[];
  porAno: Record<string, Record<string, number>>;
  entidades: string[];
  anteDe2010: boolean;
  total: number;
}

export function trocasPorAno(
  rowsSemAno: readonly AcaoRow[],
  anoRef: number,
  ordem: readonly string[],
): TrocasPorAno {
  const r = rowsSemAno.filter((d) => d.yr);
  const anos: string[] = [];
  for (let y = ANO_INICIAL; y <= anoRef; y++) anos.push(String(y));
  const porAno: Record<string, Record<string, number>> = Object.fromEntries(anos.map((y) => [y, {}]));
  for (const d of r) {
    const novo = d.escriturador_cvm?.atual ?? "";
    const y = d.yr as string;
    if (porAno[y]) porAno[y][novo] = (porAno[y][novo] ?? 0) + 1;
  }
  const entidades = [...new Set(r.map((d) => d.escriturador_cvm?.atual ?? ""))].sort(
    (a, b) => ordem.indexOf(a) - ordem.indexOf(b),
  );
  return {
    anos,
    porAno,
    entidades,
    anteDe2010: r.some((d) => (d.escriturador_cvm?.inicio ?? "") < String(ANO_INICIAL)),
    total: r.length,
  };
}

export interface LinhaSaldo {
  entidade: string;
  ganhou: number;
  perdeu: number;
}

export function saldoDeTrocas(rowsSemTrocas: readonly AcaoRow[]): LinhaSaldo[] {
  const g: Record<string, number> = {};
  const l: Record<string, number> = {};
  for (const d of rowsSemTrocas) {
    const f = d.escriturador_cvm;
    if (!f?.anterior) continue;
    g[f.atual] = (g[f.atual] ?? 0) + 1;
    l[f.anterior] = (l[f.anterior] ?? 0) + 1;
  }
  const ents = [...new Set([...Object.keys(g), ...Object.keys(l)])];
  return ents
    .map((entidade) => ({ entidade, ganhou: g[entidade] ?? 0, perdeu: l[entidade] ?? 0 }))
    .sort(
      (a, b) => b.ganhou - b.perdeu - (a.ganhou - a.perdeu) || a.entidade.localeCompare(b.entidade, "pt"),
    );
}

export function topSetores(
  rowsSemSetor: readonly AcaoRow[],
  selecionado: string | null,
  n = 10,
): { k: string; n: number }[] {
  const c: Record<string, number> = {};
  for (const d of rowsSemSetor) c[d.sec] = (c[d.sec] ?? 0) + 1;
  const itens = Object.entries(c)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt"))
    .slice(0, n)
    .map(([k, q]) => ({ k, n: q }));
  if (selecionado && !itens.find((i) => i.k === selecionado) && c[selecionado])
    itens.push({ k: selecionado, n: c[selecionado] });
  return itens;
}

export function tickersPorClasse(
  rowsSemClasse: readonly AcaoRow[],
  selecionada: string | null,
): { k: string; n: number }[] {
  const c: Record<string, number> = Object.fromEntries(CLASSES.map((k) => [k, 0]));
  for (const d of rowsSemClasse) for (const t of d.tickers) c[t.classe]++;
  return CLASSES.filter((k) => c[k] || selecionada === k).map((k) => ({ k, n: c[k] }));
}

/** Instituições na ordem do seed: marcas conhecidas e demais, da que tem mais empresas para a que tem menos. */
export function ordemDasInstituicoes(todas: readonly AcaoRow[], conhecidas: readonly string[]): string[] {
  const rank: Record<string, number> = {};
  for (const d of todas) rank[d.b] = (rank[d.b] ?? 0) + 1;
  return [...new Set([...conhecidas, ...Object.keys(rank)])].sort((a, b) => (rank[b] ?? 0) - (rank[a] ?? 0));
}

// ------------------------------------------------------------------------------------------- tabela
export function ordenar(rows: readonly AcaoRow[], { k, dir }: Ordem): AcaoRow[] {
  const val = (d: AcaoRow): string | number => {
    switch (k) {
      case "tickers":
        return d.tickers[0]?.ticker ?? "~";
      case "segmento":
        return Object.keys(SEGMENTO_NOME).indexOf(d.segmento);
      case "since":
        return d.since || "9999";
      case "prev":
        return d.escriturador_cvm?.anterior || "~";
      case "b":
        return d.b || "~";
      case "setor":
        return d.setor || "~";
      case "cnpj":
        return d.cnpj || "~";
      case "codigo_cvm":
        return d.codigo_cvm || "~";
      default:
        return d.pregao || "~";
    }
  };
  return [...rows].sort((a, b) => {
    const x = val(a);
    const y = val(b);
    const c =
      typeof x === "number" && typeof y === "number"
        ? x - y
        : String(x).localeCompare(String(y), "pt", { numeric: true });
    return c * dir;
  });
}

export function textoDesde(d: AcaoRow): {
  tipo: "sem-cvm" | "nao-informada" | "aprox" | "data";
  texto: string;
} {
  const f = d.escriturador_cvm;
  if (!f) return { tipo: "sem-cvm", texto: "Sem dados na CVM" };
  if (!f.inicio) return { tipo: "nao-informada", texto: "Não informada" };
  return f.inicio_aproximado
    ? { tipo: "aprox", texto: `~${formatDate(f.inicio).slice(3)}` }
    : { tipo: "data", texto: formatDate(f.inicio) };
}

export function detalheAnterior(d: AcaoRow): { nome: string; quando: string; muitos: string } | null {
  const f = d.escriturador_cvm;
  if (!f?.anterior) return null;
  const quando = f.anterior_fim
    ? `até ${formatDate(f.anterior_fim)}`
    : `consta até o FCA de ${f.anterior_ultimo_ano}`;
  const de = f.anterior_inicio ? `desde ${formatDate(f.anterior_inicio)} · ` : "";
  return {
    nome: f.anterior,
    quando: de + quando,
    muitos: f.n_escrituradores > 2 ? `${f.n_escrituradores} escrituradores desde ${ANO_INICIAL}` : "",
  };
}

const CSV_ACOES = [
  "Empresa",
  "Razão social",
  "Código",
  "CNPJ",
  "Tickers",
  "Segmento",
  "Setor",
  "Escriturador atual (B3)",
  "Escriturador ON (B3, original)",
  "Escriturador PN (B3, original)",
  "Escriturador no FCA (CVM)",
  "Escriturador desde (CVM)",
  "Data aproximada",
  "Escriturador anterior (CVM)",
  "Anterior desde",
  "Anterior até",
  "Anterior consta até FCA de",
  "Nº escrituradores desde 2010",
] as const; // fmt: skip

/** CSV da visão filtrada e ordenada. `comCodigoCvm` acrescenta a coluna "Código CVM" (tabela completa). */
export function csvAcoes(rows: readonly AcaoRow[], comCodigoCvm: boolean): string {
  const cab: string[] = [...CSV_ACOES];
  if (comCodigoCvm) cab.splice(4, 0, "Código CVM");
  const linhas = rows.map((d) => {
    const f = d.escriturador_cvm;
    const l: unknown[] = [
      d.pregao,
      d.razao_social,
      d.emissor,
      d.cnpj,
      d.tickers.map((t) => t.ticker).join(" "),
      SEGMENTO_NOME[d.segmento] ?? d.segmento,
      d.setor,
      d.b,
      d.escriturador_b3.bruto_on,
      d.escriturador_b3.bruto_pn,
      f?.atual ?? "",
      f ? formatDate(f.inicio) : "",
      f?.inicio_aproximado ? "sim" : "",
      f?.anterior ?? "",
      f ? formatDate(f.anterior_inicio ?? "") : "",
      f ? formatDate(f.anterior_fim ?? "") : "",
      f?.anterior ? (f.anterior_ultimo_ano ?? "") : "",
      f?.n_escrituradores ?? "",
    ]; // fmt: skip
    if (comCodigoCvm) l.splice(4, 0, d.codigo_cvm);
    return l;
  });
  return montarCsv(cab, linhas);
}

export const NOME_ARQUIVO_CSV_ACOES = "escrituradores_b3_cvm.csv";
