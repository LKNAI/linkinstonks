// Leitura dos dados publicados em TEMPO DE BUILD (generateStaticParams e páginas de detalhe).
// Lê web/public/data (copiado de data/public pelo `prebuild`), sem sair da pasta web.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ZodMiniType } from "zod/mini";
import type { FontesVolume } from "@/lib/fonte-volume";
import {
  acoesDocSchema,
  acoesLiquidezDocSchema,
  bdrsDocSchema,
  historicoDocSchema,
  metaSchema,
  relatorioSchema,
  segmentosDocSchema,
  type Acao,
  type Bdr,
  type Passagem,
  type Relatorio,
  type TrechoSegmento,
} from "@/lib/schemas";

const cache = new Map<string, unknown>();

export function lerPublico<T>(arquivo: string, schema: ZodMiniType<T>): T {
  if (!cache.has(arquivo)) {
    const bruto = readFileSync(join(process.cwd(), "public", "data", arquivo), "utf8");
    cache.set(arquivo, schema.parse(JSON.parse(bruto)));
  }
  return cache.get(arquivo) as T;
}

export const todasAcoes = (): Acao[] => lerPublico("acoes.json", acoesDocSchema).companhias;
export const todosBdrs = (): {
  meses: string[];
  mesParcial: string | null;
  bdrs: Bdr[];
  fontes: FontesVolume;
  paginaFonte: string;
  quartis: Record<string, { bdrs: number; q1: number; q3: number }>;
  minNegocios: number;
} => {
  const d = lerPublico("bdrs.json", bdrsDocSchema);
  return {
    meses: d.meses,
    mesParcial: d.mes_parcial,
    bdrs: d.bdrs,
    fontes: d.fontes_volume,
    paginaFonte: d.pagina_fonte,
    quartis: d.ticket_quartis,
    minNegocios: d.min_negocios_mes,
  };
};
/** O arquivo completo, com as séries mensais: só a build o lê; as telas de lista usam o resumo. */
export const acoesLiquidez = () => lerPublico("acoes_liquidez.json", acoesLiquidezDocSchema);
export const segmentosDe = (codigoCvm: string): TrechoSegmento[] =>
  lerPublico("acoes_historico_segmentos.json", segmentosDocSchema).companhias[codigoCvm] ?? [];
export const historicoDe = (codigoCvm: string): Passagem[] =>
  lerPublico("acoes_historico_escrituradores.json", historicoDocSchema).companhias[codigoCvm] ?? [];
/** Do mais novo para o mais antigo. */
export function todosRelatorios(): Relatorio[] {
  const pasta = join(process.cwd(), "public", "data", "relatorios");
  if (!existsSync(pasta)) return [];
  return readdirSync(pasta)
    .filter((n) => n.endsWith(".json"))
    .sort()
    .reverse()
    .map((n) => lerPublico(`relatorios/${n}`, relatorioSchema));
}
export const metaPublica = () => lerPublico("meta.json", metaSchema);

/** URL pública do site (sitemap e feed). Sobrescreva com SITE_URL ao publicar em outro domínio. */
export const SITE_URL = (process.env.SITE_URL ?? "https://linkinstonks.vercel.app").replace(/\/$/, "");
