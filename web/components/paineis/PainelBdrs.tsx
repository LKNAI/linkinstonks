"use client";

// /bdrs: paridade total com seed/html/dashboard_bdrs_b3.html.
import { useMemo } from "react";
import { BarList } from "@/components/charts/BarList";
import { ChartCard } from "@/components/charts/ChartCard";
import { ColunasEmpilhadas } from "@/components/charts/ColunasEmpilhadas";
import { Donut } from "@/components/charts/Donut";
import { Sparkline } from "@/components/charts/Sparkline";
import { TipConteudo } from "@/components/charts/Tooltip";
import { Busca, Chips, Segmentado } from "@/components/filters/Controles";
import { Carregando, ErroDados, Hero, KpiGrid } from "@/components/layout/Pagina";
import { DataTable, type ColunaSpec } from "@/components/table/DataTable";
import {
  COLUNAS_TEXTO,
  DIMS_BDR,
  FILTROS_BDR_PADRAO,
  NOME_ARQUIVO_CSV_BDRS,
  ROTULO_DIM_BDR,
  concentracao,
  csvBdrs,
  derivarBdrs,
  fatiasCategoria,
  fatiasDepositaria,
  fatiasTipo,
  filtrarBdrs,
  kpisBdrs,
  ordenarBdrs,
  ranking,
  temFiltroBdr,
  totaisMensais,
  volumeDe,
  escalaEixo,
  type BdrRow,
  type DimBdr,
  type FiltrosBdrs,
  type Situacao,
} from "@/lib/bdrs"; // fmt: skip
import { corDepositaria } from "@/lib/colors";
import { baixarCsv } from "@/lib/csv";
import { useDados } from "@/lib/data";
import {
  abreviaMes,
  formatBRL,
  formatDate,
  formatDinheiro,
  formatInt,
  formatPct,
  rotuloMes,
  variacao,
} from "@/lib/format";
import { TIPO_GRUPO_COR, TIPO_GRUPO_NOME, type TipoGrupo } from "@/lib/palette";
import { bdrsDocSchema } from "@/lib/schemas";
import { useEstadoUrl, type Codec } from "@/lib/url-state";

export const codecBdrs: Codec<FiltrosBdrs> = {
  codificar(f) {
    const p: Record<string, string> = {};
    if (f.q) p.q = f.q;
    if (f.st !== "all") p.st = f.st;
    for (const k of DIMS_BDR) if (f[k] != null) p[k] = f[k] as string;
    if (f.month != null) p.mes = String(f.month);
    if (f.showM) p.m = "1";
    if (f.sort.k !== FILTROS_BDR_PADRAO.sort.k || f.sort.dir !== FILTROS_BDR_PADRAO.sort.dir)
      p.ord = `${f.sort.k}:${f.sort.dir}`;
    return p;
  },
  decodificar(p) {
    const f: Partial<FiltrosBdrs> = {};
    if (p.get("q")) f.q = p.get("q") as string;
    const st = p.get("st");
    if (st === "on" || st === "off") f.st = st;
    for (const k of DIMS_BDR) if (p.get(k)) f[k] = p.get(k);
    const mes = Number(p.get("mes"));
    if (p.get("mes") != null && Number.isInteger(mes) && mes >= 0) f.month = mes;
    if (p.get("m") === "1") f.showM = true;
    const ord = p.get("ord")?.split(":");
    if (ord?.length === 2 && (ord[1] === "1" || ord[1] === "-1"))
      f.sort = { k: ord[0], dir: ord[1] === "1" ? 1 : -1 };
    return f;
  },
};

export function PainelBdrs() {
  const d = useDados("bdrs.json", bdrsDocSchema);
  if (d.estado === "carregando") return <Carregando />;
  if (d.estado === "erro") return <ErroDados mensagem={d.mensagem} />;
  return <Conteudo meses={d.dados.meses} bdrs={d.dados.bdrs} />;
}

