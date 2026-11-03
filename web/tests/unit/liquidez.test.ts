import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { derivar } from "@/lib/acoes";
import {
  composicaoPorSegmento,
  csvLiquidez,
  fatiasLiquidez,
  ordenarLiquidez,
  semTicker,
} from "@/lib/liquidez";
import { acoesDocSchema, acoesResumoDocSchema, bdrsDocSchema } from "@/lib/schemas";
import { derivarBdrs } from "@/lib/bdrs";
import { contagemFaixas, faixaDoMes, histogramaTicket, ticketDoMes } from "@/lib/ticket";
import { publico } from "../dados";

const acoes = acoesDocSchema.parse(publico("acoes.json")).companhias;
const resumo = acoesResumoDocSchema.parse(publico("acoes_liquidez_resumo.json"));
const rows = derivar(acoes, resumo.companhias);

describe("categorias de negociação (dados reais)", () => {
  it("todas as companhias têm categoria e o donut mais os sem código somam o total", () => {
    expect(rows.every((d) => d.liq)).toBe(true);
    const f = fatiasLiquidez(rows);
    expect(f.reduce((a, i) => a + i.n, 0) + semTicker(rows)).toBe(rows.length);
    expect(f.some((i) => i.k === "sem_ticker")).toBe(false);
  });

  it("a composição por segmento soma as companhias com código", () => {
    const c = composicaoPorSegmento(rows);
    expect(c.reduce((a, s) => a + s.total, 0)).toBe(rows.length - semTicker(rows));
    c.forEach((s) => expect(s.partes.reduce((a, p) => a + p.n, 0)).toBe(s.total));
  });

  it("a linguagem dos critérios é factual", () => {
    for (const d of rows) expect(d.liquidez?.criterio_texto).not.toMatch(/ruim|problem|il[ií]quid|risco/i);
  });
});

describe("tabela de liquidez", () => {
  it("ordena por presença e deixa quem não tem dado por último", () => {
    const o = ordenarLiquidez(rows, "p6", -1);
    expect(o[0].vol?.agregados["6m"].presenca).toBe(1);
    expect(o.at(-1)?.vol).toBeNull();
  });

  it("o CSV traz uma linha por empresa, com decimal em vírgula", () => {
    const csv = csvLiquidez(rows.slice(0, 5));
    expect(csv.trim().split("\n")).toHaveLength(6);
    expect(csv).toContain("Presença 6m");
  });
});

describe("faixa e histograma do ticket (dados reais)", () => {
  const doc = bdrsDocSchema.parse(publico("bdrs.json"));
  const bdrs = derivarBdrs(doc.bdrs);
  const ult = doc.meses.length - 1;
  const q = doc.ticket_quartis[doc.meses[ult]];

  it("a faixa calculada aqui é a mesma do ETL, BDR a BDR", () => {
    for (const b of doc.bdrs) {
      if (!b.negocios_mensal) continue;
      expect(faixaDoMes(b.volume_mensal[ult], b.negocios_mensal[ult], q, doc.min_negocios_mes)).toBe(
        b.perfil?.faixa,
      );
    }
  });

  it("os casos de borda não inventam faixa", () => {
    expect(ticketDoMes(100, 0)).toBeNull();
    expect(faixaDoMes(0, 0, q, 30)).toBe("dados_insuficientes");
    expect(faixaDoMes(1000, 40, undefined, 30)).toBe("dados_insuficientes");
  });

  it("o histograma conta quem entra no cálculo e informa quem fica de fora", () => {
    const h = histogramaTicket(bdrs, ult, q, doc.min_negocios_mes);
    expect(h.bins.reduce((a, b) => a + b.n, 0)).toBe(h.noCalculo);
    expect(h.noCalculo).toBe(q.bdrs);
    expect(h.noCalculo + h.semDados).toBe(bdrs.length);
    expect(h.x(q.q1)).toBeGreaterThan(0);
    expect(h.x(q.q3)).toBeLessThan(1);
  });

  it("sem nenhum BDR elegível o histograma fica vazio", () => {
    expect(histogramaTicket([], ult, q, doc.min_negocios_mes).bins).toEqual([]);
  });

  it("as faixas por BDR somam o total", () => {
    const c = contagemFaixas(bdrs);
    expect(Object.values(c).reduce((a, b) => a + b, 0)).toBe(bdrs.length);
  });
});

describe("metodologia em /sobre", () => {
  it("cada título de docs/metodologia.md aparece em /sobre", () => {
    const raiz = join(__dirname, "..", "..", "..");
    const doc = readFileSync(join(raiz, "docs", "metodologia.md"), "utf8");
    const pagina = readFileSync(join(raiz, "web", "app", "sobre", "page.tsx"), "utf8");
    const titulos = [...doc.matchAll(/^##+ (.+)$/gm)].map((m) => m[1]);
    const proprios = ["Fontes", "Limitações", "Mudanças de contrato"];
    for (const t of titulos.filter((x) => !proprios.includes(x))) expect(pagina).toContain(t);
  });
});
