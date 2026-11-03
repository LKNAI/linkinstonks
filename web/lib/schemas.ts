// Contrato com o ETL (seção 10 do prompt). Espelha os JSON Schemas de `schemas/`; um teste garante que
// os dois não divergem. Todo dado é validado aqui no carregamento.
import * as z from "zod/mini";

// A CSP do site proíbe `eval`. Sem isto o zod v4 tenta compilar os schemas com `new Function` (JIT) e o
// navegador registra uma violação em toda página. Com ~1.700 registros o custo do modo interpretado é desprezível.
z.config({ jitless: true });

const nomeOuNulo = z.nullable(z.string());

import { CATEGORIAS_LIQUIDEZ, CLASSES, FAIXAS_TICKET, SEGMENTOS, TIPOS_BDR } from "@/lib/constantes";

export { CATEGORIAS_LIQUIDEZ, CLASSES, FAIXAS_TICKET, SEGMENTOS, TIPOS_BDR };

// MAJOR.MINOR (ADR 0008): campo novo sobe só o minor e não pode derrubar o site; mudar o major falha aqui de propósito.
const versaoSchema = z.string().check(z.regex(/^1\.[0-9]+$/));

export const acaoSchema = z.object({
  codigo_cvm: z.string(),
  pregao: z.string(),
  razao_social: z.string(),
  emissor: z.string(),
  cnpj: z.string(),
  setor: z.string(),
  indicador_mercado: z.string(),
  segmento: z.enum(SEGMENTOS),
  tickers: z.array(z.object({ ticker: z.string(), classe: z.enum(CLASSES), negociacao_desde: nomeOuNulo })),
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
  listagem: z.nullable(
    z.object({
      desde: nomeOuNulo,
      desde_incerto: z.boolean(),
      fonte_desde: z.nullable(z.enum(["CVM FCA", "B3"])),
      mercado: nomeOuNulo,
      segmento_cvm: nomeOuNulo,
      segmento_divergente: z.boolean(),
    }),
  ),
  liquidez: z.nullable(z.object({ categoria: z.enum(CATEGORIAS_LIQUIDEZ), criterio_texto: z.string() })),
});

export const acoesDocSchema = z.object({
  schema_version: versaoSchema,
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
  negocios_mensal: z.nullable(z.array(z.int())),
  meses_negocios_suspeitos: z.array(z.string()),
  perfil: z.nullable(
    z.object({
      faixa: z.enum(FAIXAS_TICKET),
      negocios_janela: z.int(),
      ticket_medio_janela: z.nullable(z.number()),
    }),
  ),
  volume_24m: z.int(),
  volume_mensal: z.array(z.int()),
  volume_mes_parcial: z.nullable(z.int()),
});

export const fonteVolumeSchema = z.object({
  tipo: z.enum(["mensal", "diario"]),
  arquivos: z.array(z.string()),
});

export const bdrsDocSchema = z.object({
  schema_version: versaoSchema,
  meses: z.array(z.string()),
  mes_parcial: z.nullable(z.string()),
  pagina_fonte: z.string(),
  fontes_volume: z.record(z.string(), fonteVolumeSchema),
  min_negocios_mes: z.int(),
  ticket_quartis: z.record(z.string(), z.object({ bdrs: z.int(), q1: z.number(), q3: z.number() })),
  bdrs: z.array(bdrSchema),
});

const mensalLiquidezSchema = z.object({
  dias_com_negocio: z.array(z.int()),
  negocios: z.array(z.int()),
  presenca: z.array(z.nullable(z.number())),
  quantidade: z.array(z.int()),
  ticket_medio: z.array(z.nullable(z.number())),
  volume: z.array(z.int()),
  volume_fracionario: z.array(z.int()),
  volume_medio_diario: z.array(z.int()),
});

const agregadoLiquidezSchema = z.object({
  dias_com_negocio: z.int(),
  negocios: z.int(),
  pregoes: z.int(),
  presenca: z.nullable(z.number()),
  quantidade: z.int(),
  ticket_medio: z.nullable(z.number()),
  volume: z.int(),
  volume_fracionario: z.int(),
  volume_medio_diario: z.int(),
});

