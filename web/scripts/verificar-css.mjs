// Sanidade do CSS publicado: toda `var(--x)` sem valor reserva precisa ter `--x` definida em algum lugar do CSS.
// Pega o caso em que o build sai com um globals.css antigo (cache) misturado com um dashboard.css novo:
// as variáveis novas ficam sem definição e a página perde o estilo sem nenhum erro de build.
// Uso: node scripts/verificar-css.mjs [pasta]   (precisa de `pnpm build`; sai com código 1 se houver variável órfã).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = process.argv[2] ?? join(aqui, "..", "out", "_next", "static");

const arquivos = [];
(function varrer(pasta) {
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) varrer(caminho);
    else if (nome.endsWith(".css")) arquivos.push(caminho);
  }
})(raiz);

if (arquivos.length === 0) {
  console.error(`Nenhum .css em ${raiz}: rode \`pnpm build\` antes.`);
  process.exit(1);
}

const css = arquivos.map((a) => readFileSync(a, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")).join("\n");

// Variáveis definidas em `style={{ "--x": ... }}` nos componentes (não aparecem no CSS).
const definidasNoJsx = ["--n"]; // ColunasEmpilhadas: número de colunas

const definidas = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]).concat(definidasNoJsx));
// `@property --x` também define; `var(--x, valor)` tem reserva e dispensa definição.
const orfas = new Map();
for (const m of css.matchAll(/var\(\s*(--[\w-]+)\s*([,)])/g)) {
  if (m[2] === "," || definidas.has(m[1])) continue;
  orfas.set(m[1], (orfas.get(m[1]) ?? 0) + 1);
}

if (orfas.size > 0) {
  console.error(`CSS com ${orfas.size} variável(is) usada(s) e nunca definida(s):`);
  for (const [nome, n] of [...orfas].sort()) console.error(`  ${nome} (${n}×)`);
  console.error("Provável cache de build antigo: apague .next e rode `pnpm build` de novo.");
  process.exit(1);
}
console.log(`CSS ok: ${arquivos.length} arquivo(s), ${definidas.size} variáveis definidas, nenhuma órfã.`);
