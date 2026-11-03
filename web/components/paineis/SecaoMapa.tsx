"use client";

// O mapa de calor de BDRs com legenda e alternativa em tabela: a mesma peça na prévia de /bdrs e em /bdrs/mapa.
import { ChartCard } from "@/components/charts/ChartCard";
import { CELULA_SEM_NEGOCIOS, type Celula } from "@/components/charts/celulas";
import { MapaCalor } from "@/components/charts/MapaCalorLazy";
import { TipConteudo } from "@/components/charts/Tooltip";
import type { BdrRow } from "@/lib/bdrs";
import { abreviaMes, formatDinheiro, formatInt, rotuloMes } from "@/lib/format";
import {
  celulaVariacao,
  celulasIntensidade,
  indicesDosMeses,
  LIMITE_VARIACAO,
  PASSOS_INTENSIDADE,
  textoEscala,
  type ModoMapa,
} from "@/lib/mapa";

export function LegendaMapa({ modo }: { modo: ModoMapa }) {
  return (
    <div className="mapa-legenda">
      {modo === "intensidade" ? (
        <>
          <span>menor</span>
          <span className="mapa-esc" aria-hidden="true">
            {Array.from({ length: PASSOS_INTENSIDADE }, (_, i) => (
              <i key={i} style={{ background: `var(--seq-${i + 1})` }} />
            ))}
          </span>
          <span>pico do próprio BDR</span>
        </>
      ) : (
        <>
          <span>×0,25</span>
          <span className="mapa-esc" aria-hidden="true">
            {["frio-3", "frio-2", "frio-1", "neutro", "quente-1", "quente-2", "quente-3"].map((c) => (
              <i key={c} style={{ background: `var(--div-${c})` }} />
            ))}
          </span>
          <span>×{LIMITE_VARIACAO}</span>
          <span>×1 = igual à média dos 12 meses anteriores</span>
          <span className="mapa-chave">
            <i className="mapa-chave-semref" aria-hidden="true" /> sem os 12 meses anteriores
          </span>
        </>
      )}
      <span className="mapa-chave">
        <i className="mapa-chave-vazia" aria-hidden="true" /> sem negócios
      </span>
    </div>
  );
}

export function SecaoMapa({
  rows,
  meses,
  modo,
  janela,
  titulo,
  descricao,
  acoes,
  mesSelecionado,
  onMes,
}: {
  rows: readonly BdrRow[];
  meses: readonly string[];
  modo: ModoMapa;
  janela: 12 | 24;
  titulo: string;
  descricao: string;
  acoes?: React.ReactNode;
  /** Índice do mês do ranking, nos 24 meses. */
  mesSelecionado?: number | null;
  onMes?: (indice: number) => void;
}) {
  const indices = indicesDosMeses(meses.length, modo, janela);
  const colunas = indices.map((i, j) => {
    const m = meses[i];
    return { id: m, rotulo: abreviaMes(m), ano: j === 0 || m.endsWith("-01") ? m.slice(0, 4) : undefined };
  });
  const porId = new Map(rows.map((d) => [d.ticker, d]));
  const linhas = rows.map((d) => {
    const intensidade = modo === "intensidade" ? celulasIntensidade(d.volume_mensal) : null;
    const celulas: Celula[] = indices.map((i) =>
      intensidade ? intensidade[i] : celulaVariacao(d.volume_mensal, i),
    );
    return {
      id: d.ticker,
      rotulo: d.ticker,
      sub: d.nome,
      href: `/bdrs/${d.ticker}/`,
      direita: formatDinheiro(d.tot),
      celulas,
    };
  });
  const selecionada = mesSelecionado == null ? null : indices.indexOf(mesSelecionado);
  return (
    <ChartCard
      coluna="c12"
      titulo={titulo}
      descricao={descricao}
      tabela={{
        cabecalho: ["BDR", ...indices.map((i) => rotuloMes(meses[i])), "Volume 24m"],
        linhas: rows.map((d) => [
          d.ticker,
          ...indices.map((i) =>
            d.volume_mensal[i] ? formatDinheiro(d.volume_mensal[i]).replace("R$ ", "") : "·",
          ),
          formatDinheiro(d.tot),
        ]),
      }}
    >
      {acoes}
      <LegendaMapa modo={modo} />
      <MapaCalor
        linhas={linhas}
        colunas={colunas}
        escala={modo === "intensidade" ? "seq" : "div"}
        rotulo={titulo}
        tituloDireita="Volume 24m"
        colunaSelecionada={selecionada != null && selecionada >= 0 ? selecionada : null}
        onColuna={onMes ? (j) => onMes(indices[j]) : undefined}
        onLinha={(l) => window.open(`/bdrs/${l.id}/`, "_blank", "noopener")}
        larguraMinimaCelula={modo === "variacao" || janela === 12 ? 28 : 26}
        textoCelula={(l, j) => {
          const d = porId.get(l.id) as BdrRow;
          const i = indices[j];
          return `${d.ticker}, ${rotuloMes(meses[i])}: ${l.celulas[j] === CELULA_SEM_NEGOCIOS ? "sem negócios" : `${formatDinheiro(d.volume_mensal[i])}, ${textoEscala(d.volume_mensal, i, modo)}`}`;
        }}
        dica={(l, j) => {
          const d = porId.get(l.id) as BdrRow;
          const i = indices[j];
          return (
            <TipConteudo
              titulo={`${d.ticker} · ${d.nome}`}
              linhas={[
                ["Mês", rotuloMes(meses[i])],
                ["Volume", d.volume_mensal[i] ? formatDinheiro(d.volume_mensal[i]) : "sem negócios"],
                ["Negócios", formatInt(d.negocios_mensal?.[i] ?? 0)],
                ["Escala", textoEscala(d.volume_mensal, i, modo)],
              ]}
            />
          );
        }}
      />
    </ChartCard>
  );
}
