// Copia data/public (contrato público do ETL) para web/public/data antes da build.
// Falha alto se a origem não existir: nunca publicar um site sem dados.
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const origem = join(aqui, "..", "..", "data", "public");
const destino = join(aqui, "..", "public", "data");

if (!existsSync(origem)) {
  console.error(`copy-data: pasta não encontrada: ${origem}`);
  process.exit(1);
}
// Orçamento de tamanho (config/indicadores.yaml): a build falha em vez de publicar dados grandes demais.
const limiteMb = Number(
  /data_public_mb:\s*(\d+)/.exec(
    readFileSync(join(aqui, "..", "..", "config", "indicadores.yaml"), "utf8"),
  )?.[1],
);
const bytes = readdirSync(origem, { recursive: true })
  .map((n) => statSync(join(origem, String(n))))
  .filter((s) => s.isFile())
  .reduce((soma, s) => soma + s.size, 0);
if (!limiteMb || bytes / 1e6 > limiteMb) {
  console.error(`copy-data: data/public tem ${(bytes / 1e6).toFixed(1)} MB; orçamento: ${limiteMb} MB`);
  process.exit(1);
}
rmSync(destino, { recursive: true, force: true });
mkdirSync(destino, { recursive: true });
cpSync(origem, destino, { recursive: true, filter: (p) => !p.endsWith(".gitkeep") });

// Posição de meses passados (item 8.6, ADR 0011): últimos meses da retenção, cada um dentro do orçamento próprio.
const cfg = readFileSync(join(aqui, "..", "..", "config", "indicadores.yaml"), "utf8");
const retencao = Number(/retencao_meses:\s*(\d+)/.exec(cfg)?.[1]);
const limiteKb = Number(/orcamento_kb_mes:\s*(\d+)/.exec(cfg)?.[1]);
const origemSnap = join(aqui, "..", "..", "data", "snapshots_site");
const meses = existsSync(origemSnap) ? readdirSync(origemSnap).sort().slice(-retencao) : [];
const indice = [];
for (const mes of meses.toReversed()) {
  const pasta = join(origemSnap, mes);
  const entrada = { mes, acoes: null, bdrs: null };
  let soma = 0;
  for (const nome of ["acoes", "bdrs"]) {
    const arq = join(pasta, `${nome}.json`);
    if (!existsSync(arq)) continue;
    const texto = readFileSync(arq, "utf8");
    soma += Buffer.byteLength(texto);
    const doc = JSON.parse(texto);
    entrada[nome] = {
      reconstituido: doc.reconstituido,
      coletado_em: doc.coletado_em,
      n: doc.linhas.length,
    };
  }
  if (soma / 1000 > limiteKb) {
    console.error(`copy-data: snapshot ${mes} tem ${(soma / 1000).toFixed(0)} KB; orçamento: ${limiteKb} KB`);
    process.exit(1);
  }
  cpSync(pasta, join(destino, "snapshots", mes), { recursive: true });
  indice.push(entrada);
}
mkdirSync(join(destino, "snapshots"), { recursive: true });
writeFileSync(join(destino, "snapshots", "index.json"), `${JSON.stringify({ meses: indice })}\n`);
console.log(
  `copy-data: ${readdirSync(destino).length} item(ns) em public/data; ${indice.length} mês(es) de snapshot`,
);
