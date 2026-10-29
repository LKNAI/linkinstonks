// Rastreabilidade do volume: cada valor mensal de BDR leva ao arquivo oficial da B3 de onde veio.
import { describe, expect, it } from "vitest";
import { comoConferir, linkDoMes, nomeDoArquivo, origemDoMes, type FontesVolume } from "@/lib/fonte-volume";
import { bdrsDocSchema } from "@/lib/schemas";
import { publico } from "../dados";

const PAGINA = "https://www.b3.com.br/pagina-oficial/";
const M = "https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_M092026.ZIP";
const fontes: FontesVolume = {
  "2026-09": { tipo: "mensal", arquivos: [M] },
  "2026-10": {
    tipo: "diario",
    arquivos: [
      "https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_D01102026.ZIP",
      "https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_D02102026.ZIP",
    ],
  },
};

describe("link do volume mensal", () => {
  it("mês oficial: o clique abre o arquivo mensal da B3", () => {
    expect(linkDoMes(fontes, "2026-09", PAGINA)).toBe(M);
    expect(nomeDoArquivo(M)).toBe("COTAHIST_M092026.ZIP");
    expect(origemDoMes(fontes, "2026-09")).toBe("B3 · COTAHIST_M092026.ZIP");
  });

  it("mês parcial (vários arquivos diários): o clique vai à página oficial e a origem diz quantos arquivos", () => {
    expect(linkDoMes(fontes, "2026-10", PAGINA)).toBe(PAGINA);
    expect(origemDoMes(fontes, "2026-10")).toContain("2 arquivos diários");
  });

  it("mês sem registro de fonte nunca gera link quebrado: cai na página oficial", () => {
    expect(linkDoMes(fontes, "2020-01", PAGINA)).toBe(PAGINA);
  });

  it("explica como reproduzir o número no arquivo, com ticker, campos e posições do layout", () => {
    const t = comoConferir("AMZO34");
    expect(t).toContain("AMZO34");
    expect(t).toContain("AMZO34F");
    expect(t).toMatch(/VOLTOT.*171 a 188/);
    expect(t).toMatch(/CODNEG.*13 a 24/);
    expect(t).toContain("010");
    expect(t).toContain("020");
  });
});

describe("dados publicados: toda barra e célula tem origem", () => {
  const doc = bdrsDocSchema.parse(publico("bdrs.json"));

  it("há fonte para cada um dos 24 meses fechados e para o mês parcial", () => {
    for (const m of doc.meses) expect(doc.fontes_volume[m], m).toBeDefined();
    if (doc.mes_parcial) expect(doc.fontes_volume[doc.mes_parcial].tipo).toBe("diario");
    expect(Object.keys(doc.fontes_volume).length).toBe(doc.meses.length + (doc.mes_parcial ? 1 : 0));
  });

  it("as URLs são arquivos COTAHIST da B3 coerentes com o mês", () => {
    for (const [mes, f] of Object.entries(doc.fontes_volume)) {
      const [ano, mm] = mes.split("-");
      expect(f.arquivos.length).toBeGreaterThan(0);
      for (const u of f.arquivos) {
        expect(u.startsWith("https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_"), u).toBe(true);
        if (f.tipo === "mensal") expect(u.endsWith(`COTAHIST_M${mm}${ano}.ZIP`), u).toBe(true);
        else expect(u.endsWith(`${mm}${ano}.ZIP`) && u.includes("COTAHIST_D"), u).toBe(true);
      }
    }
    expect(doc.pagina_fonte).toMatch(/^https:\/\/www\.b3\.com\.br\//);
  });
});
