import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LinkNovaAba } from "@/components/layout/LinkNovaAba";
import { GraficoPresenca, type MesCompanhia } from "@/components/charts/GraficosMensais";
import { GraficoVolume } from "@/components/charts/GraficoVolume";
import { Cartao, LinhaDoTempo, Lista, Listagem, Migalhas } from "@/components/paineis/Detalhe";
import { FonteVolume } from "@/components/paineis/FonteVolume";
import { Banco } from "@/components/paineis/celulas-acoes";
import { normalizar } from "@/lib/acoes";
import { formatDate } from "@/lib/format";
import { SEGMENTO_NOME } from "@/lib/palette";
import { comoConferirCompanhia } from "@/lib/fonte-volume";
import { ROTULO_LIQUIDEZ } from "@/lib/rotulos-liquidez";
import { acoesLiquidez, historicoDe, segmentosDe, todasAcoes } from "@/lib/servidor";

export const dynamicParams = false;

export function generateStaticParams() {
  return todasAcoes().map((c) => ({ codigoCvm: c.codigo_cvm }));
}

type Props = { params: Promise<{ codigoCvm: string }> };

const buscar = (codigo: string) => todasAcoes().find((c) => c.codigo_cvm === codigo);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = buscar((await params).codigoCvm);
  if (!c) return {};
  const esc = c.escriturador_cvm?.atual ?? c.escriturador_b3.on ?? c.escriturador_b3.pn;
  return {
    title: `${c.pregao}: escriturador`,
    description: `${c.razao_social}${esc ? `: escriturador atual ${esc}` : ""}. Histórico de trocas de escriturador e tickers na B3.`,
  };
}

