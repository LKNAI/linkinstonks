// Busca global: funções puras sobre o índice gerado em scripts/gen-busca.mjs. Sem biblioteca (ADR 0010).
import type { TipoItem } from "@/lib/acompanhamento";

export interface IndiceBusca {
  c: [string, string, string, string, string, string][];
  b: [string, string, string][];
  i: [string, string, string, number][];
}

export interface Resultado {
  tipo: TipoItem;
  chave: string;
  titulo: string;
  detalhe: string;
  href: string;
  nivel: number;
}

export interface Grupo {
  tipo: TipoItem;
  rotulo: string;
  itens: Resultado[];
}

interface Entrada {
  r: Omit<Resultado, "nivel">;
  codigos: string[]; // ticker, emissor, ISIN, código CVM, CNPJ
  palavras: string[];
  texto: string;
}

export const normalizar = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function entrada(r: Omit<Resultado, "nivel">, codigos: string[], nomes: string[]): Entrada {
  const texto = normalizar(nomes.join(" "));
  return { r, codigos: codigos.filter(Boolean).map((c) => normalizar(c)), palavras: texto.split(" "), texto };
}

export function prepararIndice(ind: IndiceBusca): Entrada[] {
  return [
    ...ind.c.map(([pregao, razao, emissor, cnpj, cvm, tickers]) =>
      entrada(
        {
          tipo: "companhia" as const,
          chave: cvm,
          titulo: pregao || razao,
          detalhe: [tickers.split(" ").slice(0, 3).join(" "), razao].filter(Boolean).join(" · "),
          href: `/acoes/${cvm}/`,
        },
        [...tickers.split(" "), emissor, cvm, cnpj],
        [pregao, razao],
      ),
    ),
    ...ind.b.map(([ticker, nome, isin]) =>
      entrada(
        { tipo: "bdr" as const, chave: ticker, titulo: ticker, detalhe: nome, href: `/bdrs/${ticker}/` },
        [ticker, isin],
        [nome],
      ),
    ),
    ...ind.i.map(([curto, nome, aliases, escriturador]) =>
      entrada(
        {
          tipo: "instituicao" as const,
          chave: curto,
          titulo: curto,
          detalhe: nome,
          href: escriturador
            ? `/acoes/?bank=${encodeURIComponent(curto)}`
            : `/bdrs/?dep=${encodeURIComponent(curto)}`,
        },
        [],
        [curto, nome, aliases],
      ),
    ),
  ];
}

/** Distância de edição com transposição, limitada: devolve `limite + 1` assim que passa do limite. */
export function distancia(a: string, b: string, limite: number): number {
  if (Math.abs(a.length - b.length) > limite) return limite + 1;
  let ante: number[] = [];
  let ant = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const atual = [i];
    let menor = i;
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(ant[j] + 1, atual[j - 1] + 1, ant[j - 1] + custo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, ante[j - 2] + 1);
      atual[j] = v;
      menor = Math.min(menor, v);
    }
    if (menor > limite) return limite + 1;
    ante = ant;
    ant = atual;
  }
  return ant[b.length];
}

const limiteDe = (termo: string) => (termo.length >= 7 ? 2 : 1);

/** 0 código exato · 1 prefixo de código · 2 nome pelo início das palavras · 3 trecho · 4 aproximado · null nada. */
function nivelDe(e: Entrada, q: string, termos: string[], digitos: string): number | null {
  if (e.codigos.includes(q) || (digitos && e.codigos.includes(digitos))) return 0;
  if (
    e.codigos.some((c) => c.startsWith(q)) ||
    (digitos.length >= 4 && e.codigos.some((c) => c.startsWith(digitos)))
  )
    return 1;
  if (termos.every((t) => e.palavras.some((p) => p.startsWith(t)))) return 2;
  if (e.texto.includes(q)) return 3;
  if (q.length < 4) return null;
  const perto = (t: string, alvo: string) =>
    distancia(t, alvo, limiteDe(t)) <= limiteDe(t) ||
    (alvo.length > t.length && distancia(t, alvo.slice(0, t.length), limiteDe(t)) <= limiteDe(t));
  return termos.every((t) => t.length >= 3 && [...e.palavras, ...e.codigos].some((p) => perto(t, p)))
    ? 4
    : null;
}

export const MAX_POR_GRUPO = 8;
const ROTULOS: Record<TipoItem, string> = {
  companhia: "Companhias",
  bdr: "BDRs",
  instituicao: "Instituições",
};

export function buscar(indice: readonly Entrada[], consulta: string): Grupo[] {
  const q = normalizar(consulta);
  if (!q) return [];
  const termos = q.split(" ");
  const digitos = /^[\d.\-/\s]+$/.test(consulta.trim()) ? consulta.replace(/\D/g, "") : "";
  const achados: Record<TipoItem, Resultado[]> = { companhia: [], bdr: [], instituicao: [] };
  for (const e of indice) {
    const nivel = nivelDe(e, q, termos, digitos);
    if (nivel != null) achados[e.r.tipo].push({ ...e.r, nivel });
  }
  return (Object.keys(achados) as TipoItem[])
    .filter((t) => achados[t].length)
    .map((t) => ({
      tipo: t,
      rotulo: ROTULOS[t],
      itens: achados[t]
        .sort((a, b) => a.nivel - b.nivel || a.titulo.localeCompare(b.titulo, "pt"))
        .slice(0, MAX_POR_GRUPO),
    }))
    .sort((a, b) => a.itens[0].nivel - b.itens[0].nivel);
}

// ------------------------------------------------------------------------------------------- histórico
const CHAVE_HISTORICO = "painelb3:busca:v1";
export const MAX_HISTORICO = 8;

export function lerHistorico(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_HISTORICO) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, MAX_HISTORICO) : [];
  } catch {
    return [];
  }
}

export function guardarHistorico(consulta: string): void {
  const q = consulta.trim();
  if (!q) return;
  try {
    const novo = [q, ...lerHistorico().filter((x) => x !== q)].slice(0, MAX_HISTORICO);
    localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(novo));
  } catch {
    // sem armazenamento, a busca funciona sem histórico
  }
}
