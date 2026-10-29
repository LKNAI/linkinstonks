import { describe, expect, it } from "vitest";
import { codecAcoes } from "@/components/paineis/PainelAcoes";
import { codecBdrs } from "@/components/paineis/PainelBdrs";
import { FILTROS_PADRAO } from "@/lib/acoes";
import { FILTROS_BDR_PADRAO } from "@/lib/bdrs";
import { escaparCsv, montarCsv } from "@/lib/csv";
import { abreviaMes, formatBRL, formatDinheiro, rotuloMes, variacao } from "@/lib/format";
import type { Meta } from "@/lib/schemas";
import {
  diasEntre,
  diasUteisEntre,
  fontesDesatualizadas,
  hojeEmBrasilia,
  ultimaAtualizacao,
} from "@/lib/stale";
import { paraQuery } from "@/lib/url-state";

describe("formatação", () => {
  it("dinheiro compacto como no seed", () => {
    expect(formatDinheiro(0)).toBe("—");
    expect(formatDinheiro(500)).toBe("< R$ 1 mil");
    expect(formatDinheiro(120_000)).toBe("R$ 120 mil");
    expect(formatDinheiro(34_500_000)).toBe("R$ 34,5 mi");
    expect(formatDinheiro(1_500_000_000)).toBe("R$ 1,5 bi");
    expect(formatDinheiro(538_000_000_000)).toBe("R$ 538 bi");
  });

  it("variação: novo, alta, queda e vazia", () => {
    expect(variacao(0, 0)).toEqual({ tipo: "nenhuma", texto: "" });
    expect(variacao(5, 0)).toEqual({ tipo: "novo", texto: "novo" });
    expect(variacao(110, 100)).toEqual({ tipo: "alta", texto: "▲ 10%" });
    expect(variacao(72, 100)).toEqual({ tipo: "queda", texto: "▼ 28%" });
  });

  it("meses e moeda em pt-BR", () => {
    expect(rotuloMes("2026-09")).toBe("set/26");
    expect(abreviaMes("2025-01")).toBe("jan");
    expect(formatBRL(1234.5).replace(/\s/g, " ")).toBe("R$ 1.234,50");
  });
});

describe("CSV", () => {
  it("escapa ponto e vírgula, aspas e quebra de linha", () => {
    expect(escaparCsv("a;b")).toBe('"a;b"');
    expect(escaparCsv('diz "oi"')).toBe('"diz ""oi"""');
    expect(escaparCsv(null)).toBe("");
    expect(escaparCsv(12)).toBe("12");
  });

  it("monta com BOM e linhas separadas por \\n", () => {
    expect(montarCsv(["a", "b"], [[1, "x;y"]])).toBe('﻿a;b\n1;"x;y"');
  });
});

describe("estado na URL", () => {
  it("querystring ordenada e sem valores vazios", () => {
    expect(paraQuery({ b: "2", a: "1", c: "" })).toBe("?a=1&b=2");
    expect(paraQuery({})).toBe("");
  });

  it("ações: o estado padrão gera URL limpa e o ciclo codifica/decodifica", () => {
    expect(codecAcoes.codificar(FILTROS_PADRAO)).toEqual({});
    const f = {
      ...FILTROS_PADRAO,
      q: "petr",
      onlyT: false,
      bank: "Itaú Corretora",
      yr: "2023",
      sort: { k: "since", dir: -1 as const },
    };
    const params = codecAcoes.codificar(f);
    expect(params).toEqual({ q: "petr", t: "0", bank: "Itaú Corretora", yr: "2023", ord: "since:-1" });
    const volta = codecAcoes.decodificar(new URLSearchParams(params));
    expect({ ...FILTROS_PADRAO, ...volta }).toEqual(f);
  });

  it("BDRs: mês, situação e colunas dos 24 meses entram na URL", () => {
    const f = { ...FILTROS_BDR_PADRAO, st: "on" as const, month: 5, showM: true, dep: "Banco B3" };
    const params = codecBdrs.codificar(f);
    expect(params).toEqual({ st: "on", mes: "5", m: "1", dep: "Banco B3" });
    expect({ ...FILTROS_BDR_PADRAO, ...codecBdrs.decodificar(new URLSearchParams(params)) }).toEqual(f);
  });

  it("valores inválidos na URL são ignorados", () => {
    const d = codecBdrs.decodificar(new URLSearchParams("st=xx&mes=abc&ord=tot:7"));
    expect(d).toEqual({});
  });
});

describe("aviso de dados desatualizados", () => {
  const meta = (ultimo: Record<string, string>, status: "ok" | "erro" = "ok"): Meta => ({
    schema_version: 1,
    datasets: {
      acoes: { atualizado_em: "2026-10-29", contagem: 1 },
      bdrs: { atualizado_em: "2026-10-27", contagem: 1 },
    },
    fontes: Object.fromEntries(Object.entries(ultimo).map(([k, v]) => [k, { status, ultimo_sucesso: v }])),
  });

  it("conta dias úteis e corridos", () => {
    expect(diasUteisEntre("2026-10-23", "2026-10-27")).toBe(2); // sex -> ter: seg e ter
    expect(diasEntre("2026-10-19", "2026-10-29")).toBe(10);
  });

  it("fonte diária: até 3 dias úteis é normal, mais que isso avisa", () => {
    expect(fontesDesatualizadas(meta({ b3_listed: "2026-10-26" }), "2026-10-29")).toHaveLength(0);
    const a = fontesDesatualizadas(meta({ b3_listed: "2026-10-20" }), "2026-10-29");
    expect(a).toHaveLength(1);
    expect(a[0].motivo).toContain("3 dias úteis");
  });

  it("fonte semanal: limite de 10 dias corridos", () => {
    expect(fontesDesatualizadas(meta({ bradesco: "2026-10-19" }), "2026-10-29")).toHaveLength(0);
    expect(fontesDesatualizadas(meta({ bradesco: "2026-10-18" }), "2026-10-29")).toHaveLength(1);
  });

  it("fonte com erro avisa mesmo recente; fonte desconhecida é ignorada", () => {
    expect(fontesDesatualizadas(meta({ b3_listed: "2026-10-29" }, "erro"), "2026-10-29")[0].motivo).toContain(
      "erro",
    );
    expect(fontesDesatualizadas(meta({ fonte_nova: "2020-01-01" }), "2026-10-29")).toHaveLength(0);
  });

  it("última atualização é a data mais recente dos datasets", () => {
    expect(ultimaAtualizacao(meta({}))).toBe("2026-10-29");
  });

  it("hoje em Brasília usa o fuso, não o UTC", () => {
    expect(hojeEmBrasilia(new Date("2026-10-30T01:30:00Z"))).toBe("2026-10-29");
  });
});