export default async function Page({ params }: Props) {
  const c = buscar((await params).codigoCvm);
  if (!c) notFound();
  const f = c.escriturador_cvm;
  const b3 = c.escriturador_b3;
  const principalB3 = b3.on ?? b3.pn;
  const historico = historicoDe(c.codigo_cvm);
  const vol = acoesLiquidez();
  const volCia = vol.companhias.find((x) => x.codigo_cvm === c.codigo_cvm);
  const pontos: MesCompanhia[] = volCia
    ? vol.meses.map((mes, i) => ({
        mes,
        volume: volCia.mensal.volume[i],
        negocios: volCia.mensal.negocios[i],
        ticket: volCia.mensal.ticket_medio[i],
        dias: volCia.mensal.dias_com_negocio[i],
        pregoes: vol.pregoes_mes[i],
        presenca: volCia.mensal.presenca[i],
        suspeito: volCia.meses_negocios_suspeitos.includes(mes),
      }))
    : [];
  const anoFinal = Number(new Date().getFullYear());

  return (
    <div className="dash">
      <div className="wrap">
        <Migalhas
          itens={[{ href: "/", texto: "Início" }, { href: "/acoes/", texto: "Ações" }, { texto: c.pregao }]}
        />
        <h1 className="page-title">{c.pregao}</h1>
        <p className="page-sub">
          {c.razao_social}. CNPJ {c.cnpj} · código CVM {c.codigo_cvm} ·{" "}
          <LinkNovaAba
            href={`/acoes/?q=${encodeURIComponent(normalizar(c.pregao))}#tabela-acoes`}
            style={{ color: "var(--accent-hover)", fontWeight: 600 }}
          >
            ver na lista
          </LinkNovaAba>
        </p>

        <div className="grid">
          <Cartao coluna="c4" titulo="Escriturador atual" descricao="Segundo a B3 e segundo a CVM">
            <Lista
              linhas={[
                ["Segundo a B3 (ON)", b3.on ? <Banco key="on" nome={b3.on} /> : "—"],
                ...(b3.pn && b3.pn !== b3.on
                  ? ([["Segundo a B3 (PN)", <Banco key="pn" nome={b3.pn} />]] as [string, React.ReactNode][])
                  : []),
                [
                  "Segundo a CVM (FCA)",
                  f ? <Banco key="cvm" nome={f.atual} /> : <span className="muted">Sem dados na CVM</span>,
                ],
                [
                  "Desde",
                  f
                    ? f.inicio_aproximado
                      ? `~${formatDate(f.inicio).slice(3)} (aprox.)`
                      : formatDate(f.inicio)
                    : "—",
                ],
                ["Texto original da B3", b3.bruto_on || b3.bruto_pn || "—"],
              ]}
            />
            {c.divergente_b3_cvm ? (
              <p className="note">
                <span className="badge warn">⚠ B3 e CVM divergem</span> O FCA mais recente indica {f?.atual};
                a B3 informa {principalB3 ?? "nenhum escriturador"}. O FCA pode estar desatualizado ou a B3
                pode informar outra entidade do mesmo grupo.
              </p>
            ) : f ? (
              <p className="note">
                <span className="badge ok">B3 e CVM concordam</span>
              </p>
            ) : null}
          </Cartao>

          <Cartao coluna="c4" titulo="Companhia" descricao="Cadastro">
            <Lista
              linhas={[
                ["Segmento", SEGMENTO_NOME[c.segmento] ?? c.segmento],
                ["Setor", c.setor],
                ["Emissor", c.emissor],
                ["Situação na CVM", c.situacao_cvm ?? "—"],
                [
                  "Escriturador anterior",
                  f?.anterior ? <Banco key="a" nome={f.anterior} /> : f ? "Sem troca registrada" : "—",
                ],
                ["Escrituradores desde 2010", f ? String(f.n_escrituradores) : "—"],
                [
                  "Negociação",
                  c.liquidez ? (ROTULO_LIQUIDEZ[c.liquidez.categoria] ?? c.liquidez.categoria) : "—",
                ],
              ]}
            />
            {c.liquidez ? <p className="note">{c.liquidez.criterio_texto}</p> : null}
          </Cartao>

          <Cartao coluna="c4" titulo="Tickers" descricao="Códigos de negociação de ações">
            {c.tickers.length ? (
              <div>
                {c.tickers.map((t) => (
                  <span
                    className="tk"
                    key={t.ticker}
                    title={
                      t.negociacao_desde
                        ? `Negociado desde ${formatDate(t.negociacao_desde)}, segundo a CVM`
                        : undefined
                    }
                  >
                    {t.ticker}
                    <i>{t.classe === "Outros" ? "" : t.classe}</i>
                  </span>
                ))}
              </div>
            ) : (
              <p className="muted">Sem ticker de ações (em geral, balcão não organizado).</p>
            )}
          </Cartao>

          <Cartao
            coluna="c12"
            titulo="Linha do tempo de escrituradores"
            descricao="Formulário Cadastral da CVM, de 2010 em diante"
          >
            <LinhaDoTempo passagens={historico} anoFinal={anoFinal} />
            <p className="note">
              Datas informadas pelas companhias no FCA. Datas com “~” não foram informadas e indicam o
              primeiro formulário com aquele escriturador.
            </p>
          </Cartao>

          <Listagem listagem={c.listagem} segmentos={segmentosDe(c.codigo_cvm)} passagens={historico} />

          {volCia ? (
            <>
              <GraficoVolume
                ticker={volCia.tickers.join(" ")}
                titulo="Volume negociado das ações"
                fontes={vol.fontes_volume}
                pagina={vol.pagina_fonte}
                meses={vol.meses}
                volumes={volCia.mensal.volume}
                mesParcial={vol.mes_parcial}
                volumeParcial={volCia.volume_mes_parcial}
                cor="var(--accent)"
              />
              <GraficoPresenca pontos={pontos} ticker={volCia.ticker_principal} />
              <FonteVolume
                ticker={volCia.tickers[0] ?? c.pregao}
                como={comoConferirCompanhia(volCia.tickers)}
                meses={vol.meses}
                mesParcial={vol.mes_parcial}
                fontes={vol.fontes_volume}
                pagina={vol.pagina_fonte}
              />
            </>
          ) : null}
        </div>
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
