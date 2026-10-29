// Leitura dos dados publicados em TEMPO DE BUILD (generateStaticParams e páginas de detalhe).
// Lê web/public/data (copiado de data/public pelo `prebuild`), sem sair da pasta web.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ZodType } from "zod";
import {
  acoesDocSchema,
  bdrsDocSchema,
  historicoDocSchema,
  metaSchema,
  type Acao,
  type Bdr,
  type Passagem,
} from "@/lib/schemas";

const cache = new Map<string, unknown>();

export function lerPublico<T>(arquivo: string, schema: ZodType<T>): T {
  if (!cache.has(arquivo)) {
    const bruto = readFileSync(join(process.cwd(), "public", "data", arquivo), "utf8");
    cache.set(arquivo, schema.parse(JSON.parse(bruto)));
  }
  return cache.get(arquivo) as T;
}

export const todasAcoes = (): Acao[] => lerPublico("acoes.json", acoesDocSchema).companhias;
export const todosBdrs = (): { meses: string[]; mesParcial: string | null; bdrs: Bdr[] } => {
  const d = lerPublico("bdrs.json", bdrsDocSchema);
  return { meses: d.meses, mesParcial: d.mes_parcial, bdrs: d.bdrs };
};
export const historicoDe = (codigoCvm: string): Passagem[] =>
  lerPublico("acoes_historico_escrituradores.json", historicoDocSchema).companhias[codigoCvm] ?? [];
export const metaPublica = () => lerPublico("meta.json", metaSchema);

/** URL pública do site (sitemap e feed). Sobrescreva com SITE_URL ao publicar em outro domínio. */
export const SITE_URL = (process.env.SITE_URL ?? "https://linkinstonks.vercel.app").replace(/\/$/, "");
