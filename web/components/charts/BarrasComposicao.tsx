"use client";

// Barras de composição (100%) por grupo: cada linha é um botão que filtra pelo grupo.
import { TipConteudo, useTip } from "./Tooltip";

export interface ParteComposicao {
  k: string;
  nome: string;
  n: number;
  cor: string;
}

export interface LinhaComposicao {
  k: string;
  rotulo: string;
  total: number;
  partes: ParteComposicao[];
}

export function BarrasComposicao({
  linhas,
  selecionado,
  onSelecionar,
  unidade,
  vazio,
}: {
  linhas: readonly LinhaComposicao[];
  selecionado: string | null;
  onSelecionar: (k: string) => void;
  unidade: string;
  vazio: string;
}) {
  const tip = useTip();
  if (!linhas.length) return <p className="muted">{vazio}</p>;
  return (
    <div className="comp">
      {linhas.map((l) => (
        <button
          key={l.k}
          type="button"
          className="comp-linha"
          aria-pressed={selecionado === l.k}
          aria-label={`${l.rotulo}, ${l.total} ${unidade}: ${l.partes.map((p) => `${p.n} ${p.nome}`).join(", ")}`}
          onClick={() => onSelecionar(l.k)}
          {...tip(() => (
            <TipConteudo
              titulo={l.rotulo}
              linhas={[
                [`Total de ${unidade}`, l.total],
                ...l.partes.map((p): [string, number] => [p.nome, p.n]),
              ]}
            />
          ))}
        >
          <span className="comp-rotulo">{l.rotulo}</span>
          <span className="comp-barra" aria-hidden="true">
            {l.partes.map((p) => (
              <i key={p.k} style={{ width: `${(p.n / l.total) * 100}%`, background: p.cor }} />
            ))}
          </span>
          <span className="comp-total">{l.total}</span>
        </button>
      ))}
    </div>
  );
}
