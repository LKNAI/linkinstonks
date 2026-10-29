"use client";

// /acoes/tabela: paridade com seed/html/empresas_acoes_b3.html (filtros independentes, sem gráficos).
import { useMemo } from "react";
import { Alternador, Busca, Seletor } from "@/components/filters/Controles";
import { Carregando, ErroDados } from "@/components/layout/Pagina";
import { DataTable } from "@/components/table/DataTable";
import { NOME_ARQUIVO_CSV_ACOES, csvAcoes, derivar, ordenar, type AcaoRow, type Ordem } from "@/lib/acoes";
import { baixarCsv } from "@/lib/csv";
import { useDados } from "@/lib/data";
import { formatInt } from "@/lib/format";
import { HISTORICO, SEGMENTO_COR, SEGMENTO_NOME } from "@/lib/palette";
import { acoesDocSchema } from "@/lib/schemas";
import { useEstadoUrl, type Codec } from "@/lib/url-state";
import { colunasAcoes } from "./celulas-acoes";

interface FiltrosTabela {
  q: string;
  onlyT: boolean;
  bank: string;
  prev: string;
  hist: string;
  seg: string;
  sort: Ordem;
}

const PADRAO: FiltrosTabela = {
  q: "",
  onlyT: true,
  bank: "",
  prev: "",
  hist: "",
  seg: "",
  sort: { k: "pregao", dir: 1 },
};

export const codecTabela: Codec<FiltrosTabela> = {
  codificar(f) {
    const p: Record<string, string> = {};
    if (f.q) p.q = f.q;
    if (!f.onlyT) p.t = "0";
    for (const k of ["bank", "prev", "hist", "seg"] as const) if (f[k]) p[k] = f[k];
    if (f.sort.k !== PADRAO.sort.k || f.sort.dir !== PADRAO.sort.dir) p.ord = `${f.sort.k}:${f.sort.dir}`;
    return p;
  },
  decodificar(p) {
    const f: Partial<FiltrosTabela> = {};
    if (p.get("q")) f.q = p.get("q") as string;
    if (p.get("t") === "0") f.onlyT = false;
    for (const k of ["bank", "prev", "hist", "seg"] as const) if (p.get(k)) f[k] = p.get(k) as string;
    const ord = p.get("ord")?.split(":");
    if (ord?.length === 2 && (ord[1] === "1" || ord[1] === "-1"))
      f.sort = { k: ord[0], dir: ord[1] === "1" ? 1 : -1 };
    return f;
  },
};

const contar = (
  rows: readonly AcaoRow[],
  f: (d: AcaoRow) => string | null | undefined,
): [string, number][] => {
  const c: Record<string, number> = {};
  for (const d of rows) {
    const k = f(d);
    if (k) c[k] = (c[k] ?? 0) + 1;
  }
  return Object.entries(c).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt"));
};

const COLUNAS = colunasAcoes(true);

export function TabelaAcoes() {
  const d = useDados("acoes.json", acoesDocSchema);
  if (d.estado === "carregando") return <Carregando />;
  if (d.estado === "erro") return <ErroDados mensagem={d.mensagem} />;
  return <Conteudo acoes={d.dados.companhias} />;
}

