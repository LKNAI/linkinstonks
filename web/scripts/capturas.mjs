// Captura de tela do build estático (web/out) em 1440 px e 390 px, para a revisão da Fase 4.
// Uso: pnpm build && node scripts/capturas.mjs [pasta-de-saida]
import { chromium } from "@playwright/test";
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, "..", "out");
const saida = process.argv[2] ?? join(aqui, "..", "..", "docs", "capturas");
mkdirSync(saida, { recursive: true });

const tipos = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
};
const servidor = createServer((req, res) => {
  const url = new URL(req.url, "http://x").pathname;
  let arq = normalize(join(raiz, decodeURIComponent(url)));
  if (existsSync(arq) && statSync(arq).isDirectory()) arq = join(arq, "index.html");
  if (!existsSync(arq)) arq = join(raiz, "404.html");
  res.writeHead(arq.endsWith("404.html") ? 404 : 200, {
    "content-type": tipos[extname(arq)] ?? "application/octet-stream",
  });
  createReadStream(arq).pipe(res);
}).listen(0);
const porta = servidor.address().port;

const rotas = [
  ["capa", "/"],
  ["acoes", "/acoes/"],
  ["bdrs", "/bdrs/"],
  ["acao-detalhe", "/acoes/9512/"],
  ["bdr-detalhe", "/bdrs/TSLA34/"],
  ["instituicoes", "/instituicoes/"],
  ["novidades", "/novidades/"],
  ["status", "/status/"],
  ["sobre", "/sobre/"],
  ["design", "/design/"],
];
const telas = [
  ["1440", { width: 1440, height: 900 }],
  ["390", { width: 390, height: 844 }],
];

const navegador = await chromium.launch();
let erros = 0;
for (const [tela, viewport] of telas) {
  const ctx = await navegador.newContext({ viewport, deviceScaleFactor: 1 });
  for (const [nome, rota] of rotas) {
    const pagina = await ctx.newPage();
    const problemas = [];
    pagina.on("console", (m) => m.type() === "error" && problemas.push(m.text()));
    pagina.on("pageerror", (e) => problemas.push(e.message));
    pagina.on("response", (r) => r.status() === 404 && problemas.push(`404 ${r.url()}`));
    await pagina.goto(`http://127.0.0.1:${porta}${rota}`, { waitUntil: "networkidle" });
    await pagina.waitForSelector(".kpi, .dtable, .stats-table, .prose, .state, .tl, .mcols, .dl", {
      timeout: 15000,
    });
    await pagina.waitForTimeout(600);
    const larg = await pagina.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    await pagina.screenshot({ path: join(saida, `${nome}-${tela}.png`), fullPage: true });
    console.log(
      `${nome}-${tela}.png  rolagem horizontal: ${larg[0] > larg[1] ? `SIM (${larg[0]} > ${larg[1]})` : "não"}  erros de console: ${problemas.length}`,
    );
    problemas.forEach((p) => console.log("   ", p.slice(0, 200)));
    erros += problemas.length;
    await pagina.close();
  }
  await ctx.close();
}
await navegador.close();
servidor.close();
process.exit(erros ? 1 : 0);
