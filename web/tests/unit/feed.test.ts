import { describe, expect, it } from "vitest";
import { escaparXml, montarFeed } from "../../scripts/gen-feed.mjs";

const evento = (p: Record<string, unknown> = {}) => ({
  data: "2026-10-29",
  dataset: "acoes",
  tipo: "troca_escriturador",
  chave: "9512",
  de: "Banco Bradesco",
  para: "Itaú Corretora",
  fonte: "CVM",
  ...p,
});

describe("feed Atom", () => {
  it("escapa caracteres especiais do XML", () => {
    expect(escaparXml("A & B <c> \"d\" 'e'")).toBe("A &amp; B &lt;c&gt; &quot;d&quot; &apos;e&apos;");
  });

  it("sem eventos gera um feed válido e vazio, com a data de atualização dos dados", () => {
    const xml = montarFeed({ eventos: [], siteUrl: "https://exemplo.test/", atualizadoEm: "2026-10-29" });
    expect(xml).toContain('<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="pt-BR">');
    expect(xml).toContain("<updated>2026-10-29T00:00:00Z</updated>");
    expect(xml).not.toContain("<entry>");
    expect(xml).toContain('<link rel="self" href="https://exemplo.test/feed.xml"/>');
  });

  it("cada evento vira uma entrada com id estável, título em português e link para a página", () => {
    const xml = montarFeed({
      eventos: [
        evento(),
        evento({
          dataset: "bdrs",
          tipo: "novo_bdr",
          chave: "AAPL34",
          de: null,
          para: "Apple Inc",
          data: "2026-10-28",
        }),
      ],
      siteUrl: "https://exemplo.test",
      atualizadoEm: "2026-10-01",
    });
    expect(xml.match(/<entry>/g)).toHaveLength(2);
    expect(xml).toContain("<title>Troca de escriturador: 9512 (Banco Bradesco → Itaú Corretora)</title>");
    expect(xml).toContain("<title>Novo BDR: AAPL34 (— → Apple Inc)</title>");
    expect(xml).toContain('<link href="https://exemplo.test/acoes/9512/"/>');
    expect(xml).toContain('<link href="https://exemplo.test/bdrs/AAPL34/"/>');
    expect(xml).toContain("<id>tag:exemplo.test,2026-10-29:acoes/troca_escriturador/9512</id>");
    expect(xml).toContain("<updated>2026-10-29T00:00:00Z</updated>"); // o do evento mais recente
  });

  it("é determinístico: a mesma entrada gera o mesmo XML", () => {
    const a = montarFeed({ eventos: [evento()], siteUrl: "https://x.test", atualizadoEm: "2026-10-29" });
    const b = montarFeed({ eventos: [evento()], siteUrl: "https://x.test", atualizadoEm: "2026-10-29" });
    expect(a).toBe(b);
  });
});
