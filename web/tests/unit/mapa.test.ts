import { describe, expect, it } from "vitest";
import { CELULA_SEM_NEGOCIOS, CELULA_SEM_REFERENCIA } from "@/components/charts/celulas";
import type { BdrRow } from "@/lib/bdrs";
import {
  celulaVariacao,
  celulasIntensidade,
  indicesDosMeses,
  linhasDoMapa,
  mediaAnterior,
  mesDoPico,
  ordenarMapa,
  tendencia,
  textoEscala,
} from "@/lib/mapa";

const doze = (v: number) => Array<number>(12).fill(v);
const row = (ticker: string, volume_mensal: number[], tot = volume_mensal.reduce((a, b) => a + b, 0)) =>
  ({ ticker, tot, volume_mensal }) as unknown as BdrRow;

describe("intensidade", () => {
  it("vai de 1 a 7 em relação ao pico e separa o mês sem negócio do tom mais claro", () => {
    const c = celulasIntensidade([0, 1, 50, 100]);
    expect(c).toEqual([CELULA_SEM_NEGOCIOS, 1, 4, 7]);
  });

  it("BDR sem nenhum negócio fica todo como sem negócios", () => {
    expect(celulasIntensidade([0, 0])).toEqual([CELULA_SEM_NEGOCIOS, CELULA_SEM_NEGOCIOS]);
  });
});

describe("variação", () => {
  it("os 12 primeiros meses não têm referência", () => {
    expect(celulaVariacao([...doze(10), 10], 5)).toBe(CELULA_SEM_REFERENCIA);
    expect(mediaAnterior([...doze(10), 10], 11)).toBeNull();
    expect(mediaAnterior([...doze(10), 10], 12)).toBe(10);
  });

  it("média zero também fica sem referência, e mês sem negócio tem marca própria", () => {
    expect(celulaVariacao([...doze(0), 10], 12)).toBe(CELULA_SEM_REFERENCIA);
    expect(celulaVariacao([...doze(10), 0], 12)).toBe(CELULA_SEM_NEGOCIOS);
  });

  it("é neutra perto de ×1, sobe e desce nos dois polos e para em ×0,25 e ×4", () => {
    const v = (x: number) => celulaVariacao([...doze(100), x], 12);
    expect(v(100)).toBe(0);
    expect(v(110)).toBe(0);
    expect(v(4000)).toBe(3);
    expect(v(400)).toBe(3);
    expect(v(1)).toBe(-3);
    expect(v(200)).toBeGreaterThan(0);
    expect(v(50)).toBeLessThan(0);
    expect(v(200)).toBe(-v(50));
  });
});

describe("meses visíveis", () => {
  it("variação e janela de 12 mostram os 12 últimos; intensidade em 24 mostra todos", () => {
    expect(indicesDosMeses(24, "variacao", 24)).toEqual(Array.from({ length: 12 }, (_, i) => i + 12));
    expect(indicesDosMeses(24, "intensidade", 12)[0]).toBe(12);
    expect(indicesDosMeses(24, "intensidade", 24)).toHaveLength(24);
  });
});

describe("ordem", () => {
  const a = row("AAAA34", [...doze(10), ...doze(10)]);
  const b = row("BBBB34", [...doze(1), ...doze(5)]);
  const c = row("CCCC34", [...Array<number>(23).fill(0), 3]);

  it("tendência é 6 meses contra os 6 anteriores", () => {
    expect(tendencia([...doze(0), ...doze(0).map((_, i) => (i < 6 ? 2 : 4))])).toBe(2);
    expect(tendencia(c.volume_mensal)).toBe(Number.MAX_SAFE_INTEGER);
    expect(tendencia(Array<number>(24).fill(0))).toBe(-1);
  });

  it("ordena por volume, alfabética, tendência e mês do pico", () => {
    expect(ordenarMapa([b, c, a], "volume").map((x) => x.ticker)).toEqual(["AAAA34", "BBBB34", "CCCC34"]);
    expect(ordenarMapa([c, a, b], "alfabetica").map((x) => x.ticker)).toEqual(["AAAA34", "BBBB34", "CCCC34"]);
    expect(ordenarMapa([a, b, c], "tendencia")[0].ticker).toBe("CCCC34");
    expect(mesDoPico(c.volume_mensal)).toBe(23);
    expect(ordenarMapa([a, c], "pico")[0].ticker).toBe("CCCC34");
  });

  it("o seletor de linhas corta pelos maiores antes de reordenar", () => {
    expect(linhasDoMapa([c, b, a], 2, "alfabetica").map((x) => x.ticker)).toEqual(["AAAA34", "BBBB34"]);
    expect(linhasDoMapa([c, b, a], null, "volume")).toHaveLength(3);
  });
});

describe("texto da escala", () => {
  it("usa o valor de cada modo, em pt-BR", () => {
    const v = [...doze(100), 180];
    expect(textoEscala(v, 12, "intensidade")).toBe("100% do pico do BDR");
    expect(textoEscala(v, 0, "intensidade")).toBe("56% do pico do BDR");
    expect(textoEscala(v, 12, "variacao")).toBe("×1,8 a média de 12 meses");
    expect(textoEscala(v, 0, "variacao")).toBe("sem os 12 meses anteriores");
    expect(textoEscala([0, 10], 0, "variacao")).toBe("sem negócios");
  });
});
