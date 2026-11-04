// Lista de acompanhamento: fica só no localStorage deste navegador. Toda leitura e escrita é protegida:
// sem armazenamento, a função se desativa e as telas explicam o motivo.
"use client";

import { useSyncExternalStore } from "react";

export type TipoItem = "companhia" | "bdr" | "instituicao";

export interface ItemLista {
  tipo: TipoItem;
  chave: string;
  nome: string;
}

export interface Lista {
  itens: ItemLista[];
  /** Eventos com data posterior contam como novidade. */
  ultima_visita: string | null;
}

export const CHAVE = "painelb3:acompanhamento:v1";
const VAZIA: Lista = { itens: [], ultima_visita: null };

const ehItem = (x: unknown): x is ItemLista => {
  const i = x as ItemLista;
  return (
    !!i &&
    (i.tipo === "companhia" || i.tipo === "bdr" || i.tipo === "instituicao") &&
    typeof i.chave === "string" &&
    i.chave !== "" &&
    typeof i.nome === "string"
  );
};

/** Aceita só o formato esperado. Lança erro com mensagem legível, usada na importação. */
export function analisarLista(texto: string): Lista {
  let v: { itens?: unknown; ultima_visita?: unknown };
  try {
    v = JSON.parse(texto);
  } catch {
    throw new Error("O arquivo não é um JSON válido.");
  }
  if (!v || !Array.isArray(v.itens) || !v.itens.every(ehItem))
    throw new Error("O arquivo não tem o formato da lista de acompanhamento.");
  const vistos = new Set<string>();
  const itens = (v.itens as ItemLista[])
    .filter((i) => {
      const k = `${i.tipo}:${i.chave}`;
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    })
    .map(({ tipo, chave, nome }) => ({ tipo, chave, nome }));
  return { itens, ultima_visita: typeof v.ultima_visita === "string" ? v.ultima_visita : null };
}

const ouvintes = new Set<() => void>();
let bruto: string | null | undefined;
let lista = VAZIA;
let ok = true;

function sincronizar(): void {
  try {
    const atual = localStorage.getItem(CHAVE);
    ok = true;
    if (atual === bruto) return;
    bruto = atual;
    lista = atual ? analisarLista(atual) : VAZIA;
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("O arquivo")) lista = VAZIA;
    else ok = false;
  }
}

function assinar(f: () => void): () => void {
  ouvintes.add(f);
  const aoMudar = (e: StorageEvent) => {
    if (e.key === CHAVE) f();
  };
  window.addEventListener("storage", aoMudar);
  return () => {
    ouvintes.delete(f);
    window.removeEventListener("storage", aoMudar);
  };
}

function gravar(nova: Lista): boolean {
  try {
    const texto = JSON.stringify(nova);
    localStorage.setItem(CHAVE, texto);
    bruto = texto;
    lista = nova;
    ok = true;
  } catch {
    ok = false;
  }
  ouvintes.forEach((f) => f());
  return ok;
}

export function lerLista(): Lista {
  sincronizar();
  return lista;
}

export const armazenamentoDisponivel = (): boolean => {
  sincronizar();
  try {
    localStorage.setItem(`${CHAVE}:teste`, "1");
    localStorage.removeItem(`${CHAVE}:teste`);
    return true;
  } catch {
    return false;
  }
};

export const acompanha = (l: Lista, tipo: TipoItem, chave: string): boolean =>
  l.itens.some((i) => i.tipo === tipo && i.chave === chave);

export function alternar(item: ItemLista, hoje: string): boolean {
  const l = lerLista();
  return gravar(
    acompanha(l, item.tipo, item.chave)
      ? { ...l, itens: l.itens.filter((i) => !(i.tipo === item.tipo && i.chave === item.chave)) }
      : { itens: [...l.itens, item], ultima_visita: l.ultima_visita ?? hoje },
  );
}

export const substituirLista = (nova: Lista): boolean => gravar(nova);
export const marcarVisita = (hoje: string): void => {
  const l = lerLista();
  if (l.itens.length && l.ultima_visita !== hoje) gravar({ ...l, ultima_visita: hoje });
};

/** A lista atual. Vazia no servidor e na primeira renderização, para não divergir da hidratação. */
export function useLista(): Lista {
  return useSyncExternalStore(assinar, lerLista, () => VAZIA);
}

// --------------------------------------------------------------------------- eventos (funções puras)
interface EventoMin {
  data: string;
  dataset: string;
  chave: string;
  tipo: string;
  de?: string | null;
  para?: string | null;
}

const TIPOS_INSTITUICAO = new Set(["troca_escriturador", "troca_depositaria"]);

export function eventoDoItem(e: EventoMin, i: ItemLista): boolean {
  if (i.tipo === "companhia") return e.dataset === "acoes" && e.chave === i.chave;
  if (i.tipo === "bdr") return e.dataset === "bdrs" && e.chave === i.chave;
  return TIPOS_INSTITUICAO.has(e.tipo) && (e.de === i.chave || e.para === i.chave);
}

export const eventoDaLista = (e: EventoMin, l: Lista): boolean => l.itens.some((i) => eventoDoItem(e, i));

export const novidadesDaLista = <T extends EventoMin>(eventos: readonly T[], l: Lista): T[] =>
  l.ultima_visita ? eventos.filter((e) => e.data > (l.ultima_visita as string) && eventoDaLista(e, l)) : [];

export function eventosRecentes<T extends EventoMin>(
  eventos: readonly T[],
  l: Lista,
  hoje: string,
  dias = 90,
): T[] {
  const corte = new Date(`${hoje}T00:00:00Z`);
  corte.setUTCDate(corte.getUTCDate() - dias);
  const limite = corte.toISOString().slice(0, 10);
  return eventos.filter((e) => e.data >= limite && eventoDaLista(e, l));
}
