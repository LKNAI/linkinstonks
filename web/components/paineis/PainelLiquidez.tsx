"use client";

// /acoes/liquidez: a tabela de liquidez das companhias, com filtros e ordenação na URL e CSV da visão filtrada.
import Link from "next/link";
import { useMemo } from "react";
import { Alternador, Chips, Seletor } from "@/components/filters/Controles";
import { FiltrosSheet } from "@/components/filters/FiltrosSheet";
import { LinkNovaAba } from "@/components/layout/LinkNovaAba";
import { Carregando, ErroDados, PaginaComHero, type HeroProps } from "@/components/layout/Pagina";
import { Aprox, NotaSuspeitos } from "@/components/paineis/Avisos";
import type { ColunaSpec } from "@/components/table/DataTable";
import { DataTable } from "@/components/table/DataTableLazy";
import { derivar, type AcaoRow } from "@/lib/acoes";
import { baixarCsv } from "@/lib/csv";
import { useDados } from "@/lib/data";
import { formatBRL, formatDate, formatDinheiro, formatInt, rotuloMes } from "@/lib/format";
import {
  COLUNAS_TEXTO_LIQUIDEZ,
  csvLiquidez,
  suspeitoEm12Meses,
  NOME_ARQUIVO_CSV_LIQUIDEZ,
  ORDEM_LIQUIDEZ,
  ordenarLiquidez,
} from "@/lib/liquidez";
import { LIQUIDEZ_COR, SEGMENTO_NOME } from "@/lib/palette";
import { ROTULO_LIQUIDEZ } from "@/lib/rotulos-liquidez";
import { useEstadoUrl, type Codec } from "@/lib/url-state";

interface Filtros {
  liq: string | null;
  mkt: string | null;
  sec: string | null;
  bank: string | null;
  onlyT: boolean;
  k: string;
  dir: 1 | -1;
}

const PADRAO: Filtros = { liq: null, mkt: null, sec: null, bank: null, onlyT: true, k: "v12", dir: -1 };
const DIMS = ["liq", "mkt", "sec", "bank"] as const;
const ROTULO: Record<(typeof DIMS)[number], string> = {
  liq: "Categoria",
  mkt: "Segmento",
  sec: "Setor",
  bank: "Escriturador",
};

const codec: Codec<Filtros> = {
  codificar(f) {
    const p: Record<string, string> = {};
    for (const k of DIMS) if (f[k]) p[k] = f[k] as string;
    if (!f.onlyT) p.t = "0";
    if (f.k !== PADRAO.k || f.dir !== PADRAO.dir) p.ord = `${f.k}:${f.dir}`;
    return p;
  },
  decodificar(p) {
    const f: Partial<Filtros> = {};
    for (const k of DIMS) if (p.get(k)) f[k] = p.get(k);
    if (p.get("t") === "0") f.onlyT = false;
    const ord = p.get("ord")?.split(":");
    if (ord?.length === 2 && (ord[1] === "1" || ord[1] === "-1")) {
      f.k = ord[0];
      f.dir = ord[1] === "1" ? 1 : -1;
    }
    return f;
  },
};

const HERO: HeroProps = {
  selo: "B3 + CVM · dados abertos",
  titulo: "Liquidez das ações",
  texto:
    "Volume, presença e ticket médio de cada companhia em 3, 6 e 12 meses, com o critério de cada categoria. A presença é a parte dos pregões em que o ticker mais negociado teve negócio.",
};

