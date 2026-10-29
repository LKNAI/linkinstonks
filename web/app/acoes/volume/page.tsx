import type { Metadata } from "next";
import Link from "next/link";
import { GraficoVolume } from "@/components/charts/GraficoVolume";
import { Cartao, Lista, Migalhas } from "@/components/paineis/Detalhe";
import { FonteVolume } from "@/components/paineis/FonteVolume";
import { comoConferirMercado } from "@/lib/fonte-volume";
import { formatDinheiro, formatInt, formatPct, rotuloMes } from "@/lib/format";
import { acoesVolume } from "@/lib/servidor";

export const metadata: Metadata = {
  title: "Volume negociado das ações",
  description:
    "Volume financeiro mensal das ações na B3, por companhia e do mercado, com link para o arquivo oficial de origem.",
};

const TOP = 40;

export default function Page() {
  const d = acoesVolume();
  const { meses, mes_parcial: parcial, companhias } = d;
  const mercado = meses.map(
    (_, i) => companhias.reduce((a, c) => a + c.volume_mensal[i], 0) + d.nao_atribuido.volume_mensal[i],
  );
  const mercadoParcial = parcial ? companhias.reduce((a, c) => a + (c.volume_mes_parcial ?? 0), 0) : null;
  const total24 = mercado.reduce((a, b) => a + b, 0);
  const ult = meses.length - 1;
  const ranking = [...companhias].sort((a, b) => b.volume_24m - a.volume_24m).slice(0, TOP);
  const topo10 = ranking.slice(0, 10).reduce((a, c) => a + c.volume_24m, 0);

  return (
    <div className="dash">
      <div className="wrap">
        <Migalhas
          itens={[{ href: "/", texto: "Início" }, { href: "/acoes/", texto: "Ações" }, { texto: "Volume" }]}
        />
        <h1 className="page-title">Volume negociado das ações</h1>
        <p className="page-sub">
          Mercado à vista e fracionário, somados por companhia, {rotuloMes(meses[0])} a{" "}
          {rotuloMes(meses[ult])}. Cada barra leva ao arquivo oficial da B3 de onde o número veio.
        </p>

        <div className="grid">
          <Cartao coluna="c4" titulo="Mercado" descricao="Todas as ações negociadas na B3">
            <Lista
              linhas={[
                [`Volume em ${rotuloMes(meses[ult])}`, formatDinheiro(mercado[ult])],
                ["Volume em 24 meses", formatDinheiro(total24)],
                ["Média por mês", formatDinheiro(total24 / meses.length)],
                ...(parcial && mercadoParcial != null
                  ? ([[`Volume em ${rotuloMes(parcial)} (parcial)`, formatDinheiro(mercadoParcial)]] as [
                      string,
                      React.ReactNode,
                    ][])
                  : []),
              ]}
            />
          </Cartao>
          <Cartao coluna="c4" titulo="Concentração" descricao="Quem concentra o volume negociado">
            <Lista
              linhas={[
                ["Companhias com negócios", formatInt(companhias.length)],
                ["As 10 maiores", formatPct(topo10, total24)],
                [
                  "Sem companhia no cadastro",
                  `${formatInt(d.nao_atribuido.tickers)} tickers · ${formatPct(
                    d.nao_atribuido.volume_mensal.reduce((a, b) => a + b, 0),
                    total24,
                  )}`,
                ],
              ]}
            />
          </Cartao>
          <Cartao coluna="c4" titulo="Baixar" descricao="Dados abertos, em R$ mil">
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>
              <a href="/data/downloads/acoes_volume.csv" download className="fonte-link">
                acoes_volume.csv
              </a>{" "}
              traz o volume mensal de cada companhia. O volume de tickers que não casam com o cadastro atual
              (por exemplo, empresas já deslistadas) aparece à parte, sem ser descartado.
            </p>
          </Cartao>

          <GraficoVolume
            ticker="mercado de ações"
            titulo="Volume financeiro mensal do mercado de ações"
            fontes={d.fontes_volume}
            pagina={d.pagina_fonte}
            meses={meses}
            volumes={mercado}
            mesParcial={parcial}
            volumeParcial={mercadoParcial}
            cor="var(--accent)"
          />

          <Cartao
            coluna="c12"
            titulo={`As ${TOP} companhias de maior volume`}
            descricao="Soma dos tickers de cada companhia nos últimos 24 meses"
          >
            <div className="tbl-wrap">
              <table className="stats-table">
                <caption className="sr-only">Companhias de maior volume negociado em 24 meses</caption>
                <thead>
                  <tr>
                    <th scope="col">Companhia</th>
                    <th scope="col">Tickers</th>
                    <th scope="col" className="r">
                      Volume 24 meses
                    </th>
                    <th scope="col" className="r">
                      {rotuloMes(meses[ult])}
                    </th>
                    <th scope="col" className="r">
                      Participação
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((c) => (
                    <tr key={c.codigo_cvm}>
                      <td>
                        <Link href={`/acoes/${c.codigo_cvm}/`} prefetch={false}>
                          {c.pregao}
                        </Link>
                      </td>
                      <td className="mono">{c.tickers.join(" ")}</td>
                      <td className="r num">{formatDinheiro(c.volume_24m)}</td>
                      <td className="r num">{formatDinheiro(c.volume_mensal[ult])}</td>
                      <td className="r num">{formatPct(c.volume_24m, total24)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Cartao>

          <FonteVolume
            ticker="mercado"
            como={comoConferirMercado()}
            meses={meses}
            mesParcial={parcial}
            fontes={d.fontes_volume}
            pagina={d.pagina_fonte}
          />
        </div>
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
