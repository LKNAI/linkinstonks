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

// Espelha SEGMENTO_NOME de lib/palette.ts (este script roda no Node puro, sem o TypeScript); tests/unit/feed.test.ts confere.
export const SEGMENTO_NOME = {
  NM: "Novo Mercado",
  N2: "Nível 2",
  N1: "Nível 1",
  MP: "Bovespa Mais",
  B: "Tradicional",
  SO: "Balcão organizado (SOMA)",
  BN: "Balcão não organizado",
  "?": "Sem dados",
};

/** Nome do item: ações pelo nome de pregão (código CVM → ARANDU); BDRs pelo ticker. Mesma regra de lib/rotulos.ts. */
/** @param {{ dataset: string, chave: string, tipo: string, de?: string | null }} e
 * @param {{ codigo_cvm: string, pregao: string, razao_social: string }[]} [acoes] */
export function nomeDoItem(e, acoes = []) {
  if (e.dataset !== "acoes") return e.chave;
  const a = acoes.find((c) => c.codigo_cvm === e.chave);
  if (a) return a.pregao || a.razao_social;
  if (e.tipo === "deslistagem" && e.de) return e.de;
  return `CVM ${e.chave}`;
}

/** "Novo Mercado → Tradicional" na mudança de segmento; "de → para" nos demais; null sem detalhe. */
export function mudancaDoEvento(e) {
  if (!e.de && !e.para) return null;
  if (e.tipo === "mudanca_segmento") {
    const seg = (x) => (x == null ? "—" : (SEGMENTO_NOME[x] ?? x));
    return `${seg(e.de)} → ${seg(e.para)}`;
  }
  if (e.tipo === "deslistagem") return null;
  return `${e.de ?? "—"} → ${e.para ?? "—"}`;
}

export const escaparXml = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c],
  );

const link = (siteUrl, e) => `${siteUrl}/${e.dataset === "acoes" ? "acoes" : "bdrs"}/${e.chave}/`;

/** @param {{ eventos: any[], siteUrl: string, atualizadoEm: string, acoes?: { codigo_cvm: string, pregao: string, razao_social: string }[] }} args */
export function montarFeed({ eventos, siteUrl, atualizadoEm, acoes = [] }) {
  const base = siteUrl.replace(/\/$/, "");
  const atualizado = `${eventos[0]?.data ?? atualizadoEm}T00:00:00Z`;
  const entradas = eventos
    .map((e) => {
      const mudanca = mudancaDoEvento(e);
      const titulo = `${ROTULO_TIPO[e.tipo] ?? e.tipo}: ${nomeDoItem(e, acoes)}${mudanca ? ` (${mudanca})` : ""}`;
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
  const acoes = existsSync(join(pub, "acoes.json"))
    ? JSON.parse(readFileSync(join(pub, "acoes.json"), "utf8")).companhias
    : [];
  const atualizadoEm =
    Object.values(meta.datasets)
      .map((d) => d.atualizado_em)
      .sort()
      .at(-1) ?? "1970-01-01";
  const siteUrl = process.env.SITE_URL ?? "https://linkinstonks.vercel.app";
  writeFileSync(destino, montarFeed({ eventos, siteUrl, atualizadoEm, acoes }));
  console.log(`gen-feed: ${eventos.length} evento(s) em public/feed.xml`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) principal();
