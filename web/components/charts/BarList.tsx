"use client";

// Barras horizontais clicáveis: "setores com mais empresas" e "ranking por volume".
import type { ReactNode } from "react";
import { useTip } from "./Tooltip";

export interface ItemBarra {
  k: string;
  rotulo: string;
  /** Linha secundária sob o rótulo (nome do emissor, no ranking). */
  sub?: string;
  /** 0..1 */
  parte: number;
  /** Cor sólida ou gradiente CSS. */
  fundo: string;
  valor: string;
  pct: string;
  dica: () => ReactNode;
  rotuloAria: string;
}

export function BarList({
  itens,
  selecionado,
  onSelecionar,
  variante = "plain",
  vazio,
}: {
  itens: ItemBarra[];
  selecionado?: string | null;
  onSelecionar: (k: string) => void;
  variante?: "plain" | "rank";
  vazio?: string;
}) {
  const tip = useTip();
  if (!itens.length) return <p className="muted">{vazio ?? "Sem dados no filtro atual."}</p>;
  return (
    <div className={`bars${variante === "rank" ? " rank" : ""}${selecionado != null ? " has-sel" : ""}`}>
      {itens.map((it) => (
        <button
          key={it.k}
          type="button"
          className={`brow${selecionado === it.k ? " sel" : ""}`}
          aria-pressed={selecionado === undefined ? undefined : selecionado === it.k}
          aria-label={it.rotuloAria}
          onClick={() => onSelecionar(it.k)}
          {...tip(it.dica)}
        >
          <span className="nm" title={it.rotulo}>
            {it.sub !== undefined ? <b>{it.rotulo}</b> : it.rotulo}
            {it.sub !== undefined ? <small>{it.sub}</small> : null}
          </span>
          <span className="track">
            <span className="fill" style={{ width: `${it.parte * 100}%`, background: it.fundo }} />
          </span>
          <span className="num">
            {it.valor}
            <em>{it.pct}</em>
          </span>
        </button>
      ))}
    </div>
  );
}
