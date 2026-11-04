// Gera public/data/search-index.json para a busca global. Roda depois do copy-data, e a build falha acima do orçamento.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

export const LIMITE_GZIP = 150 * 1024;

/** Formato compacto em arrays: o índice é baixado uma vez, na primeira abertura da busca. */
export function montarIndice(companhias, bdrs, instituicoes) {
  const reservadas = new Set(["nao-informado", "nao-identificado", "propria-empresa"]);
  return {
    c: companhias.map((c) => [
      c.pregao,
      c.razao_social,
      c.emissor ?? "",
      (c.cnpj ?? "").replace(/\D/g, ""),
      c.codigo_cvm,
      c.tickers.map((t) => t.ticker).join(" "),
    ]),
    b: bdrs.map((b) => [b.ticker, b.nome, b.isin ?? ""]),
    i: instituicoes
      .filter((i) => !reservadas.has(i.id))
      .map((i) => [
        i.nome_curto,
        i.nome,
        (i.aliases ?? []).join(" "),
        i.papeis.includes("escriturador") ? 1 : 0,
      ]),
  };
}

function principal() {
  const aqui = dirname(fileURLToPath(import.meta.url));
  const pub = join(aqui, "..", "public", "data");
  const ler = (n) => JSON.parse(readFileSync(join(pub, n), "utf8"));
  const indice = montarIndice(
    ler("acoes.json").companhias,
    ler("bdrs.json").bdrs,
    ler("instituicoes.json").instituicoes,
  );
  const texto = `${JSON.stringify(indice)}\n`;
  const gz = gzipSync(texto, { level: 9 }).length;
  if (gz > LIMITE_GZIP) {
    console.error(`gen-busca: índice com ${(gz / 1024).toFixed(0)} KB gzip; orçamento: 150 KB`);
    process.exit(1);
  }
  writeFileSync(join(pub, "search-index.json"), texto);
  console.log(
    `gen-busca: ${indice.c.length + indice.b.length + indice.i.length} itens, ${(gz / 1024).toFixed(0)} KB gzip`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) principal();