function Variacao({ a, b }: { a: number; b: number }) {
  const v = variacao(a, b);
  if (v.tipo === "nenhuma") return <span className="muted">—</span>;
  return <span className={`delta ${v.tipo === "queda" ? "down" : "up"}`}>{v.texto}</span>;
}

function colunas(meses: readonly string[], showM: boolean, inicioJanela: string): ColunaSpec<BdrRow>[] {
  const ult = meses.length - 1;
  const rotUlt = rotuloMes(meses[ult] ?? "");
  const base: ColunaSpec<BdrRow>[] = [
    {
      id: "t",
      titulo: "BDR",
      fixa: true,
      celula: (d) => (
        <div className="co">
          <span className="tk">{d.ticker}</span>
          {d.qualificado ? (
            <span className="qual" title="Restrito a investidores qualificados">
              QUALIF.
            </span>
          ) : null}
          <small title={d.nome}>{d.nome}</small>
        </div>
      ),
    },
    {
      id: "T",
      titulo: "Tipo",
      celula: (d) => (
        <>
          <span className="type" style={{ background: TIPO_GRUPO_COR[d.T] }}>
            {d.tipo}
          </span>
          {d.C ? (
            <small className="muted" style={{ display: "block", fontSize: 11 }}>
              {d.C}
            </small>
          ) : null}
        </>
      ),
    },
    {
      id: "d",
      titulo: "Depositária",
      celula: (d) => (
        <span
          className="dep"
          title={
            d.fonte_depositaria
              ? `Fonte: ${d.fonte_depositaria}`
              : "Depositária não encontrada nas listas consultadas"
          }
        >
          <i style={{ background: corDepositaria(d.depositaria) }} />
          {d.depositaria}
        </span>
      ),
    },
    {
      id: "spark",
      titulo: "24 meses",
      ordenavel: false,
      celula: (d) => (
        <Sparkline
          valores={d.volume_mensal}
          cor={d.depositaria === "Não identificado" ? "#7c7b93" : corDepositaria(d.depositaria)}
          rotulo={`Volume mensal de ${d.ticker}, ${meses.length} meses`}
        />
      ),
    },
    {
      id: "tot",
      titulo: "Volume 24m",
      classeTh: "r",
      classeTd: () => "r num",
      celula: (d) => <b>{formatDinheiro(d.tot)}</b>,
    },
    {
      id: "last",
      titulo: `Volume ${rotUlt}`,
      classeTh: "r",
      classeTd: () => "r num",
      celula: (d) => formatDinheiro(d.volume_mensal[ult] ?? 0),
    },
    {
      id: "var",
      titulo: "12m × 12m ant.",
      classeTh: "r",
      classeTd: () => "r num",
      celula: (d) => <Variacao a={d.y1} b={d.y0} />,
    },
    {
      id: "g",
      titulo: "Negócios 24m",
      classeTh: "r",
      classeTd: () => "r num",
      celula: (d) => formatInt(d.negocios_24m),
    },
    {
      id: "p",
      titulo: "Último preço",
      classeTh: "r",
      classeTd: () => "r num",
      celula: (d) => (d.ultimo_preco ? formatBRL(d.ultimo_preco) : "—"),
    },
    {
      id: "f",
      titulo: "1º pregão no período",
      classeTd: () => "num",
      celula: (d) =>
        !d.primeiro_pregao || d.primeiro_pregao <= inicioJanela ? (
          <span className="muted">
            antes de {abreviaMes(meses[0])}/{meses[0].slice(2, 4)}
          </span>
        ) : (
          formatDate(d.primeiro_pregao)
        ),
    },
    { id: "l", titulo: "Último pregão", classeTd: () => "num", celula: (d) => formatDate(d.ultimo_pregao) },
    {
      id: "on",
      titulo: "Situação",
      celula: (d) => (
        <span className={`status ${d.on ? "on" : "off"}`}>{d.on ? "Negociada" : "Sem negócios"}</span>
      ),
    },
    { id: "i", titulo: "ISIN", classeTd: () => "mono", celula: (d) => d.isin },
  ];
  if (!showM) return base;
  return [
    ...base,
    ...meses.map<ColunaSpec<BdrRow>>((m, i) => ({
      id: `m${i}`,
      titulo: rotuloMes(m),
      classeTh: "r m",
      classeTd: (d) => `m r num${d.volume_mensal[i] ? "" : " z"}`,
      celula: (d) => (d.volume_mensal[i] ? formatDinheiro(d.volume_mensal[i]).replace("R$ ", "") : "·"),
    })),
  ];
}

