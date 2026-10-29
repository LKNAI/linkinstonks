// Contrato com o ETL (seção 10 do prompt). Espelha os JSON Schemas de `schemas/`; um teste garante que
// os dois não divergem. Todo dado é validado aqui no carregamento.
import * as z from "zod/mini";

// A CSP do site proíbe `eval`. Sem isto o zod v4 tenta compilar os schemas com `new Function` (JIT) e o
// navegador registra uma violação em toda página. Com ~1.700 registros o custo do modo interpretado é desprezível.
z.config({ jitless: true });

const nomeOuNulo = z.nullable(z.string());

import { CLASSES, SEGMENTOS, TIPOS_BDR } from "@/lib/constantes";

export { CLASSES, SEGMENTOS, TIPOS_BDR };

export const acaoSchema = z.object({
  codigo_cvm: z.string(),
  pregao: z.string(),
  razao_social: z.string(),
  emissor: z.string(),
  cnpj: z.string(),
  setor: z.string(),
  indicador_mercado: z.string(),
  segmento: z.enum(SEGMENTOS),
  tickers: z.array(z.object({ ticker: z.string(), classe: z.enum(CLASSES) })),
  escriturador_b3: z.object({
    on: nomeOuNulo,
    pn: nomeOuNulo,
    bruto_on: z.string(),
    bruto_pn: z.string(),
  }),
  detalhe_b3: z.boolean(),
  escriturador_cvm: z.nullable(
    z.object({
      atual: z.string(),
      inicio: z.string(),
      inicio_aproximado: z.boolean(),
      anterior: nomeOuNulo,
      anterior_inicio: nomeOuNulo,
      anterior_fim: nomeOuNulo,
      anterior_ultimo_ano: z.nullable(z.int()),
      n_escrituradores: z.int(),
    }),
  ),
  divergente_b3_cvm: z.boolean(),
  situacao_cvm: nomeOuNulo,
});

export const acoesDocSchema = z.object({
  schema_version: z.literal(1),
  companhias: z.array(acaoSchema),
});

export const bdrSchema = z.object({
  ticker: z.string(),
  nome: z.string(),
  tipo: z.enum(TIPOS_BDR),
  isin: z.string(),
  depositaria: z.string(),
  fonte_depositaria: z.string(),
  categoria: z.string(),
  qualificado: z.boolean(),
  primeiro_pregao: z.nullable(z.string()),
  ultimo_pregao: z.string(),
  ultimo_preco: z.number(),
  negocios_24m: z.int(),
  volume_24m: z.int(),
  volume_mensal: z.array(z.int()),
  volume_mes_parcial: z.nullable(z.int()),
});

export const fonteVolumeSchema = z.object({
  tipo: z.enum(["mensal", "diario"]),
  arquivos: z.array(z.string()),
});

export const bdrsDocSchema = z.object({
  schema_version: z.literal(1),
  meses: z.array(z.string()),
  mes_parcial: z.nullable(z.string()),
  pagina_fonte: z.string(),
  fontes_volume: z.record(z.string(), fonteVolumeSchema),
  bdrs: z.array(bdrSchema),
});

export const volumeCompanhiaSchema = z.object({
  codigo_cvm: z.string(),
  pregao: z.string(),
  tickers: z.array(z.string()),
  negocios_24m: z.int(),
  volume_24m: z.int(),
  volume_mensal: z.array(z.int()),
  volume_mes_parcial: z.nullable(z.int()),
});

export const acoesVolumeDocSchema = z.object({
  schema_version: z.literal(1),
  meses: z.array(z.string()),
  mes_parcial: z.nullable(z.string()),
  pagina_fonte: z.string(),
  fontes_volume: z.record(z.string(), fonteVolumeSchema),
  nao_atribuido: z.object({ tickers: z.int(), volume_mensal: z.array(z.int()) }),
  companhias: z.array(volumeCompanhiaSchema),
});

export const metaSchema = z.object({
  schema_version: z.literal(1),
  datasets: z.record(z.string(), z.object({ atualizado_em: z.string(), contagem: z.int() })),
  fontes: z.record(
    z.string(),
    z.object({
      status: z.enum(["ok", "desatualizado", "erro"]),
      ultimo_sucesso: z.nullable(z.string()),
      contagem: z.optional(z.int()),
      ultimo_pregao: z.optional(z.string()),
      mensagem: z.optional(z.string()),
    }),
  ),
});

export const eventoSchema = z.object({
  data: z.string(),
  dataset: z.enum(["acoes", "bdrs"]),
  tipo: z.string(),
  chave: z.string(),
  de: nomeOuNulo,
  para: nomeOuNulo,
  fonte: z.string(),
});

export const eventosDocSchema = z.object({
  schema_version: z.literal(1),
  eventos: z.array(eventoSchema),
});

export type Acao = z.infer<typeof acaoSchema>;
export type Bdr = z.infer<typeof bdrSchema>;
export type VolumeCompanhia = z.infer<typeof volumeCompanhiaSchema>;
export type Meta = z.infer<typeof metaSchema>;
export type Evento = z.infer<typeof eventoSchema>;

export const passagemSchema = z.object({
  instituicao: z.string(),
  inicio: nomeOuNulo,
  inicio_aproximado: z.boolean(),
  fim: nomeOuNulo,
  primeiro_ano: z.int(),
  ultimo_ano: z.int(),
  fonte: z.string(),
});

export const historicoDocSchema = z.object({
  schema_version: z.literal(1),
  companhias: z.record(z.string(), z.array(passagemSchema)),
});

export type Passagem = z.infer<typeof passagemSchema>;
