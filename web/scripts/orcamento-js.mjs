// Orçamento de JavaScript: o JS inicial de cada rota (scripts referenciados no HTML) deve ter <= 200 KB gzip.
// Uso: node scripts/orcamento-js.mjs [--json]   (precisa de `pnpm build`; sai com código 1 se estourar).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const aqui = dirname(fileURLToPath(import.meta.url));
const out = join(aqui, "..", "out");
const LIMITE = 200 * 1024;

const htmls = [];
(function varrer(pasta) {
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) varrer(caminho);
    else if (nome === "index.html" || nome === "404.html") htmls.push(caminho);
  }
})(out);

const cacheGz = new Map();
const gz = (src) => {
  const arq = join(out, src.split("?")[0]);
  if (!cacheGz.has(arq)) cacheGz.set(arq, gzipSync(readFileSync(arq), { level: 9 }).length);
  return cacheGz.get(arq);
};

// Rotas agrupadas pelo padrão (/acoes/[codigoCvm] e /bdrs/[ticker] têm milhares de páginas iguais).
const grupos = new Map();
for (const html of htmls) {
  const rota =
    "/" +
    relative(out, html)
      .split(sep)
      .join("/")
      .replace(/index\.html$/, "");
  const chave = rota
    .replace(/^\/acoes\/[^/]+\/$/, (m) => (m === "/acoes/tabela/" ? m : "/acoes/[codigoCvm]/"))
    .replace(/^\/bdrs\/[^/]+\/$/, "/bdrs/[ticker]/");
  const scripts = [
    ...new Set(
      [...readFileSync(html, "utf8").matchAll(/<script[^>]+src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]),
    ),
  ];
  const total = scripts.reduce((s, src) => s + gz(src), 0);
  const atual = grupos.get(chave);
  if (!atual || total > atual.total) grupos.set(chave, { total, scripts: scripts.length });
}

const linhas = [...grupos].sort((a, b) => b[1].total - a[1].total);
const estouros = linhas.filter(([, v]) => v.total > LIMITE);
if (process.argv.includes("--json")) {
  console.log(JSON.stringify(Object.fromEntries(linhas.map(([r, v]) => [r, v.total])), null, 2));
} else {
  console.log("rota".padEnd(26), "JS gzip".padStart(10), "arquivos".padStart(9));
  for (const [rota, v] of linhas)
    console.log(
      rota.padEnd(26),
      `${(v.total / 1024).toFixed(1)} KB`.padStart(10),
      String(v.scripts).padStart(9),
    );
  console.log(
    `\nlimite: ${LIMITE / 1024} KB gzip por rota; ${estouros.length ? "ESTOUROU em " + estouros.map(([r]) => r).join(", ") : "todas dentro do orçamento"}`,
  );
}
process.exit(estouros.length ? 1 : 0);
