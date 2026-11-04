// Lógica do mapa de calor de BDRs, em funções puras. Definições em docs/metodologia.md.
import type { BdrRow } from "@/lib/bdrs";
import { CELULA_SEM_NEGOCIOS, CELULA_SEM_REFERENCIA, type Celula } from "@/components/charts/celulas";

export const PASSOS_INTENSIDADE = 7;
/** A escala de variação vai de ×0,25 a ×4; perto de ×1 a célula fica neutra. */
export const LIMITE_VARIACAO = 4;
const NEUTRO_LOG = 0.12;
const PASSOS_VARIACAO = 3;
const MESES_REFERENCIA = 12;

export type ModoMapa = "intensidade" | "variacao";
export type OrdemMapa = "volume" | "tendencia" | "alfabetica" | "pico";

/** 1 a 7, do menor ao maior em relação ao pico do próprio BDR. Nível 1 ainda é mês com negócio. */
export function celulasIntensidade(volumes: readonly number[]): Celula[] {
  const pico = Math.max(0, ...volumes);
  return volumes.map((v) =>
    v <= 0
      ? CELULA_SEM_NEGOCIOS
      : Math.min(PASSOS_INTENSIDADE, Math.floor((v / pico) * PASSOS_INTENSIDADE) + 1),
  );
}

export function mediaAnterior(volumes: readonly number[], i: number): number | null {
  if (i < MESES_REFERENCIA) return null;
  const m = volumes.slice(i - MESES_REFERENCIA, i).reduce((a, b) => a + b, 0) / MESES_REFERENCIA;
  return m > 0 ? m : null;
}

/** De -3 (frio) a 3 (quente); 0 perto de ×1. Mês sem os 12 anteriores não tem referência. */
export function celulaVariacao(volumes: readonly number[], i: number): Celula {
  const media = mediaAnterior(volumes, i);
  if (media == null) return CELULA_SEM_REFERENCIA;
  if (volumes[i] <= 0) return CELULA_SEM_NEGOCIOS;
  const r = Math.log(volumes[i] / media) / Math.log(LIMITE_VARIACAO);
  const a = Math.min(1, Math.abs(r));
  if (a < NEUTRO_LOG) return 0;
  return (
    Math.sign(r) *
    Math.min(PASSOS_VARIACAO, Math.floor(((a - NEUTRO_LOG) / (1 - NEUTRO_LOG)) * PASSOS_VARIACAO) + 1)
  );
}

/** Índices dos meses visíveis: a variação só existe depois dos 12 primeiros. */
export function indicesDosMeses(total: number, modo: ModoMapa, janela: 12 | 24): number[] {
  const inicio = modo === "variacao" || janela === 12 ? Math.max(0, total - 12) : 0;
  return Array.from({ length: total - inicio }, (_, i) => inicio + i);
}

/** Média dos últimos 6 meses ÷ média dos 6 anteriores. Sem base, fica depois dos que têm. */
export function tendencia(volumes: readonly number[]): number {
  const n = volumes.length;
  const soma = (a: number, b: number) => volumes.slice(a, b).reduce((x, y) => x + y, 0);
  const antes = soma(n - 12, n - 6);
  const agora = soma(n - 6, n);
  return antes > 0 ? agora / antes : agora > 0 ? Number.MAX_SAFE_INTEGER : -1;
}

export function mesDoPico(volumes: readonly number[]): number {
  return volumes.reduce((m, v, i) => (v > volumes[m] ? i : m), 0);
}

export function ordenarMapa(rows: readonly BdrRow[], ordem: OrdemMapa): BdrRow[] {
  const porVolume = (a: BdrRow, b: BdrRow) => b.tot - a.tot || a.ticker.localeCompare(b.ticker);
  const cmp: Record<OrdemMapa, (a: BdrRow, b: BdrRow) => number> = {
    volume: porVolume,
    tendencia: (a, b) => tendencia(b.volume_mensal) - tendencia(a.volume_mensal) || porVolume(a, b),
    alfabetica: (a, b) => a.ticker.localeCompare(b.ticker),
    pico: (a, b) => mesDoPico(b.volume_mensal) - mesDoPico(a.volume_mensal) || porVolume(a, b),
  };
  return [...rows].sort(cmp[ordem]);
}

/** Os N maiores por volume, reordenados: o seletor de linhas vale sempre sobre os maiores. */
export function linhasDoMapa(rows: readonly BdrRow[], n: number | null, ordem: OrdemMapa): BdrRow[] {
  const maiores = ordenarMapa(rows, "volume");
  return ordenarMapa(n == null ? maiores : maiores.slice(0, n), ordem);
}

const mult = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

/** O valor da escala, em texto, para o tooltip e o leitor de tela. */
export function textoEscala(volumes: readonly number[], i: number, modo: ModoMapa): string {
  if (volumes[i] <= 0) return "sem negócios";
  if (modo === "intensidade") {
    const pico = Math.max(...volumes);
    return `${Math.round((volumes[i] / pico) * 100)}% do pico do BDR`;
  }
  const media = mediaAnterior(volumes, i);
  return media == null
    ? "sem os 12 meses anteriores"
    : `×${mult.format(volumes[i] / media)} a média de 12 meses`;
}
