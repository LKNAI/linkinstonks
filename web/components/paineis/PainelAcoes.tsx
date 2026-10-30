"use client";

// /acoes: paridade com seed/html/dashboard_acoes_b3.html e empresas_acoes_b3.html (a tabela completa), mais o volume
// negociado (acoes_volume.json), que reage aos mesmos filtros.
import { useMemo } from "react";
import { BarList } from "@/components/charts/BarList";
import { ChartCard } from "@/components/charts/ChartCard";
import { Colunas } from "@/components/charts/Colunas";
import { ColunasEmpilhadas } from "@/components/charts/ColunasEmpilhadas";
import { Divergentes } from "@/components/charts/Divergentes";
import { Donut } from "@/components/charts/Donut";
import { TipConteudo } from "@/components/charts/Tooltip";
import { Alternador, Busca, Chips, Seletor } from "@/components/filters/Controles";
import { FiltrosSheet } from "@/components/filters/FiltrosSheet";
import { GraficoVolume } from "@/components/charts/GraficoVolume";
import { Carregando, ErroDados, KpiGrid, PaginaComHero, type HeroProps } from "@/components/layout/Pagina";
import { useRegua } from "@/components/layout/Regua";
import { FonteVolume } from "@/components/paineis/FonteVolume";
import { DataTable } from "@/components/table/DataTableLazy";
import {
  COLUNAS_TEXTO_ACOES,
  DIMS,
  FILTROS_PADRAO,
  ROTULO_DIM,
  concentracaoVolume,
  csvAcoes,
  derivar,
  fatiasPorBanco,
  fatiasPorHistorico,
  fatiasPorSegmento,
  fatiasVolumePorBanco,
  fatiasVolumePorSegmento,
  filtrar,
  kpisAcoes,
  NOME_ARQUIVO_CSV_ACOES,
  ordemDasInstituicoes,
  ordenar,
  normalizar,
  rankingVolume,
  saldoDeTrocas,
  temFiltro,
  tickersPorClasse,
  topSetores,
  trocasPorAno,
  volumeMensalDe,
  type Dim,
  type FiltrosAcoes,
} from "@/lib/acoes"; // fmt: skip
import { COR_ESCRITURADOR, coresDoConjunto, corEscriturador } from "@/lib/colors";
import { baixarCsv } from "@/lib/csv";
import { useDados, type Doc } from "@/lib/data";
import { comoConferirMercado } from "@/lib/fonte-volume";
import { formatDate, formatDinheiro, formatInt, formatPct, rotuloMes, variacao } from "@/lib/format";
import { legivelSobreBranco, SEGMENTO_NOME } from "@/lib/palette";
import { type Acao } from "@/lib/schemas";
import { hojeEmBrasilia } from "@/lib/stale";
import { useEstadoUrl, type Codec } from "@/lib/url-state";
import { colunasAcoes } from "./celulas-acoes";

type VolumeDoc = Doc<"acoes_volume.json">;

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
    // links da antiga /acoes/tabela: "prev" (escriturador anterior) e "seg" (segmento)
    if (!f.outE && p.get("prev")) f.outE = p.get("prev");
    if (!f.mkt && p.get("seg")) f.mkt = p.get("seg");
    const ord = p.get("ord")?.split(":");
    if (ord?.length === 2 && (ord[1] === "1" || ord[1] === "-1"))
      f.sort = { k: ord[0], dir: ord[1] === "1" ? 1 : -1 };
    return f;
  },
};

const ORDEM_MARCAS = Object.keys(COR_ESCRITURADOR);

const HERO: HeroProps = {
  selo: "B3 + CVM · dados abertos",
  titulo: "Ações na B3: quem escritura cada empresa",
  texto:
    "Escriturador atual de cada companhia emissora de ações (B3), com data de início e escriturador anterior segundo o Formulário Cadastral entregue à CVM, e o volume negociado em 24 meses. Clique nos gráficos para filtrar todo o painel.",
};

