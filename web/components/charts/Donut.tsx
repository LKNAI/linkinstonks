"use client";

import type { ReactNode } from "react";
import { formatInt, formatPct } from "@/lib/format";
import { TipConteudo, useTip } from "./Tooltip";

export interface FatiaDonut {
  k: string;
  label: string;
  n: number;
  color: string;
  extra?: [string, string][];
}

/** Caminho SVG de uma fatia de anel entre os ângulos `s` e `e` (radianos). */
export function caminhoFatia(
  cx: number,
  cy: number,
  R: number,
  r: number,
  s: number,
  e: number,
  cheia: boolean,
): string {
  if (cheia)
    return `M${cx} ${cy - R}A${R} ${R} 0 1 1 ${cx - 0.01} ${cy - R}L${cx - 0.01} ${cy - r}A${r} ${r} 0 1 0 ${cx} ${cy - r}Z`;
  const lg = e - s > Math.PI ? 1 : 0;
  const p = (rad: number, a: number): [number, number] => [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
  const [x0, y0] = p(R, s);
  const [x1, y1] = p(R, e);
  const [x2, y2] = p(r, e);
  const [x3, y3] = p(r, s);
  return `M${x0} ${y0}A${R} ${R} 0 ${lg} 1 ${x1} ${y1}L${x2} ${y2}A${r} ${r} 0 ${lg} 0 ${x3} ${y3}Z`;
}

/** O número central encolhe quando o texto (ex.: "R$ 538 bi") não cabe no buraco do anel. */
export function tamanhoCentro(texto: string, tamanho: number): number {
  const buraco = tamanho * 0.62 * 0.9;
  return Math.min(28, Math.floor(buraco / (texto.length * 0.58)));
}

export function Donut({
  itens,
  selecionado,
  onSelecionar,
  centro,
  rotuloValor,
  formatar = formatInt,
  tamanho = 190,
  empilhado = false,
  rotuloAria,
}: {
  itens: FatiaDonut[];
  selecionado: string | null;
  onSelecionar: (k: string) => void;
  /** Texto pequeno no centro ("empresas", "volume 24m"). */
  centro: string;
  /** Rótulo do valor no tooltip ("Empresas", "BDRs", "Volume"). */
  rotuloValor: string;
  formatar?: (n: number) => string;
  tamanho?: number;
  empilhado?: boolean;
  rotuloAria: string;
}) {
  const tip = useTip();
  const R = tamanho / 2;
  const r = R * 0.62;
  const soma = itens.reduce((a, i) => a + i.n, 0) || 1;
  const ativos = itens.filter((i) => i.n).length;
  const gap = ativos > 1 ? 0.012 : 0;
  const sel = itens.find((i) => i.k === selecionado);
  const fatias = itens.map((it, i) => {
    if (!it.n) return null;
    const a0 = -Math.PI / 2 + (itens.slice(0, i).reduce((acc, x) => acc + x.n, 0) / soma) * 2 * Math.PI;
    const fr = it.n / soma;
    const a1 = a0 + fr * 2 * Math.PI;
    let s = a0 + gap / 2;
    let e = a1 - gap / 2;
    if (e <= s) [s, e] = [a0, a1];
    return { it, d: caminhoFatia(R, R, R, r, s, e, fr >= 0.9999) };
  });
  const valorCentro = sel ? sel.n : soma;
  const rotCentro = sel ? formatPct(sel.n, soma) : centro;
  const conteudoDica = (it: FatiaDonut): ReactNode => (
    <TipConteudo
      titulo={it.label}
      cor={it.color}
      linhas={[[rotuloValor, formatar(it.n)], ["Participação", formatPct(it.n, soma)], ...(it.extra ?? [])]}
    />
  );
  const dica = (it: FatiaDonut) => () => conteudoDica(it);
  return (
    <div className={`donut${empilhado ? " stack" : ""}${selecionado != null ? " has-sel" : ""}`}>
      <svg
        width={tamanho}
        height={tamanho}
        viewBox={`0 0 ${tamanho} ${tamanho}`}
        role="img"
        aria-label={rotuloAria}
      >
        <title>{rotuloAria}</title>
        {fatias.map(
          (f) =>
            f && (
              <path
                key={f.it.k}
                d={f.d}
                fill={f.it.color}
                stroke="#fff"
                strokeWidth={1.5}
                className={selecionado === f.it.k ? "sel" : ""}
                onClick={() => onSelecionar(f.it.k)}
                {...tip(dica(f.it))}
              />
            ),
        )}
        <text
          className="ctr-n"
          x={R}
          y={R + 4}
          textAnchor="middle"
          style={{ fontSize: tamanhoCentro(formatar(valorCentro), tamanho) }}
        >
          {formatar(valorCentro)}
        </text>
        <text className="ctr-l" x={R} y={R + 22} textAnchor="middle">
          {rotCentro}
        </text>
      </svg>
      <div
        className={`lg${selecionado != null ? " has-sel" : ""}`}
        role="group"
        aria-label={`Filtrar por ${rotuloAria.toLowerCase()}`}
      >
        {itens.map((it) => (
          <button
            key={it.k}
            type="button"
            className={selecionado === it.k ? "sel" : ""}
            aria-pressed={selecionado === it.k}
            onClick={() => onSelecionar(it.k)}
            {...tip(dica(it))}
          >
            <span className="sq" style={{ background: it.color }} />
            <span className="nm" title={it.label}>
              {it.label}
            </span>
            <span className="n">{formatar(it.n)}</span>
            <span className="pc">{formatPct(it.n, soma)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
