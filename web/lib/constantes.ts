// Constantes do contrato fora de `schemas.ts`: assim o zod não entra no JS inicial (ver `lib/data.ts`).
export const SEGMENTOS = ["NM", "N2", "N1", "MP", "B", "SO", "BN", "?"] as const;
export const CLASSES = ["ON", "PN", "PNA", "PNB", "PNC", "PND", "Units", "Outros"] as const;
export const TIPOS_BDR = ["DRN", "DRE", "DR1", "DR2", "DR3"] as const;
export const CATEGORIAS_LIQUIDEZ = [
  "sem_ticker",
  "listagem_recente",
  "sem_cotacao_no_periodo",
  "sem_negocios",
  "presenca_baixa",
  "presenca_media",
  "presenca_alta",
] as const;
export const FAIXAS_TICKET = ["ticket_baixo", "intermediario", "ticket_alto", "dados_insuficientes"] as const;