export function PainelAcoes() {
  const d = useDados("acoes.json");
  const v = useDados("acoes_volume.json"); // em paralelo; se falhar, o painel segue sem a parte de volume
  if (d.estado === "erro") return <ErroDados mensagem={d.mensagem} />;
  return (
    <PaginaComHero hero={HERO}>
      {d.estado === "ok" && v.estado !== "carregando" ? (
        <Conteudo acoes={d.dados.companhias} volume={v.estado === "ok" ? v.dados : null} />
      ) : (
        <Carregando comHero />
      )}
    </PaginaComHero>
  );
}

/** Escrituradores anteriores (quem "perdeu" a empresa), do que mais perdeu para o que menos perdeu. */
function contarAnteriores(rows: readonly { outE: string | null }[]): [string, number][] {
  const c: Record<string, number> = {};
  for (const d of rows) if (d.outE) c[d.outE] = (c[d.outE] ?? 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt"));
}

const comSelecionado = (itens: { v: string; texto: string }[], sel: string | null) =>
  sel && !itens.some((i) => i.v === sel) ? [...itens, { v: sel, texto: `${sel} (0)` }] : itens;

function Conteudo({ acoes, volume }: { acoes: Acao[]; volume: VolumeDoc | null }) {
  const todas = useMemo(() => derivar(acoes, volume?.companhias), [acoes, volume]);
  const meses = useMemo(() => volume?.meses ?? [], [volume]);
  const colunasTabela = useMemo(() => colunasAcoes(meses.at(-1) ?? null), [meses]);
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
  const anteriores = contarAnteriores(filtrar(todas, f, "outE"));
  const anos = trocasPorAno(filtrar(todas, f, "yr"), anoRef, ordemInst);
  const maxAno = Math.max(
    1,
    ...anos.anos.map((y) => Object.values(anos.porAno[y]).reduce((a, b) => a + b, 0)),
  );
  const saldo = saldoDeTrocas(filtrar(todas, f, ["inE", "outE"]).filter((r) => r.escriturador_cvm?.anterior));
  const corAno = coresDoConjunto(anos.entidades);
  const corSaldo = coresDoConjunto(saldo.map((s) => s.entidade));
  const semSetor = filtrar(todas, f, "sec");
  const setores = topSetores(semSetor, f.sec);
  const maxSetor = Math.max(1, ...setores.map((s) => s.n));
  const classes = tickersPorClasse(filtrar(todas, f, "cls"), f.cls);
  useRegua(fatiasPorBanco(todas).map((i) => ({ nome: i.label, cor: i.color, valor: i.n })));

  // volume: reage a todos os filtros (companhias sem negócios nos 24 meses não entram nas somas)
  const vm = volumeMensalDe(base, meses.length);
  const totalVol = vm.mensal.reduce((a, b) => a + b, 0);
  const ult = meses.length - 1;
  const rk = rankingVolume(base);
  const conc = concentracaoVolume(rk.todas, rk.total);
  const volBanco = fatiasVolumePorBanco(filtrar(todas, f, "bank"));
  const volSegmento = fatiasVolumePorSegmento(filtrar(todas, f, "mkt"));
  const topo10 = rk.todas.slice(0, 10).reduce((a, x) => a + x.volume, 0);
  const vsAno = ult >= 12 ? variacao(vm.mensal[ult], vm.mensal[ult - 12]) : null;

  const chips = DIMS.filter((k) => f[k] != null).map((k) => ({
    id: k,
    rotulo: ROTULO_DIM[k],
    valor: k === "mkt" ? (SEGMENTO_NOME[f[k] as string] ?? (f[k] as string)) : (f[k] as string),
    onRemover: () => setF((a) => ({ ...a, [k]: null })),
  }));

  return (
    <>
      <div className="wrap">
        <KpiGrid kpis={kpisAcoes(base, todas.length, anoRef)} />

        <div className="filters">
          <div className="fbar">
            <Busca
              valor={f.q}
              onChange={(q) => setF((a) => ({ ...a, q }))}
              placeholder="Buscar empresa, ticker, CNPJ, setor ou escriturador…"
            />
            <FiltrosSheet
              ativos={
                (f.onlyT ? 0 : 1) +
                (["bank", "outE", "hist", "mkt"] as const).filter((k) => f[k] != null).length
              }
            >
              <Alternador ligado={f.onlyT} onChange={() => setF((a) => ({ ...a, onlyT: !a.onlyT }))}>
                Somente negociadas (com ticker)
              </Alternador>
              <Seletor
                rotulo="Escriturador atual"
                valor={f.bank ?? ""}
                onChange={(v) => setF((a) => ({ ...a, bank: v || null }))}
                opcoes={comSelecionado(
                  [
                    { v: "", texto: "Todos os escrituradores" },
                    ...doBanco.map((i) => ({ v: i.k, texto: `${i.label} (${i.n})` })),
                  ],
                  f.bank,
                )}
              />
              <Seletor
                rotulo="Escriturador anterior"
                valor={f.outE ?? ""}
                onChange={(v) => setF((a) => ({ ...a, inE: null, outE: v || null }))}
                opcoes={comSelecionado(
                  [
                    { v: "", texto: "Qualquer escriturador anterior" },
                    ...anteriores.map(([k, n]) => ({ v: k, texto: `${k} (${n})` })),
                  ],
                  f.outE,
                )}
              />
              <Seletor
                rotulo="Histórico"
                valor={f.hist ?? ""}
                onChange={(v) => setF((a) => ({ ...a, hist: v || null }))}
                opcoes={[
                  { v: "", texto: "Todo o histórico" },
                  ...doHistorico.map((i) => ({ v: i.k, texto: `${i.label} (${i.n})` })),
                ]}
              />
              <Seletor
                rotulo="Segmento"
                valor={f.mkt ?? ""}
                onChange={(v) => setF((a) => ({ ...a, mkt: v || null }))}
                opcoes={[
                  { v: "", texto: "Todos os segmentos" },
                  ...doSegmento.map((i) => ({ v: i.k, texto: `${i.label} (${i.n})` })),
                ]}
              />
            </FiltrosSheet>
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
            tabela={{
              cabecalho: ["Histórico", "Empresas"],
              linhas: doHistorico.map((i) => [i.label, i.n]),
            }}
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
                  partes: ents.map((e) => ({ cor: corAno(e), valor: anos.porAno[y][e], nome: e })),
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
                                  background: corAno(e),
                                  marginRight: "var(--space-2)",
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
                  <i style={{ background: corAno(e) }} />
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
                cor: corSaldo(s.entidade),
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
                fundo: "var(--accent)",
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

          <div className="sec-h" id="volume">
            <h2>Volume negociado</h2>
            <p>
              Mercado à vista e fracionário somados por companhia,{" "}
              {volume ? rotuloMes(meses[0]) : "últimos 24 meses"}
              {volume ? ` a ${rotuloMes(meses[ult])}` : ""}. Os números acompanham os filtros acima; cada
              barra do gráfico mensal leva ao arquivo oficial da B3 de onde o valor veio.
            </p>
          </div>

          {volume ? (
            <>
              <div className="c12">
                <KpiGrid
                  rotulo="Indicadores de volume"
                  kpis={[
                    {
                      rotulo: "Volume em 24 meses",
                      valor: formatDinheiro(totalVol),
                      sub: `${formatInt(vm.comVolume)} de ${formatInt(base.length)} empresas com negócios`,
                      cor: "var(--accent)",
                    },
                    {
                      rotulo: `Volume em ${rotuloMes(meses[ult])}`,
                      valor: formatDinheiro(vm.mensal[ult]),
                      sub:
                        vsAno && vsAno.texto
                          ? `${vsAno.texto} vs ${rotuloMes(meses[ult - 12])}`
                          : "último mês fechado",
                      cor: "var(--accent)",
                    },
                    {
                      rotulo: "As 10 maiores",
                      valor: formatPct(topo10, totalVol),
                      sub: "do volume de 24 meses no filtro",
                      cor: "var(--accent)",
                      p: totalVol ? topo10 / totalVol : 0,
                    },
                  ]}
                />
              </div>

              <GraficoVolume
                coluna="c8"
                ticker="ações no filtro"
                titulo="Volume financeiro mensal"
                fontes={volume.fontes_volume}
                pagina={volume.pagina_fonte}
                meses={meses}
                volumes={vm.mensal}
                mesParcial={volume.mes_parcial}
                volumeParcial={vm.parcial}
                cor="var(--accent)"
              />
              <ChartCard
                coluna="c4"
                titulo="Volume por escriturador"
                descricao="Escriturador atual das empresas · 24 meses"
                tabela={{
                  cabecalho: ["Escriturador", "Volume 24m", "Empresas"],
                  linhas: volBanco.map((i) => [i.label, formatDinheiro(i.n), i.extra?.[0][1] ?? ""]),
                }}
              >
                <Donut
                  itens={volBanco}
                  selecionado={f.bank}
                  onSelecionar={(k) => alternar("bank", k)}
                  centro="volume 24m"
                  rotuloValor="Volume"
                  formatar={formatDinheiro}
                  tamanho={168}
                  empilhado
                  rotuloAria="Volume por escriturador"
                />
              </ChartCard>

              <ChartCard
                coluna="c8 tall"
                titulo="Ranking por volume"
                descricao="Volume acumulado em 24 meses · cor = escriturador atual · clique para ver a empresa na tabela"
                tag={`${rotuloMes(meses[0])} – ${rotuloMes(meses[ult])}`}
                tabela={{
                  cabecalho: ["Empresa", "Tickers", "Escriturador", "Volume", "Participação"],
                  linhas: rk.itens.map((r) => [
                    r.d.pregao,
                    r.d.tickers.map((t) => t.ticker).join(" "),
                    r.d.b,
                    formatDinheiro(r.volume),
                    formatPct(r.volume, rk.total),
                  ]),
                }}
              >
                <BarList
                  variante="rank"
                  vazio="Sem volume no filtro atual."
                  onSelecionar={(cvm) => {
                    const alvo = rk.itens.find((r) => r.d.codigo_cvm === cvm)?.d;
                    if (!alvo) return;
                    setF((a) => ({ ...a, q: normalizar(alvo.pregao) }));
                    requestAnimationFrame(() =>
                      document
                        .getElementById("tabela-acoes")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                    );
                  }}
                  itens={rk.itens.map(({ d, volume: v }) => ({
                    k: d.codigo_cvm,
                    rotulo: d.pregao,
                    sub: d.tickers.map((t) => t.ticker).join(" "),
                    parte: v / Math.max(1, rk.itens[0]?.volume ?? 1),
                    fundo: corEscriturador(d.b),
                    valor: formatDinheiro(v),
                    pct: formatPct(v, rk.total),
                    rotuloAria: `${d.pregao}: ${formatDinheiro(v)}. Filtra a tabela`,
                    dica: () => (
                      <TipConteudo
                        titulo={`${d.pregao} · ${d.razao_social}`}
                        cor={corEscriturador(d.b)}
                        linhas={[
                          ["Escriturador", d.b],
                          ["Volume 24m", formatDinheiro(v)],
                          ["Participação", formatPct(v, rk.total)],
                          ["Clique", "filtra a tabela"],
                        ]}
                      />
                    ),
                  }))}
                />
              </ChartCard>
              <ChartCard
                coluna="c4"
                titulo="Volume por segmento"
                descricao="Nível de governança na B3 · 24 meses"
                tabela={{
                  cabecalho: ["Segmento", "Volume 24m", "Empresas"],
                  linhas: volSegmento.map((i) => [i.label, formatDinheiro(i.n), i.extra?.[0][1] ?? ""]),
                }}
              >
                <Donut
                  itens={volSegmento}
                  selecionado={f.mkt}
                  onSelecionar={(k) => alternar("mkt", k)}
                  centro="volume 24m"
                  rotuloValor="Volume"
                  formatar={formatDinheiro}
                  tamanho={168}
                  rotuloAria="Volume por segmento"
                />
              </ChartCard>
              <ChartCard
                coluna="c4"
                titulo="Concentração do volume"
                descricao="Participação das maiores empresas no volume filtrado"
                tabela={{
                  cabecalho: ["Corte", "Participação"],
                  linhas: conc.cortes.map((c) => [
                    c.n === 1 ? "Maior empresa" : `${c.n} maiores`,
                    `${(c.parte * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`,
                  ]),
                }}
              >
                <div className="conc">
                  <div className="cbar" role="img" aria-label="Participação acumulada das maiores empresas">
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
                      <b style={{ color: legivelSobreBranco(c.cor) }}>
                        {(c.parte * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                      </b>
                      <span>do volume {c.n === 1 ? "na maior empresa" : `nas ${c.n} maiores`}</span>
                    </div>
                  ))}
                  <p className="hint" style={{ margin: 0 }}>
                    {formatInt(conc.precisam80)} de {formatInt(conc.comVolume)} empresas com volume respondem
                    por 80% do total em 24 meses.
                  </p>
                </div>
              </ChartCard>
            </>
          ) : (
            <section className="card c12" role="status">
              <p className="muted" style={{ margin: 0 }}>
                O volume negociado está indisponível no momento. Os demais indicadores seguem válidos.
              </p>
            </section>
          )}

          <section
            className="card c12"
            id="tabela-acoes"
            aria-label="Empresas e rastreabilidade do escriturador"
          >
            <div className="tbl-head">
              <div>
                <h2>Empresas e rastreabilidade do escriturador</h2>
                <p className="desc" style={{ marginBottom: 0 }}>
                  Colunas em roxo vêm do Formulário Cadastral (FCA) da CVM · volume em R$ · clique no
                  cabeçalho para ordenar · a coluna fixa à esquerda acompanha a rolagem
                </p>
              </div>
              <div className="tbl-tools">
                <span className="count" aria-live="polite">
                  <b>{formatInt(ordenadas.length)}</b> de {formatInt(todas.length)} empresas
                </span>
                <button
                  type="button"
                  className="btn"
                  onClick={() => baixarCsv(NOME_ARQUIVO_CSV_ACOES, csvAcoes(ordenadas, true, volume != null))}
                >
                  Exportar CSV
                </button>
              </div>
            </div>
            <DataTable
              dados={ordenadas}
              colunas={colunasTabela}
              chave={(r) => r.codigo_cvm}
              ordem={f.sort}
              onOrdenar={(id) =>
                setF((a) => ({
                  ...a,
                  sort: {
                    k: id,
                    dir:
                      a.sort.k === id ? (-a.sort.dir as 1 | -1) : COLUNAS_TEXTO_ACOES.includes(id) ? 1 : -1,
                  },
                }))
              }
              rotulo="Empresas e escrituradores"
              vazio="Nenhuma empresa corresponde aos filtros."
              larguraMinima={volume ? 1780 : 1480}
            />
          </section>

          {volume ? (
            <FonteVolume
              ticker="mercado"
              como={comoConferirMercado()}
              meses={meses}
              mesParcial={volume.mes_parcial}
              fontes={volume.fontes_volume}
              pagina={volume.pagina_fonte}
            />
          ) : null}
        </div>

        <div className="notes" role="note">
          <p>
            <b>Escriturador atual:</b> B3 · Empresas Listadas (<code>GetInitialCompanies</code> e{" "}
            <code>GetDetail</code>, campos <code>institutionCommon</code>/<code>institutionPreferred</code>
            ), emissores do tipo “ações”.
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
          {volume ? (
            <p>
              <b>Volume:</b> B3 · Séries históricas de cotações (<code>COTAHIST</code>), mercados à vista
              (010) e fracionário (020) somados por companhia, em R$. {formatInt(volume.companhias.length)} de{" "}
              {formatInt(todas.length)} empresas têm negócios nos 24 meses; as demais aparecem com “—”.
              Tickers que não casam com o cadastro atual (por exemplo, empresas já deslistadas) somam{" "}
              {formatPct(
                volume.nao_atribuido.volume_mensal.reduce((a, b) => a + b, 0),
                volume.nao_atribuido.volume_mensal.reduce((a, b) => a + b, 0) +
                  volume.companhias.reduce((a, c) => a + c.volume_24m, 0),
              )}{" "}
              do volume do mercado ({formatInt(volume.nao_atribuido.tickers)} tickers) e ficam fora das somas
              acima. Dados abertos:{" "}
              <a href="/data/downloads/acoes_volume.csv" download className="fonte-link">
                acoes_volume.csv
              </a>
              .
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}

export { formatDate };
