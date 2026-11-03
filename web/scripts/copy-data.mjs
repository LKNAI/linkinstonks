// Copia data/public (contrato público do ETL) para web/public/data antes da build.
// Falha alto se a origem não existir: nunca publicar um site sem dados.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
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
console.log(`copy-data: ${readdirSync(destino).length} item(ns) em public/data`);
