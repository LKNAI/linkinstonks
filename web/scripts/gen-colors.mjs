// Gera lib/colors.ts a partir de data/public/instituicoes.json, que por sua vez vem de config/instituicoes.yaml
// (fonte única de nomes e cores). O arquivo gerado é versionado, para o build da Vercel não depender de config/.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const origem = join(aqui, "..", "..", "data", "public", "instituicoes.json");
const destino = join(aqui, "..", "lib", "colors.ts");

if (!existsSync(origem)) {
  if (existsSync(destino)) {
    console.log("gen-colors: instituicoes.json ausente; mantendo lib/colors.ts existente");
    process.exit(0);
  }
  console.error(`gen-colors: não encontrado: ${origem}`);
  process.exit(1);
}

const { instituicoes } = JSON.parse(readFileSync(origem, "utf8"));
const ordenadas = [...instituicoes].sort((a, b) => a.nome_curto.localeCompare(b.nome_curto, "pt"));
const mapa = (campo) =>
  ordenadas
    .filter((i) => i[campo])
    .map((i) => `  ${JSON.stringify(i.nome_curto)}: ${JSON.stringify(i[campo])},`)
    .join("\n");

// Pares de marcas que se confundem lado a lado (ΔE2000 < 15). A cor base do YAML não muda: a variante só vale quando
// os dois membros aparecem no mesmo gráfico. Valores e validação em docs/design-auditoria.md (seção 5.4).
const PARES = [
  { fixo: "Banco Bradesco", ajustado: "Banco Santander", variante: "#FF493E" },
  { fixo: "Itaú Corretora", ajustado: "Itaú Unibanco", variante: "#F8AB5F" },
];

const conteudo = `// GERADO por scripts/gen-colors.mjs a partir de config/instituicoes.yaml. Não edite à mão.
/** Cor de marca de cada instituição como escriturador, pelo nome curto. */
export const COR_ESCRITURADOR: Record<string, string> = {
${mapa("cor")}
};

/** Cor usada no painel de BDRs quando difere da de escriturador (ex.: Itaú Unibanco). */
export const COR_DEPOSITARIA: Record<string, string> = {
${mapa("cor_depositaria")}
};

/** Instituição sem cor definida recebe um cinza neutro. Nunca gerar cor aleatória. */
export const COR_NEUTRA = "#A3A2B5";

export const corEscriturador = (nome: string): string => COR_ESCRITURADOR[nome] ?? COR_NEUTRA;
export const corDepositaria = (nome: string): string => COR_DEPOSITARIA[nome] ?? COR_ESCRITURADOR[nome] ?? COR_NEUTRA;

/** Pares de marcas que se confundem lado a lado; a variante de \`ajustado\` vale só se \`fixo\` está no mesmo gráfico. */
const PARES_CONFUSOS = ${JSON.stringify(PARES, null, 2)} as const;

/** Cor de cada instituição de UM gráfico: a de marca, com a variante quando o par confuso aparece junto. */
export function coresDoConjunto(nomes: readonly string[]): (nome: string) => string {
  const presentes = new Set(nomes);
  const variantes = new Map<string, string>();
  for (const p of PARES_CONFUSOS) if (presentes.has(p.fixo) && presentes.has(p.ajustado)) variantes.set(p.ajustado, p.variante);
  return (nome) => variantes.get(nome) ?? corEscriturador(nome);
}
`;
writeFileSync(destino, conteudo);
console.log(`gen-colors: ${ordenadas.length} instituições`);
