// Posição de um mês passado (item 8.6), carregada sob demanda e guardada durante a sessão.
"use client";

import { useEffect, useState } from "react";
import type { Estado } from "@/lib/data";
import { formatDate, formatInt } from "@/lib/format";
import type { Kpi } from "@/lib/acoes";
import type { Acao, Bdr } from "@/lib/schemas";

export interface InfoMes {
  reconstituido: boolean;
  coletado_em: string | null;
  n: number;
}
export interface IndiceSnapshots {
  meses: { mes: string; acoes: InfoMes | null; bdrs: InfoMes | null }[];
}
export interface SnapAcoes {
  mes: string;
  reconstituido: boolean;
  coletado_em: string | null;
  acoes: Acao[];
}
export interface SnapBdrs {
  mes: string;
  reconstituido: boolean;
  coletado_em: string | null;
  meses: string[];
  bdrs: Bdr[];
}

const cache = new Map<string, Promise<unknown>>();

function buscar<T>(chave: string, f: () => Promise<T>): Promise<T> {
  let p = cache.get(chave) as Promise<T> | undefined;
  if (!p) {
    p = f();
    p.catch(() => cache.delete(chave));
    cache.set(chave, p);
  }
  return p;
}

async function json(url: string): Promise<unknown> {
  const r = await fetch(url);
  if (!r.ok)
    throw new Error(r.status === 404 ? "Não há posição guardada para este mês." : `HTTP ${r.status}`);
  return r.json();
}

export const carregarIndice = (): Promise<IndiceSnapshots> =>
  buscar("indice", () => json("/data/snapshots/index.json") as Promise<IndiceSnapshots>);

/** O snapshot só traz o que os painéis usam; o resto do formato de `acoes.json` é preenchido aqui. */
export function expandirAcoes(doc: {
  mes: string;
  reconstituido: boolean;
  coletado_em: string | null;
  companhias: {
    codigo_cvm: string;
    pregao: string;
    razao_social: string;
    emissor: string;
    cnpj: string;
    setor: string;
    segmento: Acao["segmento"];
    tickers: { ticker: string; classe: Acao["tickers"][number]["classe"] }[];
    escriturador: string | null;
    escriturador_cvm: {
      atual: string;
      inicio: string;
      inicio_aproximado: boolean;
      anterior: string | null;
      anterior_inicio: string | null;
      anterior_fim: string | null;
    } | null;
  }[];
}): SnapAcoes {
  return {
    mes: doc.mes,
    reconstituido: doc.reconstituido,
    coletado_em: doc.coletado_em,
    acoes: doc.companhias.map(({ escriturador, escriturador_cvm: cvm, tickers, ...c }) => ({
      ...c,
      indicador_mercado: "",
      tickers: tickers.map((t) => ({ ...t, negociacao_desde: null })),
      escriturador_b3: { on: escriturador, pn: null, bruto_on: "", bruto_pn: "" },
      detalhe_b3: true,
      escriturador_cvm: cvm
        ? { ...cvm, anterior_ultimo_ano: null, n_escrituradores: cvm.anterior ? 2 : 1 }
        : null,
      divergente_b3_cvm: !!cvm && !!escriturador && cvm.atual !== escriturador,
      situacao_cvm: null,
      listagem: null,
      liquidez: null,
    })),
  };
}

/** O arquivo guarda colunas + linhas para caber no orçamento; aqui volta a ser uma lista de registros. */
export function expandirLinhas(doc: unknown, lista: string): unknown {
  const { colunas, linhas, ...resto } = doc as { colunas: string[]; linhas: unknown[][] };
  return {
    ...resto,
    [lista]: linhas.map((l) => Object.fromEntries(colunas.map((c, i) => [c, l[i]]))),
  };
}

export const carregarAcoes = (mes: string): Promise<SnapAcoes> =>
  buscar(`acoes:${mes}`, async () => {
    const [bruto, { snapshotAcoesSchema }] = await Promise.all([
      json(`/data/snapshots/${mes}/acoes.json`),
      import("@/lib/schemas"),
    ]);
    return expandirAcoes(snapshotAcoesSchema.parse(expandirLinhas(bruto, "companhias")));
  });

export const carregarBdrs = (mes: string): Promise<SnapBdrs> =>
  buscar(`bdrs:${mes}`, async () => {
    const [bruto, { snapshotBdrsSchema }] = await Promise.all([
      json(`/data/snapshots/${mes}/bdrs.json`),
      import("@/lib/schemas"),
    ]);
    const d = snapshotBdrsSchema.parse(expandirLinhas(bruto, "bdrs"));
    return {
      mes: d.mes,
      reconstituido: d.reconstituido,
      coletado_em: d.coletado_em,
      meses: d.meses,
      bdrs: d.bdrs.map((b) => ({
        ...b,
        negocios_mensal: null,
        meses_negocios_suspeitos: [],
        perfil: null,
        volume_mes_parcial: null,
      })),
    };
  });

export function useSnapshot<T>(mes: string | null, carregar: (m: string) => Promise<T>): Estado<T> | null {
  const [estado, setEstado] = useState<{ mes: string; e: Estado<T> } | null>(null);
  useEffect(() => {
    if (!mes) return;
    let vivo = true;
    carregar(mes).then(
      (dados) => vivo && setEstado({ mes, e: { estado: "ok", dados } }),
      (e: unknown) =>
        vivo &&
        setEstado({ mes, e: { estado: "erro", mensagem: e instanceof Error ? e.message : String(e) } }),
    );
    return () => {
      vivo = false;
    };
  }, [mes, carregar]);
  if (!mes) return null;
  return estado?.mes === mes ? estado.e : { estado: "carregando" };
}

// --------------------------------------------------------------------------------- funções puras
export function descreverPosicao(i: {
  mes: string;
  reconstituido: boolean;
  coletado_em: string | null;
}): string {
  if (!i.reconstituido && i.coletado_em) return `posição coletada em ${formatDate(i.coletado_em)}`;
  const [a, m] = i.mes.split("-").map(Number);
  return `posição de ${formatDate(new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10))}`;
}

const sinal = (d: number) => (d > 0 ? `+${formatInt(d)}` : `\u2212${formatInt(-d)}`);

type Unidade = readonly [singular: string, plural: string];
export const UNIDADE_COMPANHIA: Unidade = ["companhia", "companhias"];
export const UNIDADE_BDR: Unidade = ["BDR", "BDRs"];

/** "+3 companhias desde então": número de hoje menos o da posição. */
export function diferenca(hoje: number, entao: number, unidade?: Unidade): string {
  const d = hoje - entao;
  if (!d) return "Igual a hoje";
  const nome = unidade ? ` ${unidade[Math.abs(d) === 1 ? 0 : 1]}` : "";
  return `${sinal(d)}${nome} desde então`;
}

const inteiro = (v: string): number | null => (/^[\d.]+$/.test(v) ? Number(v.replace(/\./g, "")) : null);

/** Nos KPIs que são contagens, troca o complemento pela diferença contra a posição atual. */
export function kpisComDiferenca(entao: readonly Kpi[], hoje: readonly Kpi[], unidade: Unidade): Kpi[] {
  return entao.map((k, i) => {
    const a = inteiro(k.valor);
    const b = hoje[i] ? inteiro(hoje[i].valor) : null;
    return a == null || b == null ? { ...k } : { ...k, sub: diferenca(b, a, i === 0 ? unidade : undefined) };
  });
}
