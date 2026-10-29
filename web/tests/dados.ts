/* eslint-disable @typescript-eslint/no-explicit-any -- os testes navegam em JSON Schema arbitrário */
// Dados reais publicados pelo ETL (data/public), lidos direto do disco para os testes.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const raiz = join(__dirname, "..", "..");
export const lerJson = (...partes: string[]): unknown =>
  JSON.parse(readFileSync(join(raiz, ...partes), "utf8"));
export const publico = (arquivo: string): unknown => lerJson("data", "public", arquivo);
export const schemaJson = (nome: string): Record<string, any> =>
  lerJson("schemas", `${nome}.schema.json`) as Record<string, any>;