const pct = (p: number | null | undefined) =>
  p == null ? "—" : `${(p * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;
const din = (v: number | null | undefined) => (v == null ? "—" : formatDinheiro(v));

const colunas = (meses: readonly string[]): ColunaSpec<AcaoRow>[] => [
  {
    id: "pregao",
    titulo: "Empresa",
    fixa: true,
    celula: (d) => (
      <div className="co">
        <b>
          <LinkNovaAba href={`/acoes/${d.codigo_cvm}/`}>{d.pregao}</LinkNovaAba>
        </b>
        <div>{SEGMENTO_NOME[d.segmento] ?? d.segmento}</div>
      </div>
    ),
  },
  {
    id: "tk",
    titulo: "Ticker",
    classeTd: () => "mono",
    celula: (d) => d.vol?.ticker_principal ?? d.tickers[0]?.ticker ?? <span className="muted">—</span>,
  },
  {
    id: "liq",
    titulo: "Categoria",
    celula: (d) =>
      d.liq ? (
        <span className="dep">
          <i style={{ background: LIQUIDEZ_COR[d.liq] }} />
          {ROTULO_LIQUIDEZ[d.liq]}
        </span>
      ) : (
        <span className="muted">—</span>
      ),
  },
  {
    id: "crit",
    titulo: "Critério",
    classeTd: () => "crit",
    celula: (d) => d.liquidez?.criterio_texto ?? "—",
  },
  ...(["3m", "6m", "12m"] as const).map<ColunaSpec<AcaoRow>>((j) => ({
    id: `v${j.replace("m", "")}`,
    titulo: `Volume ${j}`,
    classeTh: "r",
    classeTd: () => "r num",
    celula: (d) => din(d.vol?.agregados[j].volume),
  })),
  ...(["3m", "6m", "12m"] as const).map<ColunaSpec<AcaoRow>>((j) => ({
    id: `p${j.replace("m", "")}`,
    titulo: `Presença ${j}`,
    classeTh: "r",
    classeTd: () => "r num",
    celula: (d) => pct(d.vol?.agregados[j].presenca),
  })),
  {
    id: "t12",
    titulo: "Ticket médio 12m",
    classeTh: "r",
    classeTd: () => "r num",
    celula: (d) => {
      const t = d.vol?.agregados["12m"].ticket_medio;
      if (t == null) return "—";
      return (
        <>
          <Aprox ativo={suspeitoEm12Meses(d, meses)} />
          {formatBRL(t)}
        </>
      );
    },
  },
  {
    id: "ult",
    titulo: "Último pregão",
    classeTd: () => "num",
    celula: (d) =>
      d.vol?.ultimo_pregao ? formatDate(d.vol.ultimo_pregao) : <span className="muted">—</span>,
  },
];

export function PainelLiquidez() {
  const a = useDados("acoes.json");
  const r = useDados("acoes_liquidez_resumo.json");
  if (a.estado === "erro") return <ErroDados mensagem={a.mensagem} />;
  if (r.estado === "erro") return <ErroDados mensagem={r.mensagem} />;
  return (
    <PaginaComHero hero={HERO}>
      {a.estado === "ok" && r.estado === "ok" ? (
        <Conteudo acoes={a.dados.companhias} resumo={r.dados} />
      ) : (
        <Carregando comHero />
      )}
    </PaginaComHero>
  );
}

function contar(rows: readonly AcaoRow[], campo: "sec" | "b"): { v: string; texto: string }[] {
  const c: Record<string, number> = {};
  for (const d of rows) c[d[campo]] = (c[d[campo]] ?? 0) + 1;
  return Object.entries(c)
    .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], "pt"))
    .map(([v, n]) => ({ v, texto: `${v} (${n})` }));
}

function Conteudo({
  acoes,
  resumo,
}: {
  acoes: Parameters<typeof derivar>[0];
  resumo: { meses: string[]; companhias: Parameters<typeof derivar>[1] };
}) {
  const todas = useMemo(() => derivar(acoes, resumo.companhias), [acoes, resumo]);
  const [f, setF] = useEstadoUrl(PADRAO, codec);
  const base = todas.filter(
    (d) =>
      (!f.onlyT || d.tickers.length > 0) &&
      (!f.liq || d.liq === f.liq) &&
      (!f.mkt || d.segmento === f.mkt) &&
      (!f.sec || d.sec === f.sec) &&
      (!f.bank || d.b === f.bank),
  );
  const ordenadas = useMemo(() => ordenarLiquidez(base, f.k, f.dir), [base, f.k, f.dir]);
  const chips = DIMS.filter((k) => f[k]).map((k) => ({
    id: k,
    rotulo: ROTULO[k],
    valor:
      k === "liq"
        ? (ROTULO_LIQUIDEZ[f.liq as string] ?? (f.liq as string))
        : k === "mkt"
          ? (SEGMENTO_NOME[f.mkt as string] ?? (f.mkt as string))
          : (f[k] as string),
    onRemover: () => setF((a) => ({ ...a, [k]: null })),
  }));
  const ult = resumo.meses[resumo.meses.length - 1];
  const tabela = useMemo(() => colunas(resumo.meses), [resumo.meses]);
  return (
    <div className="wrap">
      <div className="filters">
        <div className="fbar">
          <FiltrosSheet ativos={chips.length + (f.onlyT ? 0 : 1)}>
            <Alternador ligado={f.onlyT} onChange={() => setF((a) => ({ ...a, onlyT: !a.onlyT }))}>
              Somente com ticker
            </Alternador>
            <Seletor
              rotulo="Categoria"
              valor={f.liq ?? ""}
              onChange={(v) => setF((a) => ({ ...a, liq: v || null }))}
              opcoes={[
                { v: "", texto: "Todas as categorias" },
                ...[...ORDEM_LIQUIDEZ, "sem_ticker"].map((v) => ({ v, texto: ROTULO_LIQUIDEZ[v] })),
              ]}
            />
            <Seletor
              rotulo="Segmento"
              valor={f.mkt ?? ""}
              onChange={(v) => setF((a) => ({ ...a, mkt: v || null }))}
              opcoes={[
                { v: "", texto: "Todos os segmentos" },
                ...Object.entries(SEGMENTO_NOME).map(([v, texto]) => ({ v, texto })),
              ]}
            />
            <Seletor
              rotulo="Setor"
              valor={f.sec ?? ""}
              onChange={(v) => setF((a) => ({ ...a, sec: v || null }))}
              opcoes={[{ v: "", texto: "Todos os setores" }, ...contar(todas, "sec")]}
            />
            <Seletor
              rotulo="Escriturador"
              valor={f.bank ?? ""}
              onChange={(v) => setF((a) => ({ ...a, bank: v || null }))}
              opcoes={[{ v: "", texto: "Todos os escrituradores" }, ...contar(todas, "b")]}
            />
          </FiltrosSheet>
          <Chips
            chips={chips}
            mostrarLimpar={chips.length > 0}
            onLimpar={() => setF((a) => ({ ...a, liq: null, mkt: null, sec: null, bank: null }))}
          />
        </div>
      </div>
      <div className="grid">
        <section className="card c12" aria-label="Liquidez das companhias">
          <div className="tbl-head">
            <div>
              <h2>Companhias</h2>
              <p className="desc" style={{ marginBottom: 0 }}>
                Janelas de meses fechados, até {rotuloMes(ult)} · clique no cabeçalho para ordenar
              </p>
            </div>
            <div className="tbl-tools">
              <span className="count" aria-live="polite">
                <b>{formatInt(ordenadas.length)}</b> de {formatInt(todas.length)} empresas
              </span>
              <button
                type="button"
                className="btn"
                onClick={() => baixarCsv(NOME_ARQUIVO_CSV_LIQUIDEZ, csvLiquidez(ordenadas, resumo.meses))}
              >
                Exportar CSV
              </button>
            </div>
          </div>
          <DataTable
            dados={ordenadas}
            colunas={tabela}
            chave={(d) => d.codigo_cvm}
            ordem={{ k: f.k, dir: f.dir }}
            onOrdenar={(id) =>
              setF((a) => ({
                ...a,
                k: id,
                dir: a.k === id ? (-a.dir as 1 | -1) : COLUNAS_TEXTO_LIQUIDEZ.includes(id) ? 1 : -1,
              }))
            }
            rotulo="Liquidez das companhias"
            vazio="Nenhuma empresa corresponde aos filtros."
            larguraMinima={1820}
          />
          <NotaSuspeitos />
        </section>
      </div>
      <div className="notes" role="note">
        <p>
          <b>Fonte:</b> B3 · Séries históricas de cotações (<code>COTAHIST</code>), mercados à vista e
          fracionário. As definições estão na{" "}
          <Link prefetch={false} href="/sobre/#metodologia-liquidez" className="fonte-link">
            metodologia
          </Link>
          . Dados abertos:{" "}
          <a href="/data/downloads/acoes_liquidez.csv" download className="fonte-link">
            acoes_liquidez.csv
          </a>
          .
        </p>
      </div>
    </div>
  );
}
