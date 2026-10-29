"use client";

// Volume mensal de um BDR (24 meses fechados + mês corrente parcial). Componente de cliente: o tooltip e a
// alternativa em tabela são interativos; os dados chegam serializados da página (gerada no build).
import { ChartCard } from "@/components/charts/ChartCard";
import { ColunasEmpilhadas } from "@/components/charts/ColunasEmpilhadas";
import { TipConteudo } from "@/components/charts/Tooltip";
import { escalaEixo } from "@/lib/bdrs";
import { abreviaMes, formatDinheiro, rotuloMes } from "@/lib/format";

export function GraficoVolumeBdr({
  meses,
  volumes,
  mesParcial,
  volumeParcial,
  cor,
}: {
  meses: string[];
  volumes: number[];
  mesParcial: string | null;
  volumeParcial: number | null;
  cor: string;
}) {
  const todos = [
    ...meses.map((m, i) => ({ mes: m, v: volumes[i] ?? 0, parcial: false })),
    ...(mesParcial ? [{ mes: mesParcial, v: volumeParcial ?? 0, parcial: true }] : []),
  ];
  const eixo = escalaEixo(Math.max(1, ...todos.map((t) => t.v)));
  const grade: { valor: number; rotulo: string }[] = [];
  for (let v = eixo.passo; v <= eixo.topo; v += eixo.passo)
    grade.push({ valor: v, rotulo: formatDinheiro(v) });
  return (
    <ChartCard
      coluna="c12"
      titulo="Volume financeiro mensal"
      descricao={`Mercado à vista e fracionário somados${mesParcial ? ` · ${rotuloMes(mesParcial)} é parcial` : ""}`}
      tag={`${formatDinheiro(volumes.reduce((a, b) => a + b, 0))} em 24 meses`}
      tabela={{
        cabecalho: ["Mês", "Volume"],
        linhas: todos.map((t) => [rotuloMes(t.mes) + (t.parcial ? " (parcial)" : ""), formatDinheiro(t.v)]),
      }}
    >
      <ColunasEmpilhadas
        variante="meses"
        altura={224}
        escalaMax={eixo.topo}
        grade={grade}
        selecionada={null}
        onSelecionar={() => {}}
        colunas={todos.map((t) => ({
          id: t.mes,
          eixo: t.mes.endsWith("-01") ? `’${t.mes.slice(2, 4)}` : abreviaMes(t.mes),
          destaqueEixo: t.mes.endsWith("-01"),
          total: t.v,
          rotuloAria: `${rotuloMes(t.mes)}${t.parcial ? " (parcial)" : ""}: ${formatDinheiro(t.v)}`,
          partes: [{ cor: t.parcial ? `${cor}88` : cor, valor: t.v, nome: t.mes }],
          dica: () => (
            <TipConteudo
              titulo={rotuloMes(t.mes) + (t.parcial ? " (parcial)" : "")}
              linhas={[["Volume", formatDinheiro(t.v)]]}
            />
          ),
        }))}
      />
    </ChartCard>
  );
}
