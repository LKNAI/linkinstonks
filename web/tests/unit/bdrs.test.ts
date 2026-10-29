import { describe, expect, it } from "vitest";
import {
  FILTROS_BDR_PADRAO,
  concentracao,
  csvBdrs,
  derivarBdrs,
  escalaEixo,
  fatiasCategoria,
  fatiasDepositaria,
  fatiasTipo,
  filtrarBdrs,
  kpisBdrs,
  ordenarBdrs,
  ranking,
  totaisMensais,
  type FiltrosBdrs,
} from "@/lib/bdrs";
import { bdrsDocSchema } from "@/lib/schemas";
import { publico } from "../dados";

const doc = bdrsDocSchema.parse(publico("bdrs.json"));
const rows = derivarBdrs(doc.bdrs);
const meses = doc.meses;
const f = (p: Partial<FiltrosBdrs> = {}): FiltrosBdrs => ({ ...FILTROS_BDR_PADRAO, ...p });

describe("painel de BDRs (dados reais)", () => {
  it("24 meses fechados e 1.152 BDRs", () => {
    expect(meses).toHaveLength(24);
    expect(rows).toHaveLength(1152);
    expect(rows.every((d) => d.volume_mensal.length === 24)).toBe(true);
  });

  it("DR1, DR2 e DR3 viram um grupo Patrocinado (SPO)", () => {
    expect(new Set(rows.map((d) => d.T))).toEqual(new Set(["DRN", "DRE", "SPO"]));
    expect(rows.filter((d) => d.T === "SPO").every((d) => ["DR1", "DR2", "DR3"].includes(d.tipo))).toBe(true);
  });

  it("situação: negociadas no último mês são as que têm volume nele", () => {
    const on = filtrarBdrs(rows, f({ st: "on" }));
    const off = filtrarBdrs(rows, f({ st: "off" }));
    expect(on.length + off.length).toBe(rows.length);
    expect(on.every((d) => d.volume_mensal[23] > 0)).toBe(true);
    expect(on).toHaveLength(966);
  });

  it("KPIs coerentes", () => {
    const { kpis } = kpisBdrs(rows, meses);
    expect(kpis).toHaveLength(6);
    expect(kpis[0].valor).toBe("1.152");
    expect(kpis[1].valor).toBe("R$ 538 bi");
    expect(kpis[4].sub).toContain("Banco B3");
    expect(kpis[5].valor).toBe("TSLA34");
  });

  it("volume mensal por tipo soma o total de 24 meses", () => {
    const m = totaisMensais(rows, meses);
    expect(m.reduce((a, x) => a + x.total, 0)).toBe(rows.reduce((a, d) => a + d.tot, 0));
    for (const x of m) expect(x.porTipo.DRN + x.porTipo.DRE + x.porTipo.SPO).toBe(x.total);
  });

  it("escala do eixo: degraus 1/2/5 e no máximo 5 linhas", () => {
    expect(escalaEixo(34e9)).toEqual({ passo: 1e10, topo: 4e10 });
    const e = escalaEixo(7.3e6);
    expect(e.topo / e.passo).toBeLessThanOrEqual(5);
    expect(escalaEixo(0).topo).toBeGreaterThan(0);
  });

  it("filtro cruzado: o donut de depositária ignora o próprio filtro", () => {
    const filtros = f({ dep: "Banco Bradesco", type: "DRN" });
    const donut = fatiasDepositaria(filtrarBdrs(rows, filtros, "dep"));
    expect(donut.map((x) => x.label)).toContain("Banco B3");
    expect(filtrarBdrs(rows, filtros).every((d) => d.depositaria === "Banco Bradesco" && d.T === "DRN")).toBe(
      true,
    );
    expect(fatiasTipo(filtrarBdrs(rows, f({ dep: "Banco Bradesco" }), "type")).length).toBeGreaterThan(0);
  });

  it("categorias só consideram ETFs (DRE)", () => {
    const cats = fatiasCategoria(rows);
    expect(cats.length).toBeGreaterThan(0);
    const etfs = rows.filter((d) => d.T === "DRE");
    expect(cats.reduce((a, c) => a + c.n, 0)).toBe(etfs.reduce((a, d) => a + d.tot, 0));
  });

  it("ranking e concentração: o mês escolhido muda o ranking", () => {
    const geral = ranking(rows, f());
    expect(geral.itens).toHaveLength(15);
    expect(geral.itens[0].d.ticker).toBe("TSLA34");
    const mes = ranking(rows, f({ month: 23 }));
    expect(mes.total).toBe(rows.reduce((a, d) => a + d.volume_mensal[23], 0));
    expect(mes.total).not.toBe(geral.total);
    const c = concentracao(geral.todos, geral.total, f());
    expect(c.cortes.map((x) => x.n)).toEqual([1, 5, 10, 50]);
    expect(c.cortes[3].parte).toBeGreaterThan(c.cortes[0].parte);
    expect(c.precisam80).toBeGreaterThan(0);
    expect(c.precisam80).toBeLessThanOrEqual(c.comVolume);
  });

  it("ordenação: números decrescentes, texto crescente, colunas de mês", () => {
    expect(ordenarBdrs(rows, { k: "tot", dir: -1 })[0].ticker).toBe("TSLA34");
    const t = ordenarBdrs(rows, { k: "t", dir: 1 }).map((d) => d.ticker);
    expect(t).toEqual([...t].sort((a, b) => a.localeCompare(b, "pt", { numeric: true })));
    expect(ordenarBdrs(rows, { k: "m23", dir: -1 })[0].volume_mensal[23]).toBe(
      Math.max(...rows.map((d) => d.volume_mensal[23])),
    );
  });

  it("CSV: 14 colunas fixas mais 24 meses, volumes em R$", () => {
    const csv = csvBdrs(rows.slice(0, 3), meses);
    const cab = csv.split("\n")[0].split(";");
    expect(cab).toHaveLength(14 + 24);
    expect(cab[0]).toBe("﻿Ticker");
    expect(csv.split("\n")).toHaveLength(4);
  });
});
