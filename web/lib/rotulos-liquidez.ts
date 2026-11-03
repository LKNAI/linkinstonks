// Nomes das categorias de negociação. Espelhados em scripts/gen-feed.mjs (tests/unit/feed.test.ts confere).
export const ROTULO_LIQUIDEZ: Record<string, string> = {
  sem_ticker: "Sem código de negociação",
  listagem_recente: "Listagem recente",
  sem_cotacao_no_periodo: "Sem cotação no período",
  sem_negocios: "Sem negócios",
  presenca_baixa: "Presença baixa",
  presenca_media: "Presença média",
  presenca_alta: "Presença alta",
};
