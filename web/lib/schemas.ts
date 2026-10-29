// Contrato com o ETL (seção 10 do prompt). Espelha os JSON Schemas de `schemas/`; um teste garante que
// os dois não divergem. Todo dado é validado aqui no carregamento.
import { z } from "zod";

// A CSP do site proíbe `eval`. Sem isto o zod v4 tenta compilar os schemas com `new Function` (JIT) e o
// navegador registra uma violação em toda página. Com ~1.700 registros o custo do modo interpretado é desprezível.
z.config({ jitless: true });

const nomeOuNulo = z.string().nullable();

export const SEGMENTOS = ["NM", "N2", "N1", "MP", "B", "SO", "BN", "?"] as const;
export const CLASSES = ["ON", "PN", "PNA", "PNB", "PNC", "PND", "Units", "Outros"] as const;
export const TIPOS_BDR = ["DRN", "DRE", "DR1", "DR2", "DR3"] as const;

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
  escriturador_cvm: z
    .object({
      atual: z.string(),
      inicio: z.string(),
      inicio_aproximado: z.boolean(),
      anterior: nomeOuNulo,
      anterior_inicio: nomeOuNulo,
      anterior_fim: nomeOuNulo,
      anterior_ultimo_ano: z.number().int().nullable(),
      n_escrituradores: z.number().int(),
    })
    .nullable(),
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
  primeiro_pregao: z.string().nullable(),
  ultimo_pregao: z.string(),
  ultimo_preco: z.number(),
  negocios_24m: z.number().int(),
  volume_24m: z.number().int(),
  volume_mensal: z.array(z.number().int()),
  volume_mes_parcial: z.number().int().nullable(),
});

export const bdrsDocSchema = z.object({
  schema_version: z.literal(1),
  meses: z.array(z.string()),
  mes_parcial: z.string().nullable(),
  bdrs: z.array(bdrSchema),
});

export const metaSchema = z.object({
  schema_version: z.literal(1),
  datasets: z.record(z.string(), z.object({ atualizado_em: z.string(), contagem: z.number().int() })),
  fontes: z.record(
    z.string(),
    z.object({
      status: z.enum(["ok", "desatualizado", "erro"]),
      ultimo_sucesso: z.string().nullable(),
      contagem: z.number().int().optional(),
      ultimo_pregao: z.string().optional(),
      mensagem: z.string().optional(),
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
export type Meta = z.infer<typeof metaSchema>;
export type Evento = z.infer<typeof eventoSchema>;

export const passagemSchema = z.object({
  instituicao: z.string(),
  inicio: nomeOuNulo,
  inicio_aproximado: z.boolean(),
  fim: nomeOuNulo,
  primeiro_ano: z.number().int(),
  ultimo_ano: z.number().int(),
  fonte: z.string(),
});

export const historicoDocSchema = z.object({
  schema_version: z.literal(1),
  companhias: z.record(z.string(), z.array(passagemSchema)),
});

export type Passagem = z.infer<typeof passagemSchema>;