function Conteudo({ bdrs, meses }: { bdrs: Parameters<typeof derivarBdrs>[0]; meses: string[] }) {
  const todos = useMemo(() => derivarBdrs(bdrs), [bdrs]);
  const [f, setF] = useEstadoUrl(FILTROS_BDR_PADRAO, codecBdrs);
  const rot = rotuloMes(meses[meses.length - 1]);
  const alternar = (k: DimBdr, v: string) => setF((a) => ({ ...a, [k]: a[k] === v ? null : v }));
  const limpar = () => setF(() => ({ ...FILTROS_BDR_PADRAO }));

  const base = filtrarBdrs(todos, f);
  const ordenados = useMemo(() => ordenarBdrs(base, f.sort), [base, f.sort]);
  const { kpis } = kpisBdrs(base, meses);
  const mensal = totaisMensais(base, meses);
  const eixo = escalaEixo(Math.max(1, ...mensal.map((m) => m.total)));
  const grade: { valor: number; rotulo: string }[] = [];
  for (let v = eixo.passo; v <= eixo.topo; v += eixo.passo)
    grade.push({ valor: v, rotulo: formatDinheiro(v) });
  const rk = ranking(base, f);
  const conc = concentracao(rk.todos, rk.total, f);
  const porDep = fatiasDepositaria(filtrarBdrs(todos, f, "dep"));
  const porTipo = fatiasTipo(filtrarBdrs(todos, f, "type"));
  const porCat = fatiasCategoria(filtrarBdrs(todos, f, "cat"));
  // 1º pregão da janela: quem negociou nele já existia antes (como o "antes de out/24" do seed).
  const inicioJanela = useMemo(
    () =>
      todos.reduce(
        (m, d) => (d.primeiro_pregao && d.primeiro_pregao < m ? d.primeiro_pregao : m),
        "9999-12-31",
      ),
    [todos],
  );
  const colunasTabela = useMemo(() => colunas(meses, f.showM, inicioJanela), [meses, f.showM, inicioJanela]);

  const chips = [
    ...DIMS_BDR.filter((k) => f[k] != null).map((k) => ({
      id: k,
      rotulo: ROTULO_DIM_BDR[k],
      valor: k === "type" ? TIPO_GRUPO_NOME[f.type as TipoGrupo] : (f[k] as string),
      onRemover: () => setF((a) => ({ ...a, [k]: null })),
    })),
    ...(f.month != null
      ? [
          {
            id: "mes",
            rotulo: "Mês do ranking",
            valor: rotuloMes(meses[f.month]),
            onRemover: () => setF((a) => ({ ...a, month: null })),
          },
        ]
      : []),
  ];
  const tipos: TipoGrupo[] = ["DRN", "DRE", "SPO"];

  return (
    <div className="dash">
      <Hero
        selo={`Dados abertos B3 · ${rotuloMes(meses[0])} – ${rot}`}
        titulo="BDRs na B3: quem emite e quanto negocia"
        texto="Todos os BDRs com negócios nos últimos 24 meses: tickers, tipo de programa, instituição depositária (o banco emissor) e volume financeiro mensal. Clique nos gráficos para filtrar o painel inteiro."
      />
      <div className="wrap">
        <KpiGrid kpis={kpis} />

        <div className="filters">
          <div className="fbar">
            <Busca
              valor={f.q}
              onChange={(q) => setF((a) => ({ ...a, q }))}
              placeholder="Buscar ticker, empresa, ETF, ISIN ou depositária…"
            />
            <Segmentado<Situacao>
              rotulo="Situação"
              valor={f.st}
              onChange={(st) => setF((a) => ({ ...a, st }))}
              opcoes={[
                { v: "all", texto: "Todas" },
                { v: "on", texto: `Negociadas em ${rot}` },
                { v: "off", texto: `Sem negócios em ${rot}` },
              ]}
            />
            <Chips chips={chips} mostrarLimpar={temFiltroBdr(f)} onLimpar={limpar} />
          </div>
        </div>

        <div className="grid">
          <ChartCard
            coluna="c12"
            titulo="Volume financeiro mensal"
            descricao="Soma do mercado à vista e fracionário, por tipo de programa · clique num mês para usá-lo como referência no ranking"
            tag={`${formatDinheiro(mensal.reduce((a, m) => a + m.total, 0))} em 24 meses`}
            tabela={{
              cabecalho: ["Mês", "Total", ...tipos.map((t) => TIPO_GRUPO_NOME[t])],
              linhas: mensal.map((m) => [
                rotuloMes(m.mes),
                formatDinheiro(m.total),
                ...tipos.map((t) => formatDinheiro(m.porTipo[t])),
              ]),
            }}
          >
            <ColunasEmpilhadas
              variante="meses"
              altura={224}
              escalaMax={eixo.topo}
              grade={grade}
              selecionada={f.month == null ? null : meses[f.month]}
              onSelecionar={(mes) =>
                setF((a) => ({ ...a, month: a.month === meses.indexOf(mes) ? null : meses.indexOf(mes) }))
              }
              colunas={mensal.map((m, i) => ({
                id: m.mes,
                eixo: m.mes.endsWith("-01") ? `’${m.mes.slice(2, 4)}` : abreviaMes(m.mes),
                destaqueEixo: m.mes.endsWith("-01"),
                total: m.total,
                rotuloAria: `${rotuloMes(m.mes)}: ${formatDinheiro(m.total)}`,
                partes: tipos.map((t) => ({ cor: TIPO_GRUPO_COR[t], valor: m.porTipo[t], nome: t })),
                dica: () => (
                  <TipConteudo
                    titulo={rotuloMes(m.mes)}
                    linhas={[
                      ["Total", formatDinheiro(m.total)],
                      ...tipos.map((t): [React.ReactNode, React.ReactNode] => [
                        <span key={t}>
                          <i
                            style={{
                              display: "inline-block",
                              width: 8,
                              height: 8,
                              borderRadius: 2,
                              background: TIPO_GRUPO_COR[t],
                              marginRight: 6,
                            }}
                          />
                          {TIPO_GRUPO_NOME[t]}
                        </span>,
                        formatDinheiro(m.porTipo[t]),
                      ]),
                      [
                        "vs ano anterior",
                        i >= 12 ? variacao(m.total, mensal[i - 12].total).texto || "—" : "—",
                      ],
                    ]}
                  />
                ),
              }))}
            />
            <div className="lgd">
              {tipos.map((t) => (
                <span key={t}>
                  <i style={{ background: TIPO_GRUPO_COR[t] }} />
                  {TIPO_GRUPO_NOME[t]}
                </span>
              ))}
              <span className="muted" style={{ fontWeight: 500 }}>
                Rótulos do eixo: meses; ano em destaque em janeiro
              </span>
            </div>
          </ChartCard>

          <ChartCard
            coluna="c4"
            titulo="Volume por depositária"
            descricao="Banco emissor dos BDRs · 24 meses"
            tabela={{
              cabecalho: ["Depositária", "Volume 24m", "BDRs"],
              linhas: porDep.map((i) => [i.label, formatDinheiro(i.n), i.extra?.[0][1] ?? ""]),
            }}
          >
            <Donut
              itens={porDep}
              selecionado={f.dep}
              onSelecionar={(k) => alternar("dep", k)}
              centro="volume 24m"
              rotuloValor="Volume"
              formatar={formatDinheiro}
              tamanho={168}
              rotuloAria="Volume por depositária"
            />
          </ChartCard>
          <ChartCard
            coluna="c4"
            titulo="BDRs por tipo de programa"
            descricao="Quantidade de tickers negociados"
            tabela={{
              cabecalho: ["Tipo", "BDRs", "Volume 24m"],
              linhas: porTipo.map((i) => [i.label, i.n, i.extra?.[0][1] ?? ""]),
            }}
          >
            <Donut
              itens={porTipo}
              selecionado={f.type}
              onSelecionar={(k) => alternar("type", k)}
              centro="BDRs"
              rotuloValor="BDRs"
              tamanho={168}
              rotuloAria="BDRs por tipo de programa"
            />
          </ChartCard>
          <ChartCard
            coluna="c4"
            titulo="BDRs de ETF por classe"
            descricao="Volume dos BDRs de ETF (DRE) · 24 meses"
            tabela={{
              cabecalho: ["Classe", "Volume 24m", "ETFs"],
              linhas: porCat.map((i) => [i.label, formatDinheiro(i.n), i.extra?.[0][1] ?? ""]),
            }}
          >
            {porCat.length ? (
              <Donut
                itens={porCat}
                selecionado={f.cat}
                onSelecionar={(k) => alternar("cat", k)}
                centro="volume 24m"
                rotuloValor="Volume"
                formatar={formatDinheiro}
                tamanho={168}
                rotuloAria="BDRs de ETF por classe"
              />
            ) : (
              <p className="muted">Nenhum BDR de ETF no filtro atual.</p>
            )}
          </ChartCard>

          <ChartCard
            coluna="c8"
            titulo="Ranking por volume"
            descricao={`${f.month == null ? "Volume acumulado em 24 meses" : `Volume em ${rotuloMes(meses[f.month])}`} · cor = depositária`}
            tag={f.month == null ? `${rotuloMes(meses[0])} – ${rot}` : rotuloMes(meses[f.month])}
            tabela={{
              cabecalho: ["BDR", "Nome", "Depositária", "Volume", "Participação"],
              linhas: rk.itens.map((r) => [
                r.d.ticker,
                r.d.nome,
                r.d.depositaria,
                formatDinheiro(r.volume),
                formatPct(r.volume, rk.total),
              ]),
            }}
          >
            <BarList
              variante="rank"
              vazio="Sem volume no filtro atual."
              onSelecionar={(ticker) => {
                setF((a) => ({ ...a, q: ticker.toLowerCase() }));
                requestAnimationFrame(() =>
                  document
                    .getElementById("tabela-bdrs")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                );
              }}
              itens={rk.itens.map(({ d, volume }) => ({
                k: d.ticker,
                rotulo: d.ticker,
                sub: d.nome,
                parte: volume / Math.max(1, ...rk.itens.map((x) => x.volume)),
                fundo: corDepositaria(d.depositaria),
                valor: formatDinheiro(volume),
                pct: formatPct(volume, rk.total),
                rotuloAria: `${d.ticker}, ${d.nome}: ${formatDinheiro(volume)}. Filtra a tabela`,
                dica: () => (
                  <TipConteudo
                    titulo={`${d.ticker} · ${d.nome}`}
                    cor={corDepositaria(d.depositaria)}
                    linhas={[
                      ["Tipo", `${TIPO_GRUPO_NOME[d.T]} (${d.tipo})`],
                      ["Depositária", d.depositaria],
                      ["Volume", formatDinheiro(volume)],
                      ["Participação", formatPct(volume, rk.total)],
                      ["Clique", "filtra a tabela"],
                    ]}
                  />
                ),
              }))}
            />
          </ChartCard>
          <ChartCard
            coluna="c4"
            titulo="Concentração do volume"
            descricao="Participação dos maiores BDRs no volume filtrado"
            tabela={{
              cabecalho: ["Corte", "Participação"],
              linhas: conc.cortes.map((c) => [
                c.n === 1 ? "Maior BDR" : `${c.n} maiores`,
                `${(c.parte * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`,
              ]),
            }}
          >
            <div className="conc">
              <div className="cbar" role="img" aria-label="Participação acumulada dos maiores BDRs">
                {conc.cortes.map((c, i) => (
                  <i
                    key={c.n}
                    style={{
                      width: `${(c.parte - (conc.cortes[i - 1]?.parte ?? 0)) * 100}%`,
                      background: c.cor,
                    }}
                  />
                ))}
              </div>
              {conc.cortes.map((c) => (
                <div className="cstat" key={c.n}>
                  <b style={{ color: c.cor }}>
                    {(c.parte * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                  </b>
                  <span>do volume {c.n === 1 ? "no maior BDR" : `nos ${c.n} maiores BDRs`}</span>
                </div>
              ))}
              <p className="hint" style={{ margin: 0 }}>
                {formatInt(conc.precisam80)} de {formatInt(conc.comVolume)} BDRs com volume respondem por 80%
                do total{f.month == null ? " em 24 meses" : ` em ${rotuloMes(meses[f.month])}`}.
              </p>
            </div>
          </ChartCard>

          <section className="card c12" id="tabela-bdrs" aria-label="Todos os BDRs">
            <div className="tbl-head">
              <div>
                <h2>Todos os BDRs</h2>
                <p className="desc" style={{ marginBottom: 0 }}>
                  Volume em R$ · clique no cabeçalho para ordenar · a coluna fixa à esquerda acompanha a
                  rolagem
                </p>
              </div>
              <div className="tbl-tools">
                <span className="count" aria-live="polite">
                  <b>{formatInt(ordenados.length)}</b> de {formatInt(todos.length)} BDRs
                </span>
                <button
                  type="button"
                  className="btn"
                  aria-pressed={f.showM}
                  onClick={() => setF((a) => ({ ...a, showM: !a.showM }))}
                >
                  {f.showM ? "Ocultar meses" : "Mostrar os 24 meses"}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => baixarCsv(NOME_ARQUIVO_CSV_BDRS, csvBdrs(ordenados, meses))}
                >
                  Exportar CSV
                </button>
              </div>
            </div>
            <DataTable
              dados={ordenados}
              colunas={colunasTabela}
              chave={(r) => r.ticker}
              ordem={f.sort}
              onOrdenar={(id) =>
                setF((a) => ({
                  ...a,
                  sort: {
                    k: id,
                    dir: a.sort.k === id ? (-a.sort.dir as 1 | -1) : COLUNAS_TEXTO.includes(id) ? 1 : -1,
                  },
                }))
              }
              rotulo="Todos os BDRs"
              vazio="Nenhum BDR corresponde aos filtros."
              alturaEstimada={56}
              larguraMinima={f.showM ? 2200 : 1500}
            />
          </section>
        </div>

        <div className="notes" role="note">
          <p>
            <b>Volumes, preços e negócios:</b> B3 · Séries históricas de cotações (<code>COTAHIST</code>),{" "}
            {rotuloMes(meses[0])} a {rot}, mercados à vista (010) e fracionário (020) somados por ticker;
            papéis com especificação DR1, DR2, DR3, DRE e DRN. Não inclui opções, termo e BDRs em units. O mês
            corrente aparece à parte quando há pregões processados.
          </p>
          <p>
            <b>Instituição depositária:</b> API Empresas Listadas da B3 (<code>GetDetail</code>) para BDRs
            patrocinados e de ETF; Banco B3 — listas de programas em finservices.b3.com.br; demais casos por
            correção manual com fonte e data (Bradesco Custódia, Itaú Investment Services). “Não identificado”
            reúne programas encerrados ou ausentes dessas fontes (
            {formatPct(
              todos.filter((d) => d.depositaria === "Não identificado").reduce((a, d) => a + d.tot, 0),
              todos.reduce((a, d) => a + d.tot, 0),
            )}{" "}
            do volume).
          </p>
          <p>
            <b>Tipos:</b> DRN = não patrocinado nível I · DRE = BDR de ETF · DR1/DR2/DR3 = patrocinado níveis
            I, II e III. BDRs marcados com <span className="qual">QUALIF.</span> são restritos a investidores
            qualificados. Classe dos ETFs conforme a categoria da B3.
          </p>
        </div>
      </div>
    </div>
  );
}

export { volumeDe };
