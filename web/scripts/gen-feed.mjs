// Gera public/feed.xml (Atom) a partir de data/public/eventos.json, para acompanhar mudanças por leitor de RSS.
// Determinístico: nada de relógio; a data do feed é a do evento mais recente (ou da última atualização dos dados).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROTULO_TIPO = {
  nova_listagem: "Nova listagem",
  deslistagem: "Deslistagem",
  troca_escriturador: "Troca de escriturador",
  divergencia_b3_cvm: "Divergência B3 × CVM",
  ticker_novo: "Novo ticker",
  ticker_removido: "Ticker removido",
  mudanca_segmento: "Mudança de segmento",
  novo_bdr: "Novo BDR",
  bdr_cancelado: "BDR cancelado",
  troca_depositaria: "Troca de depositária",
};

export const escaparXml = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c],
  );

const link = (siteUrl, e) => `${siteUrl}/${e.dataset === "acoes" ? "acoes" : "bdrs"}/${e.chave}/`;

export function montarFeed({ eventos, siteUrl, atualizadoEm }) {
  const base = siteUrl.replace(/\/$/, "");
  const atualizado = `${eventos[0]?.data ?? atualizadoEm}T00:00:00Z`;
  const entradas = eventos
    .map((e) => {
      const titulo = `${ROTULO_TIPO[e.tipo] ?? e.tipo}: ${e.chave}${e.de || e.para ? ` (${e.de ?? "—"} → ${e.para ?? "—"})` : ""}`;
      const id = `tag:${new URL(base).host},${e.data}:${e.dataset}/${e.tipo}/${e.chave}`;
      return `  <entry>
    <id>${escaparXml(id)}</id>
    <title>${escaparXml(titulo)}</title>
    <updated>${e.data}T00:00:00Z</updated>
    <link href="${escaparXml(link(base, e))}"/>
    <summary>${escaparXml(`${titulo}. Fonte: ${e.fonte}.`)}</summary>
  </entry>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="pt-BR">
  <id>${escaparXml(`${base}/feed.xml`)}</id>
  <title>linkinstonks: novidades</title>
  <subtitle>Trocas de escriturador, novas listagens e novos BDRs na B3</subtitle>
  <updated>${atualizado}</updated>
  <link rel="self" href="${escaparXml(`${base}/feed.xml`)}"/>
  <link href="${escaparXml(`${base}/novidades/`)}"/>
${entradas}${entradas ? "\n" : ""}</feed>
`;
}

function principal() {
  const aqui = dirname(fileURLToPath(import.meta.url));
  const pub = join(aqui, "..", "..", "data", "public");
  const destino = join(aqui, "..", "public", "feed.xml");
  if (!existsSync(join(pub, "eventos.json"))) {
    console.error("gen-feed: eventos.json não encontrado");
    process.exit(1);
  }
  const eventos = JSON.parse(readFileSync(join(pub, "eventos.json"), "utf8")).eventos;
  const meta = JSON.parse(readFileSync(join(pub, "meta.json"), "utf8"));
  const atualizadoEm =
    Object.values(meta.datasets)
      .map((d) => d.atualizado_em)
      .sort()
      .at(-1) ?? "1970-01-01";
  const siteUrl = process.env.SITE_URL ?? "https://linkinstonks.vercel.app";
  writeFileSync(destino, montarFeed({ eventos, siteUrl, atualizadoEm }));
  console.log(`gen-feed: ${eventos.length} evento(s) em public/feed.xml`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) principal();
