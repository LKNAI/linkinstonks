// Copia data/public (contrato público do ETL) para web/public/data antes da build.
// Falha alto se a origem não existir: nunca publicar um site sem dados.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const origem = join(aqui, "..", "..", "data", "public");
const destino = join(aqui, "..", "public", "data");

if (!existsSync(origem)) {
  console.error(`copy-data: pasta não encontrada: ${origem}`);
  process.exit(1);
}
rmSync(destino, { recursive: true, force: true });
mkdirSync(destino, { recursive: true });
cpSync(origem, destino, { recursive: true, filter: (p) => !p.endsWith(".gitkeep") });
console.log(`copy-data: ${readdirSync(destino).length} item(ns) em public/data`);
