"use client";

// Histograma genérico com eixo informado pelo chamador (escala logarítmica ou não) e marcas verticais rotuladas.
import type { ReactNode } from "react";
import { useTip } from "./Tooltip";

export interface BarraHistograma {
  id: string;
  /** Início e fim no eixo, de 0 a 1. */
  de: number;
  ate: number;
  n: number;
  cor: string;
  rotuloAria: string;
  dica: () => ReactNode;
}

export function Histograma({
  barras,
  marcas,
  eixo,
  altura = 200,
}: {
  barras: readonly BarraHistograma[];
  marcas: readonly { x: number; rotulo: string }[];
  eixo: readonly { x: number; rotulo: string }[];
  altura?: number;
}) {
  const tip = useTip();
  const max = Math.max(1, ...barras.map((b) => b.n));
  return (
    <div className="hist">
      <div className="hist-marcas" aria-hidden="true">
        {marcas.map((m) => (
          <span key={m.rotulo} className="hist-marca" style={{ left: `${m.x * 100}%` }}>
            {m.rotulo}
          </span>
        ))}
      </div>
      <div className="hist-area" style={{ height: altura }}>
        {barras.map((b) => (
          <div
            key={b.id}
            className="hist-barra"
            role="img"
            tabIndex={0}
            aria-label={b.rotuloAria}
            style={{
              left: `${b.de * 100}%`,
              width: `${(b.ate - b.de) * 100}%`,
              height: `${(b.n / max) * 100}%`,
              background: b.cor,
            }}
            {...tip(b.dica)}
          />
        ))}
        {marcas.map((m) => (
          <i key={m.rotulo} className="hist-fio" style={{ left: `${m.x * 100}%` }} aria-hidden="true" />
        ))}
      </div>
      <div className="hist-eixo" aria-hidden="true">
        {eixo.map((e) => (
          <span key={e.rotulo} style={{ left: `${e.x * 100}%` }}>
            {e.rotulo}
          </span>
        ))}
      </div>
    </div>
  );
}
