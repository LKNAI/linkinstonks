"use client";

// /acoes: paridade total com seed/html/dashboard_acoes_b3.html.
import { useMemo } from "react";
import { BarList } from "@/components/charts/BarList";
import { ChartCard } from "@/components/charts/ChartCard";
import { Colunas } from "@/components/charts/Colunas";
import { ColunasEmpilhadas } from "@/components/charts/ColunasEmpilhadas";
import { Divergentes } from "@/components/charts/Divergentes";
import { Donut } from "@/components/charts/Donut";
import { TipConteudo } from "@/components/charts/Tooltip";
import { Alternador, Busca, Chips } from "@/components/filters/Controles";
import { Carregando, ErroDados, Hero, KpiGrid } from "@/components/layout/Pagina";
import { DataTable } from "@/components/table/DataTableLazy";
import {
  DIMS,
  FILTROS_PADRAO,
  ROTULO_DIM,
  csvAcoes,
  derivar,
  fatiasPorBanco,
  fatiasPorHistorico,
  fatiasPorSegmento,
  filtrar,
  kpisAcoes,
  NOME_ARQUIVO_CSV_ACOES,
  ordemDasInstituicoes,
  ordenar,
  saldoDeTrocas,
  temFiltro,
  tickersPorClasse,
  topSetores,
  trocasPorAno,
  type Dim,
  type FiltrosAcoes,
} from "@/lib/acoes"; // fmt: skip
import { COR_ESCRITURADOR, corEscriturador } from "@/lib/colors";
import { baixarCsv } from "@/lib/csv";
import { useDados } from "@/lib/data";
import { formatDate, formatInt, formatPct } from "@/lib/format";
import { SEGMENTO_NOME } from "@/lib/palette";
import { type Acao } from "@/lib/schemas";
import { hojeEmBrasilia } from "@/lib/stale";
import { useEstadoUrl, type Codec } from "@/lib/url-state";
import { colunasAcoes } from "./celulas-acoes";

export const codecAcoes: Codec<FiltrosAcoes> = {
  codificar(f) {
    const p: Record<string, string> = {};
    if (f.q) p.q = f.q;
    if (!f.onlyT) p.t = "0";
    for (const k of DIMS) if (f[k] != null) p[k] = f[k] as string;
    if (f.sort.k !== FILTROS_PADRAO.sort.k || f.sort.dir !== FILTROS_PADRAO.sort.dir)
      p.ord = `${f.sort.k}:${f.sort.dir}`;
    return p;
  },
  decodificar(p) {
    const f: Partial<FiltrosAcoes> = {};
    if (p.get("q")) f.q = p.get("q") as string;
    if (p.get("t") === "0") f.onlyT = false;
    for (const k of DIMS) if (p.get(k)) f[k] = p.get(k);
    const ord = p.get("ord")?.split(":");
    if (ord?.length === 2 && (ord[1] === "1" || ord[1] === "-1"))
      f.sort = { k: ord[0], dir: ord[1] === "1" ? 1 : -1 };
    return f;
  },
};

const ORDEM_MARCAS = Object.keys(COR_ESCRITURADOR);
const COLUNAS = colunasAcoes(false);

export function PainelAcoes() {
  const d = useDados("acoes.json");
  if (d.estado === "carregando") return <Carregando />;
  if (d.estado === "erro") return <ErroDados mensagem={d.mensagem} />;
  return <Conteudo acoes={d.dados.companhias} />;
}