const liquidezComum = {
  agregados: z.object({
    "3m": agregadoLiquidezSchema,
    "6m": agregadoLiquidezSchema,
    "12m": agregadoLiquidezSchema,
  }),
  codigo_cvm: z.string(),
  mensal: mensalLiquidezSchema,
  meses_negocios_suspeitos: z.array(z.string()),
  ultimo_pregao: nomeOuNulo,
  ultimo_preco: z.nullable(z.number()),
  volume_mes_parcial: z.nullable(z.int()),
};

const janelaResumoSchema = z.object({
  dias_com_negocio: z.int(),
  negocios: z.int(),
  pregoes: z.int(),
  presenca: z.nullable(z.number()),
  ticket_medio: z.nullable(z.number()),
  volume: z.int(),
});

export const volumeCompanhiaSchema = z.object({
  agregados: z.object({ "3m": janelaResumoSchema, "6m": janelaResumoSchema, "12m": janelaResumoSchema }),
  codigo_cvm: z.string(),
  meses_negocios_suspeitos: z.array(z.string()),
  negocios_24m: z.int(),
  pregao: z.string(),
  ticker_principal: nomeOuNulo,
  tickers: z.array(z.string()),
  ultimo_pregao: nomeOuNulo,
  volume_24m: z.int(),
  volume_mensal: z.array(z.int()),
  volume_mes_parcial: z.nullable(z.int()),
});

export const acoesResumoDocSchema = z.object({
  schema_version: versaoSchema,
  meses: z.array(z.string()),
  mes_parcial: z.nullable(z.string()),
  pregoes_mes: z.array(z.int()),
  pagina_fonte: z.string(),
  fontes_volume: z.record(z.string(), fonteVolumeSchema),
  nao_atribuido: z.object({ tickers: z.int(), volume_mensal: z.array(z.int()) }),
  companhias: z.array(volumeCompanhiaSchema),
});

export const acoesLiquidezDocSchema = z.object({
  schema_version: versaoSchema,
  meses: z.array(z.string()),
  mes_parcial: z.nullable(z.string()),
  pregoes_mes: z.array(z.int()),
  pagina_fonte: z.string(),
  fontes_volume: z.record(z.string(), fonteVolumeSchema),
  nao_atribuido: z.object({ tickers: z.int(), volume_mensal: z.array(z.int()) }),
  companhias: z.array(
    z.object({
      ...liquidezComum,
      pregao: z.string(),
      ticker_principal: nomeOuNulo,
      tickers: z.array(z.string()),
    }),
  ),
  tickers: z.array(z.object({ ...liquidezComum, historico: z.boolean(), ticker: z.string() })),
});

export const segmentosDocSchema = z.object({
  schema_version: versaoSchema,
  companhias: z.record(
    z.string(),
    z.array(
      z.object({
        segmento: z.string(),
        desde: z.string(),
        data_aproximada: z.literal(true),
        fonte: z.literal("CVM FCA"),
      }),
    ),
  ),
});

export const metaSchema = z.object({
  schema_version: versaoSchema,
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
  schema_version: versaoSchema,
  eventos: z.array(eventoSchema),
});

export type Acao = z.infer<typeof acaoSchema>;
export type Bdr = z.infer<typeof bdrSchema>;
export type VolumeCompanhia = z.infer<typeof volumeCompanhiaSchema>;
export type LiquidezCompanhia = z.infer<typeof acoesLiquidezDocSchema>["companhias"][number];
export type TrechoSegmento = z.infer<typeof segmentosDocSchema>["companhias"][string][number];
export type CategoriaLiquidez = (typeof CATEGORIAS_LIQUIDEZ)[number];
export type FaixaTicket = (typeof FAIXAS_TICKET)[number];
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
  schema_version: versaoSchema,
  companhias: z.record(z.string(), z.array(passagemSchema)),
});

export type Passagem = z.infer<typeof passagemSchema>;