function Conteudo({ acoes }: { acoes: Parameters<typeof derivar>[0] }) {
  const todas = useMemo(() => derivar(acoes), [acoes]);
  const [f, setF] = useEstadoUrl(PADRAO, codecTabela);
  const lista = useMemo(() => {
    const r = todas.filter(
      (d) =>
        (!f.onlyT || d.tickers.length) &&
        (!f.q || d.ix.includes(f.q)) &&
        (!f.bank || d.b === f.bank) &&
        (!f.prev || d.escriturador_cvm?.anterior === f.prev) &&
        (!f.hist || d.hist === f.hist) &&
        (!f.seg || d.segmento === f.seg),
    );
    return ordenar(r, f.sort);
  }, [todas, f]);

  const comCvm = todas.filter((d) => d.escriturador_cvm);
  const trocaram = comCvm.filter((d) => d.escriturador_cvm?.anterior).length;
  const tickers = todas.reduce((a, d) => a + d.tickers.length, 0);
  const stats: [number, string, string][] = [
    [todas.length, "empresas emissoras de ações", "#6250d6"],
    [todas.filter((d) => d.tickers.length).length, "com ticker de ações", "#0B3D91"],
    [tickers, "tickers no total", "#EC7000"],
    [comCvm.length, "com histórico na CVM", "#1baf7a"],
    [trocaram, "trocaram de escriturador desde 2010", "#CC092F"],
  ];
  const bancos = contar(todas, (d) => d.b);
  const anteriores = contar(todas, (d) => d.escriturador_cvm?.anterior);
  const segs = Object.keys(SEGMENTO_NOME)
    .map((k) => [k, todas.filter((d) => d.segmento === k).length] as const)
    .filter((x) => x[1]);

  return (
    <div className="dash">
      <div className="wrap" style={{ paddingTop: 28 }}>
        <span
          className="eyebrow"
          style={{ background: "var(--accent-soft)", color: "var(--accent-2)", borderColor: "var(--v2)" }}
        >
          <i />
          B3 + CVM · dados abertos
        </span>
        <h1
          style={{
            fontSize: "clamp(24px,3vw,34px)",
            fontWeight: 800,
            letterSpacing: "-.02em",
            margin: "12px 0 6px",
          }}
        >
          Empresas com ações registradas na B3
        </h1>
        <p style={{ color: "var(--ink-2)", maxWidth: 780, margin: 0 }}>
          Tickers, escriturador atual (B3) e rastreabilidade do escriturador — data de início e escriturador
          anterior — segundo o Formulário Cadastral entregue à CVM.
        </p>
        <div className="kpis" style={{ marginTop: 18, gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
          {stats.map(([v, l, c]) => (
            <div className="kpi" key={l} style={{ "--c": c } as React.CSSProperties}>
              <div className="val">{formatInt(v)}</div>
              <div className="sub">{l}</div>
            </div>
          ))}
        </div>

        <div className="filters">
          <div className="fbar">
            <Busca
              valor={f.q}
              onChange={(q) => setF((a) => ({ ...a, q }))}
              placeholder="Buscar empresa, ticker, CNPJ, setor ou escriturador…"
            />
            <Seletor
              rotulo="Escriturador atual"
              valor={f.bank}
              onChange={(bank) => setF((a) => ({ ...a, bank }))}
              opcoes={[
                { v: "", texto: "Todos os escrituradores" },
                ...bancos.map(([k, n]) => ({ v: k, texto: `${k} (${n})` })),
              ]}
            />
            <Seletor
              rotulo="Escriturador anterior"
              valor={f.prev}
              onChange={(prev) => setF((a) => ({ ...a, prev }))}
              opcoes={[
                { v: "", texto: "Qualquer escriturador anterior" },
                ...anteriores.map(([k, n]) => ({ v: k, texto: `${k} (${n})` })),
              ]}
            />
            <Seletor
              rotulo="Histórico"
              valor={f.hist}
              onChange={(hist) => setF((a) => ({ ...a, hist }))}
              opcoes={[{ v: "", texto: "Todo o histórico" }, ...HISTORICO.map((h) => ({ v: h, texto: h }))]}
            />
            <Seletor
              rotulo="Segmento"
              valor={f.seg}
              onChange={(seg) => setF((a) => ({ ...a, seg }))}
              opcoes={[
                { v: "", texto: "Todos os segmentos" },
                ...segs.map(([k, n]) => ({ v: k, texto: `${SEGMENTO_NOME[k]} (${n})` })),
              ]}
            />
            <Alternador ligado={f.onlyT} onChange={() => setF((a) => ({ ...a, onlyT: !a.onlyT }))}>
              Somente com ticker
            </Alternador>
            <span className="count" aria-live="polite">
              <b>{formatInt(lista.length)}</b> de {formatInt(todas.length)}
            </span>
            <button
              type="button"
              className="btn"
              onClick={() => baixarCsv(NOME_ARQUIVO_CSV_ACOES, csvAcoes(lista, true))}
            >
              Exportar CSV
            </button>
          </div>
        </div>

        <DataTable
          dados={lista}
          colunas={COLUNAS}
          chave={(r) => r.codigo_cvm}
          ordem={f.sort}
          onOrdenar={(id) =>
            setF((a) => ({ ...a, sort: { k: id, dir: a.sort.k === id ? (-a.sort.dir as 1 | -1) : 1 } }))
          }
          rotulo="Empresas com ações na B3"
          vazio="Nenhuma empresa corresponde aos filtros."
          larguraMinima={1380}
        />

        <div className="notes" role="note">
          <p>
            <b>Escriturador atual:</b> B3 · Empresas Listadas (<code>GetInitialCompanies</code> e{" "}
            <code>GetDetail</code>). Passe o mouse sobre o nome para ver o valor original da API.
          </p>
          <p>
            <b>Escriturador desde / anterior:</b> CVM · Formulário Cadastral (
            <code>fca_cia_aberta_escriturador</code>), campos <code>Data_Inicio_Atuacao</code> e{" "}
            <code>Data_Fim_Atuacao</code>. Datas com “~” não foram informadas no FCA e indicam o primeiro
            formulário com aquele escriturador.
          </p>
          <p>
            <b>Selo “CVM indica…”:</b> o FCA mais recente aponta outro escriturador que a B3.{" "}
            {formatInt(todas.filter((d) => !d.escriturador_cvm).length)} empresas, em geral de balcão não
            organizado, não têm FCA com escriturador. As datas são as declaradas pelas companhias.
          </p>
        </div>
      </div>
    </div>
  );
}

export { SEGMENTO_COR };
