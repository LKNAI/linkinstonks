"use client";

// Painéis mensais das páginas de detalhe, nunca em eixo duplo: presença da companhia e ticket médio do BDR.
import { ChartCard } from "@/components/charts/ChartCard";
import { ColunasEmpilhadas } from "@/components/charts/ColunasEmpilhadas";
import { TipConteudo } from "@/components/charts/Tooltip";
import { Aprox, NotaEstimativa, NotaSuspeitos } from "@/components/paineis/Avisos";
import { escalaEixo } from "@/lib/bdrs";
import { abreviaMes, formatBRL, formatInt, formatTicket, rotuloMes } from "@/lib/format";
import { FAIXA_COR, FAIXA_NOME } from "@/lib/palette";
import { faixaDoMes, ticketDoMes, type Quartis } from "@/lib/ticket";

const eixoMes = (m: string) => (m.endsWith("-01") ? `’${m.slice(2, 4)}` : abreviaMes(m));
const pct = (p: number | null) =>
  p == null ? "—" : `${(p * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export interface MesCompanhia {
  mes: string;
  volume: number;
  negocios: number;
  ticket: number | null;
  dias: number;
  pregoes: number;
  presenca: number | null;
  suspeito: boolean;
}

export function GraficoPresenca({ pontos, ticker }: { pontos: MesCompanhia[]; ticker: string | null }) {
  const temSuspeito = pontos.some((p) => p.suspeito);
  return (
    <ChartCard
      coluna="c12"
      titulo="Presença mensal"
      descricao={`Pregões com negócio ÷ pregões do mês${ticker ? `, no ticker mais negociado de cada mês` : ""} · mesma sequência de meses do volume`}
      tabela={{
        cabecalho: ["Mês", "Volume", "Negócios", "Ticket médio", "Dias com negócio", "Pregões", "Presença"],
        linhas: pontos.map((p) => [
          rotuloMes(p.mes),
          formatTicket(p.volume),
          <span key="n">
            <Aprox ativo={p.suspeito} />
            {formatInt(p.negocios)}
          </span>,
          <span key="t">
            <Aprox ativo={p.suspeito} />
            {p.ticket == null ? "—" : formatBRL(p.ticket)}
          </span>,
          p.dias,
          p.pregoes,
          pct(p.presenca),
        ]),
      }}
    >
      <ColunasEmpilhadas
        variante="meses"
        altura={96}
        escalaMax={1}
        grade={[
          { valor: 0.5, rotulo: "50%" },
          { valor: 1, rotulo: "100%" },
        ]}
        selecionada={null}
        onSelecionar={() => {}}
        somenteLeitura
        colunas={pontos.map((p) => ({
          id: p.mes,
          eixo: eixoMes(p.mes),
          destaqueEixo: p.mes.endsWith("-01"),
          total: p.presenca ?? 0,
          rotuloAria: `${rotuloMes(p.mes)}: negociou em ${p.dias} de ${p.pregoes} pregões`,
          partes: [{ cor: "var(--cat-2)", valor: p.presenca ?? 0, nome: p.mes }],
          dica: () => (
            <TipConteudo
              titulo={rotuloMes(p.mes)}
              linhas={[
                ["Presença", pct(p.presenca)],
                ["Dias com negócio", `${p.dias} de ${p.pregoes}`],
              ]}
            />
          ),
        }))}
      />
      {temSuspeito ? <NotaSuspeitos /> : null}
    </ChartCard>
  );
}

export function GraficoTicket({
  ticker,
  meses,
  volumes,
  negocios,
  suspeitos,
  quartis,
  minNegocios,
}: {
  ticker: string;
  meses: string[];
  volumes: number[];
  negocios: number[];
  suspeitos: string[];
  quartis: Record<string, Quartis>;
  minNegocios: number;
}) {
  const pontos = meses.map((m, i) => ({
    mes: m,
    ticket: ticketDoMes(volumes[i], negocios[i]),
    negocios: negocios[i],
    faixa: faixaDoMes(volumes[i], negocios[i], quartis[m], minNegocios),
    suspeito: suspeitos.includes(m),
  }));
  const eixo = escalaEixo(Math.max(1, ...pontos.map((p) => p.ticket ?? 0)), 1);
  const grade: { valor: number; rotulo: string }[] = [];
  for (let v = eixo.passo; v <= eixo.topo; v += eixo.passo) grade.push({ valor: v, rotulo: formatTicket(v) });
  return (
    <ChartCard
      coluna="c12"
      titulo="Ticket médio mensal"
      descricao="Volume ÷ negócios de cada mês · cor = faixa no mês, entre os BDRs com negócios suficientes"
      tabela={{
        cabecalho: ["Mês", "Ticket médio", "Negócios", "Faixa"],
        linhas: pontos.map((p) => [
          rotuloMes(p.mes),
          <span key="t">
            <Aprox ativo={p.suspeito} />
            {p.ticket == null ? "—" : formatBRL(p.ticket)}
          </span>,
          <span key="n">
            <Aprox ativo={p.suspeito} />
            {formatInt(p.negocios)}
          </span>,
          FAIXA_NOME[p.faixa],
        ]),
      }}
    >
      <ColunasEmpilhadas
        variante="meses"
        altura={160}
        escalaMax={eixo.topo}
        grade={grade}
        selecionada={null}
        onSelecionar={() => {}}
        somenteLeitura
        colunas={pontos.map((p) => ({
          id: p.mes,
          eixo: eixoMes(p.mes),
          destaqueEixo: p.mes.endsWith("-01"),
          total: p.ticket ?? 0,
          rotuloAria: `${ticker}, ${rotuloMes(p.mes)}: ticket médio ${p.ticket == null ? "sem negócios" : formatBRL(p.ticket)}, ${FAIXA_NOME[p.faixa]}${p.suspeito ? ", valor aproximado" : ""}`,
          partes: [{ cor: FAIXA_COR[p.faixa], valor: p.ticket ?? 0, nome: p.mes }],
          dica: () => (
            <TipConteudo
              titulo={rotuloMes(p.mes)}
              linhas={[
                ["Ticket médio", `${p.suspeito ? "≈ " : ""}${p.ticket == null ? "—" : formatBRL(p.ticket)}`],
                ["Negócios", `${p.suspeito ? "≈ " : ""}${formatInt(p.negocios)}`],
                ["Faixa", FAIXA_NOME[p.faixa]],
              ]}
            />
          ),
        }))}
      />
      <div className="lgd">
        {(["ticket_baixo", "intermediario", "ticket_alto", "dados_insuficientes"] as const).map((f) => (
          <span key={f}>
            <i style={{ background: FAIXA_COR[f] }} />
            {FAIXA_NOME[f]}
          </span>
        ))}
      </div>
      <NotaEstimativa />
      {suspeitos.length ? <NotaSuspeitos /> : null}
    </ChartCard>
  );
}
