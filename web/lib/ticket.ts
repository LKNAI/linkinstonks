// Faixas e distribuição do ticket médio dos BDRs, em funções puras. Definições em docs/metodologia.md.
import type { BdrRow } from "@/lib/bdrs";
import { FAIXA_COR } from "@/lib/palette";

export interface Quartis {
  bdrs: number;
  q1: number;
  q3: number;
}

export const ticketDoMes = (volume: number, negocios: number): number | null =>
  negocios > 0 ? Math.round((volume / negocios) * 100) / 100 : null;

/** A mesma regra de `etl/.../perfil_bdr.py`. */
export function faixaDoMes(
  volume: number,
  negocios: number,
  quartis: Quartis | undefined,
  minNegocios: number,
): string {
  const t = ticketDoMes(volume, negocios);
  if (!quartis || t == null || negocios < minNegocios) return "dados_insuficientes";
  if (t <= quartis.q1) return "ticket_baixo";
  return t > quartis.q3 ? "ticket_alto" : "intermediario";
}

const POR_DECADA = 4;

export interface BinTicket {
  de: number;
  ate: number;
  n: number;
  /** Limites em R$. */
  min: number;
  max: number;
  cor: string;
}

/** Histograma em escala logarítmica, com 4 barras por potência de 10. */
export function histogramaTicket(
  rows: readonly BdrRow[],
  mes: number,
  quartis: Quartis | undefined,
  minNegocios: number,
): {
  bins: BinTicket[];
  noCalculo: number;
  semDados: number;
  x: (reais: number) => number;
  eixo: { x: number; reais: number }[];
} {
  const tickets: number[] = [];
  for (const d of rows) {
    const n = d.negocios_mensal?.[mes] ?? 0;
    if (n >= minNegocios) tickets.push(d.volume_mensal[mes] / n);
  }
  const semDados = rows.length - tickets.length;
  if (!tickets.length) return { bins: [], noCalculo: 0, semDados, x: () => 0, eixo: [] };
  const k = (t: number) => Math.floor(Math.log10(t) * POR_DECADA);
  const kMin = Math.min(...tickets.map(k));
  const kMax = Math.max(...tickets.map(k));
  const total = kMax - kMin + 1;
  const cont: number[] = Array<number>(total).fill(0);
  for (const t of tickets) cont[k(t) - kMin]++;
  const limite = (i: number) => 10 ** (i / POR_DECADA);
  const x = (reais: number) => (Math.log10(reais) * POR_DECADA - kMin) / total;
  const bins = cont.map((n, i) => {
    const min = limite(i + kMin);
    const max = limite(i + kMin + 1);
    const centro = Math.sqrt(min * max);
    const faixa = !quartis
      ? "dados_insuficientes"
      : centro <= quartis.q1
        ? "ticket_baixo"
        : centro > quartis.q3
          ? "ticket_alto"
          : "intermediario";
    return { de: i / total, ate: (i + 1) / total, n, min, max, cor: FAIXA_COR[faixa] };
  });
  const eixo: { x: number; reais: number }[] = [];
  for (let e = Math.ceil(kMin / POR_DECADA); e <= (kMax + 1) / POR_DECADA; e++) {
    eixo.push({ x: x(10 ** e), reais: 10 ** e });
  }
  return { bins, noCalculo: tickets.length, semDados, x, eixo };
}

export function contagemFaixas(rows: readonly BdrRow[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const d of rows) {
    const f = d.perfil?.faixa;
    if (f) c[f] = (c[f] ?? 0) + 1;
  }
  return c;
}
