import type { Metadata } from "next";
import { LinkNovaAba } from "@/components/layout/LinkNovaAba";
import { notFound } from "next/navigation";
import { GraficoVolume } from "@/components/charts/GraficoVolume";
import { FonteVolume } from "@/components/paineis/FonteVolume";
import { Cartao, Lista, Migalhas } from "@/components/paineis/Detalhe";
import { corDepositaria } from "@/lib/colors";
import { formatBRL, formatDate, formatDinheiro, formatInt, rotuloMes } from "@/lib/format";
import { TIPO_GRUPO_NOME, grupoDoTipo } from "@/lib/palette";
import { todosBdrs } from "@/lib/servidor";

export const dynamicParams = false;

export function generateStaticParams() {
  return todosBdrs().bdrs.map((b) => ({ ticker: b.ticker }));
}

type Props = { params: Promise<{ ticker: string }> };

const buscar = (ticker: string) => todosBdrs().bdrs.find((b) => b.ticker === ticker);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const b = buscar((await params).ticker);
  if (!b) return {};
  return {
    title: `${b.ticker}: ${b.nome}`,
    description: `${b.nome} (${b.ticker}): BDR ${TIPO_GRUPO_NOME[grupoDoTipo(b.tipo)].toLowerCase()}, depositária ${b.depositaria}, volume mensal e negócios na B3.`,
  };
}

export default async function Page({ params }: Props) {
  const b = buscar((await params).ticker);
  if (!b) notFound();
  const { meses, mesParcial, fontes, paginaFonte } = todosBdrs();
  const cor = corDepositaria(b.depositaria);
  const grupo = grupoDoTipo(b.tipo);

  return (
    <div className="dash">
      <div className="wrap">
        <Migalhas
          itens={[{ href: "/", texto: "Início" }, { href: "/bdrs/", texto: "BDRs" }, { texto: b.ticker }]}
        />
        <h1 className="page-title">
          {b.ticker} <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>· {b.nome}</span>
        </h1>
        <p className="page-sub">
          BDR {TIPO_GRUPO_NOME[grupo].toLowerCase()} ({b.tipo})
          {b.qualificado ? " · restrito a investidores qualificados" : ""} ·{" "}
          <LinkNovaAba
            href={`/bdrs/?q=${b.ticker.toLowerCase()}#tabela-bdrs`}
            style={{ color: "var(--accent-hover)", fontWeight: 600 }}
          >
            ver na lista
          </LinkNovaAba>
        </p>

        <div className="grid">
          <Cartao coluna="c4" titulo="Depositária" descricao="Banco emissor do programa">
            <Lista
              linhas={[
                [
                  "Instituição",
                  <span className="dep" key="d">
                    <i style={{ background: cor }} />
                    {b.depositaria}
                  </span>,
                ],
                [
                  "Fonte",
                  b.fonte_depositaria || (
                    <span className="badge warn">Não encontrada nas listas consultadas</span>
                  ),
                ],
              ]}
            />
          </Cartao>
          <Cartao coluna="c4" titulo="Programa" descricao="Cadastro">
            <Lista
              linhas={[
                ["Tipo", `${TIPO_GRUPO_NOME[grupo]} (${b.tipo})`],
                ...(b.categoria ? ([["Classe do ETF", b.categoria]] as [string, React.ReactNode][]) : []),
                [
                  "ISIN",
                  <span className="mono" key="i">
                    {b.isin}
                  </span>,
                ],
                ["Investidor", b.qualificado ? "Somente qualificado" : "Geral"],
              ]}
            />
          </Cartao>
          <Cartao coluna="c4" titulo="Negociação" descricao="Mercado à vista e fracionário">
            <Lista
              linhas={[
                ["Último preço", b.ultimo_preco ? formatBRL(b.ultimo_preco) : "—"],
                ["Último pregão", formatDate(b.ultimo_pregao)],
                ["Negócios em 24 meses", formatInt(b.negocios_24m)],
                ["Volume em 24 meses", formatDinheiro(b.volume_24m)],
                ...(mesParcial
                  ? ([
                      [
                        `Volume em ${rotuloMes(mesParcial)} (parcial)`,
                        formatDinheiro(b.volume_mes_parcial ?? 0),
                      ],
                    ] as [string, React.ReactNode][])
                  : []),
              ]}
            />
          </Cartao>

          <GraficoVolume
            ticker={b.ticker}
            fontes={fontes}
            pagina={paginaFonte}
            meses={meses}
            volumes={b.volume_mensal}
            mesParcial={mesParcial}
            volumeParcial={b.volume_mes_parcial}
            cor={cor}
          />
          <FonteVolume
            ticker={b.ticker}
            meses={meses}
            mesParcial={mesParcial}
            fontes={fontes}
            pagina={paginaFonte}
          />
        </div>
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
