// Servidor estático local para os testes e2e: serve web/out aplicando os MESMOS cabeçalhos do vercel.json
// (CSP, cache...), para que os testes rodem sob a política de segurança real.
// Uso: node scripts/serve.mjs [porta]
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createGzip } from "node:zlib";
import { createServer } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, "..", "out");
const porta = Number(process.argv[2] ?? 4173);
const config = JSON.parse(readFileSync(join(aqui, "..", "vercel.json"), "utf8"));

const tipos = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".xml": "application/xml",
  ".csv": "text/csv; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
};

/** Converte "source" do vercel.json (`/(.*)`, `/data/(.*)`, `/feed.xml`) em regex. */
const regra = (source) =>
  new RegExp("^" + source.replace(/[.+?^${}|[\]\\]/g, "\\$&").replace(/\(\\?\.\*\)/g, "(.*)") + "$");
const regras = (config.headers ?? []).map((h) => ({ re: regra(h.source), headers: h.headers }));

const servidor = createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let arq = normalize(join(raiz, url));
  if (!arq.startsWith(raiz)) arq = join(raiz, "404.html");
  if (existsSync(arq) && statSync(arq).isDirectory()) {
    if (!url.endsWith("/")) {
      // trailingSlash: true no vercel.json => /acoes redireciona para /acoes/
      res.writeHead(308, { location: url + "/" });
      return res.end();
    }
    arq = join(arq, "index.html");
  }
  const achou = existsSync(arq);
  if (!achou) arq = join(raiz, "404.html");
  const cab = { "content-type": tipos[extname(arq)] ?? "application/octet-stream" };
  for (const r of regras) if (r.re.test(url)) for (const h of r.headers) cab[h.key.toLowerCase()] = h.value;
  // A Vercel comprime texto; aqui também, para que Lighthouse e tamanhos de transferência sejam fiéis.
  const comprimivel = /^(text\/|application\/(json|xml|javascript))/.test(cab["content-type"]);
  if (comprimivel && /gzip/.test(req.headers["accept-encoding"] ?? "")) {
    cab["content-encoding"] = "gzip";
    cab["vary"] = "Accept-Encoding";
    res.writeHead(achou ? 200 : 404, cab);
    createReadStream(arq).pipe(createGzip()).pipe(res);
    return;
  }
  res.writeHead(achou ? 200 : 404, cab);
  createReadStream(arq).pipe(res);
});
servidor.listen(porta, "127.0.0.1", () =>
  console.log(`serve: http://127.0.0.1:${porta} (cabeçalhos do vercel.json)`),
);