function Conteudo({ acoes }: { acoes: Acao[] }) {
  const todas = useMemo(() => derivar(acoes), [acoes]);
  const ordemInst = useMemo(() => ordemDasInstituicoes(todas, ORDEM_MARCAS), [todas]);
  const [f, setF] = useEstadoUrl(FILTROS_PADRAO, codecAcoes);
  const anoRef = Number(hojeEmBrasilia().slice(0, 4));

  const alternar = (k: Dim, v: string) => setF((a) => ({ ...a, [k]: a[k] === v ? null : v }));
  const limpar = () => setF((a) => ({ ...FILTROS_PADRAO, onlyT: a.onlyT, sort: a.sort }));

  const base = filtrar(todas, f);
  const ordenadas = useMemo(() => ordenar(base, f.sort), [base, f.sort]);

  const doBanco = fatiasPorBanco(filtrar(todas, f, "bank"));
  const doSegmento = fatiasPorSegmento(filtrar(todas, f, "mkt"));
  const doHistorico = fatiasPorHistorico(filtrar(todas, f, "hist"));
  const anos = trocasPorAno(filtrar(todas, f, "yr"), anoRef, ordemInst);
  const maxAno = Math.max(
    1,
    ...anos.anos.map((y) => Object.values(anos.porAno[y]).reduce((a, b) => a + b, 0)),
  );
  const saldo = saldoDeTrocas(filtrar(todas, f, ["inE", "outE"]).filter((r) => r.escriturador_cvm?.anterior));
  const semSetor = filtrar(todas, f, "sec");
  const setores = topSetores(semSetor, f.sec);
  const maxSetor = Math.max(1, ...setores.map((s) => s.n));
  const classes = tickersPorClasse(filtrar(todas, f, "cls"), f.cls);

  const chips = DIMS.filter((k) => f[k] != null).map((k) => ({
    id: k,
    rotulo: ROTULO_DIM[k],
    valor: k === "mkt" ? (SEGMENTO_NOME[f[k] as string] ?? (f[k] as string)) : (f[k] as string),
    onRemover: () => setF((a) => ({ ...a, [k]: null })),
  }));

  return (
    <div className="dash">
      <Hero
        selo="B3 + CVM · dados abertos"
        titulo="Ações na B3: quem escritura cada empresa"
        texto="Escriturador atual de cada companhia emissora de ações (B3), com data de início e escriturador anterior segundo o Formulário Cadastral entregue à CVM. Clique nos gráficos para filtrar todo o painel."
      />
      <div className="wrap">
        <KpiGrid kpis={kpisAcoes(base, todas.length, anoRef)} />

        <div className="filters">
          <div className="fbar">
            <Busca
              valor={f.q}
              onChange={(q) => setF((a) => ({ ...a, q }))}
              placeholder="Buscar empresa, ticker, CNPJ, setor ou escriturador…"
            />
            <Alternador ligado={f.onlyT} onChange={() => setF((a) => ({ ...a, onlyT: !a.onlyT }))}>
              Somente negociadas (com ticker)
            </Alternador>
            <Chips chips={chips} mostrarLimpar={temFiltro(f)} onLimpar={limpar} />
          </div>
        </div>

        <div className="grid">
          <ChartCard
            coluna="c5"
            titulo="Participação por escriturador"
            descricao="Escriturador atual das ações ON, segundo a B3"
            tabela={{
              cabecalho: ["Escriturador", "Empresas", "Tickers"],
              linhas: doBanco.map((i) => [i.label, i.n, i.extra?.[0][1] ?? ""]),
            }}
          >
            <Donut
              itens={doBanco}
              selecionado={f.bank}
              onSelecionar={(k) => alternar("bank", k)}
              centro="empresas"
              rotuloValor="Empresas"
              rotuloAria="Participação por escriturador"
            />
          </ChartCard>
          <ChartCard
            coluna="c4"
            titulo="Segmento de listagem"
            descricao="Nível de governança na B3"
            tabela={{ cabecalho: ["Segmento", "Empresas"], linhas: doSegmento.map((i) => [i.label, i.n]) }}
          >
            <Donut
              itens={doSegmento}
              selecionado={f.mkt}
              onSelecionar={(k) => alternar("mkt", k)}
              centro="empresas"
              rotuloValor="Empresas"
              tamanho={160}
              rotuloAria="Segmento de listagem"
            />
          </ChartCard>
          <ChartCard
            coluna="c3"
            titulo="Histórico na CVM"
            descricao="Troca de escriturador desde 2010"
            tabela={{ cabecalho: ["Histórico", "Empresas"], linhas: doHistorico.map((i) => [i.label, i.n]) }}
          >
            <Donut
              itens={doHistorico}
              selecionado={f.hist}
              onSelecionar={(k) => alternar("hist", k)}
              centro="empresas"
              rotuloValor="Empresas"
              tamanho={170}
              empilhado
              rotuloAria="Histórico na CVM"
            />
          </ChartCard>

          <ChartCard
            coluna="c8"
            titulo="Trocas de escriturador por ano"
            descricao="Ano em que o escriturador atual assumiu, nas empresas que trocaram · cor = novo escriturador"
            tag={`${formatInt(anos.total)} trocas`}
            tabela={{
              cabecalho: ["Ano", "Trocas", ...anos.entidades],
              linhas: anos.anos.map((y) => [
                y,
                Object.values(anos.porAno[y]).reduce((a, b) => a + b, 0),
                ...anos.entidades.map((e) => anos.porAno[y][e] ?? 0),
              ]),
            }}
          >
            <ColunasEmpilhadas
              variante="anos"
              altura={170}
              escalaMax={maxAno}
              selecionada={f.yr}
              onSelecionar={(y) => alternar("yr", y)}
              colunas={anos.anos.map((y) => {
                const total = Object.values(anos.porAno[y]).reduce((a, b) => a + b, 0);
                const ents = anos.entidades.filter((e) => anos.porAno[y][e]);
                return {
                  id: y,
                  eixo: y === String(2010) && anos.anteDe2010 ? "≤10" : `’${y.slice(2)}`,
                  total,
                  topo: total ? String(total) : "",
                  rotuloAria: `${y}: ${total} trocas`,
                  partes: ents.map((e) => ({ cor: corEscriturador(e), valor: anos.porAno[y][e], nome: e })),
                  dica: () => (
                    <TipConteudo
                      titulo={(y === "2010" && anos.anteDe2010 ? "Até " : "") + y}
                      linhas={[
                        ["Trocas", formatInt(total)],
                        ...[...ents]
                          .sort((a, b) => anos.porAno[y][b] - anos.porAno[y][a])
                          .map((e): [React.ReactNode, React.ReactNode] => [
                            <span key={e}>
                              <span
                                style={{
                                  display: "inline-block",
                                  width: 8,
                                  height: 8,
                                  borderRadius: 2,
                                  background: corEscriturador(e),
                                  marginRight: 6,
                                }}
                              />
                              {e}
                            </span>,
                            formatInt(anos.porAno[y][e]),
                          ]),
                      ]}
                    />
                  ),
                };
              })}
            />
            <div className="mini-lg">
              {anos.entidades.map((e) => (
                <span key={e}>
                  <i style={{ background: corEscriturador(e) }} />
                  {e}
                </span>
              ))}
            </div>
          </ChartCard>
          <ChartCard
            coluna="c4"
            titulo="Saldo de trocas"
            descricao="Empresas perdidas e conquistadas por instituição"
            tabela={{
              cabecalho: ["Instituição", "Conquistou", "Perdeu", "Saldo"],
              linhas: saldo.map((s) => [s.entidade, s.ganhou, s.perdeu, s.ganhou - s.perdeu]),
            }}
          >
            <Divergentes
              linhas={saldo.map((s) => ({
                nome: s.entidade,
                cor: corEscriturador(s.entidade),
                perdeu: s.perdeu,
                ganhou: s.ganhou,
              }))}
              selPerdeu={f.outE}
              selGanhou={f.inE}
              onPerdeu={(e) => setF((a) => ({ ...a, inE: null, outE: a.outE === e ? null : e }))}
              onGanhou={(e) => setF((a) => ({ ...a, outE: null, inE: a.inE === e ? null : e }))}
            />
          </ChartCard>

          <ChartCard
            coluna="c8"
            titulo="Setores com mais empresas"
            descricao="Classificação setorial da B3 · 10 maiores no filtro atual"
            tabela={{ cabecalho: ["Setor", "Empresas"], linhas: setores.map((s) => [s.k, s.n]) }}
          >
            <BarList
              selecionado={f.sec}
              onSelecionar={(k) => alternar("sec", k)}
              itens={setores.map((s) => ({
                k: s.k,
                rotulo: s.k,
                parte: s.n / maxSetor,
                fundo: "linear-gradient(90deg,#6250d6,#b444b5)",
                valor: formatInt(s.n),
                pct: formatPct(s.n, semSetor.length),
                rotuloAria: `${s.k}: ${s.n} empresas`,
                dica: () => (
                  <TipConteudo
                    titulo={s.k}
                    linhas={[
                      ["Empresas", formatInt(s.n)],
                      ["Participação", formatPct(s.n, semSetor.length)],
                    ]}
                  />
                ),
              }))}
            />
          </ChartCard>
          <ChartCard
            coluna="c4"
            titulo="Tickers por classe"
            descricao="Quantidade de códigos de negociação"
            tabela={{ cabecalho: ["Classe", "Tickers"], linhas: classes.map((c) => [c.k, c.n]) }}
          >
            <Colunas
              itens={classes}
              selecionado={f.cls}
              onSelecionar={(k) => alternar("cls", k)}
              rotuloDica={(k) => `Classe ${k}`}
            />
            <p className="note">
              “Outros” reúne direitos, recibos e bônus de subscrição e códigos temporários.
            </p>
          </ChartCard>

          <section className="card c12" aria-label="Empresas e rastreabilidade do escriturador">
            <div className="tbl-head">
              <div>
                <h2>Empresas e rastreabilidade do escriturador</h2>
                <p className="desc" style={{ marginBottom: 0 }}>
                  Colunas em roxo vêm do Formulário Cadastral (FCA) da CVM · clique no cabeçalho para ordenar
                </p>
              </div>
              <div className="tbl-tools">
                <span className="count" aria-live="polite">
                  <b>{formatInt(ordenadas.length)}</b> de {formatInt(todas.length)} empresas
                </span>
                <button
                  type="button"
                  className="btn"
                  onClick={() => baixarCsv(NOME_ARQUIVO_CSV_ACOES, csvAcoes(ordenadas, false))}
                >
                  Exportar CSV
                </button>
              </div>
            </div>
            <DataTable
              dados={ordenadas}
              colunas={COLUNAS}
              chave={(r) => r.codigo_cvm}
              ordem={f.sort}
              onOrdenar={(id) =>
                setF((a) => ({ ...a, sort: { k: id, dir: a.sort.k === id ? (-a.sort.dir as 1 | -1) : 1 } }))
              }
              rotulo="Empresas e escrituradores"
              vazio="Nenhuma empresa corresponde aos filtros."
              larguraMinima={1280}
            />
          </section>
        </div>

        <div className="notes" role="note">
          <p>
            <b>Escriturador atual:</b> B3 · Empresas Listadas (<code>GetInitialCompanies</code> e{" "}
            <code>GetDetail</code>, campos <code>institutionCommon</code>/<code>institutionPreferred</code>),
            emissores do tipo “ações”.
          </p>
          <p>
            <b>Escriturador desde / anterior:</b> CVM · Formulário Cadastral (
            <code>fca_cia_aberta_escriturador</code>, 2010 em diante, última versão de cada ano), campos{" "}
            <code>Data_Inicio_Atuacao</code> e <code>Data_Fim_Atuacao</code>, cruzados pelo CNPJ. Os nomes
            informados pelas companhias foram padronizados por instituição. Datas com “~” não foram informadas
            no FCA: indicam o primeiro formulário em que o escriturador aparece. Quando o escriturador
            anterior não tem data de saída, mostra-se o último ano em que ele consta.
          </p>
          <p>
            <b>Diferenças B3 × CVM:</b> o selo “CVM indica…” aparece quando o escriturador do FCA mais recente
            difere do informado pela B3 (o FCA pode estar desatualizado ou a B3 informar outra entidade do
            mesmo grupo). {formatInt(todas.filter((r) => !r.escriturador_cvm).length)} empresas, em geral de
            balcão não organizado, não têm FCA com escriturador e aparecem como “Sem dados na CVM”.
          </p>
          <p>
            <b>Cores:</b> cada instituição usa a cor da sua identidade visual; as datas são as informadas
            pelas companhias e não foram verificadas em outras fontes.
          </p>
        </div>
      </div>
    </div>
  );
}

export { formatDate };
