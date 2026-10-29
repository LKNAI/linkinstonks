// Rastreabilidade do volume: cada valor mensal de BDR aponta para o arquivo oficial da B3 (COTAHIST) de onde veio.
// O ETL grava, por mês, o tipo da fonte e as URLs (`fontes_volume` em bdrs.json); aqui só se escolhe o link.

export interface FonteMes {
  tipo: "mensal" | "diario";
  arquivos: string[];
}
export type FontesVolume = Record<string, FonteMes>;

/**
 * Para onde vai o clique num volume mensal: o arquivo mensal oficial (`COTAHIST_MMAAAA.ZIP`). No mês corrente
 * (parcial) o volume é a soma de vários arquivos diários, então o link vai à página oficial de séries históricas
 * da B3, e os arquivos diários ficam listados no bloco "Fonte do volume".
 */
export function linkDoMes(fontes: FontesVolume, mes: string, pagina: string): string {
  const f = fontes[mes];
  return f && f.tipo === "mensal" && f.arquivos.length === 1 ? f.arquivos[0] : pagina;
}

export const nomeDoArquivo = (url: string): string => url.split("/").pop() ?? url;

/** Descrição curta da origem de um mês, para dicas e tabelas. */
export function origemDoMes(fontes: FontesVolume, mes: string): string {
  const f = fontes[mes];
  if (!f) return "B3 · COTAHIST";
  return f.tipo === "mensal"
    ? `B3 · ${nomeDoArquivo(f.arquivos[0])}`
    : `B3 · ${f.arquivos.length} arquivos diários (mês parcial)`;
}

/** Como o leitor reproduz o número a partir do arquivo oficial (posições do layout COTAHIST, seção 7.4 do prompt). */
export function comoConferir(ticker: string): string {
  return (
    `Abra o arquivo, localize as linhas cujo código de negociação (CODNEG, colunas 13 a 24) é ${ticker} ` +
    `ou ${ticker}F e some o campo VOLTOT (colunas 171 a 188, em centavos) dos mercados 010 (vista) e 020 ` +
    "(fracionário), em todos os pregões do mês."
  );
}
