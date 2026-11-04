import { describe, expect, it } from "vitest";
import type { Kpi } from "@/lib/acoes";
import { derivar } from "@/lib/acoes";
import { derivarBdrs, kpisBdrs } from "@/lib/bdrs";
import type { Bdr } from "@/lib/schemas";
import {
  descreverPosicao,
  diferenca,
  expandirAcoes,
  expandirLinhas,
  kpisComDiferenca,
  UNIDADE_COMPANHIA,
} from "@/lib/snapshots";

const kpi = (rotulo: string, valor: string): Kpi => ({
  rotulo,
  valor,
  sub: "original",
  cor: "var(--accent)",
});

describe("posição de um mês passado", () => {
  it("expande colunas e linhas", () => {
    expect(expandirLinhas({ mes: "2026-09", colunas: ["a", "b"], linhas: [[1, 2]] }, "x")).toEqual({
      mes: "2026-09",
      x: [{ a: 1, b: 2 }],
    });
  });

  it("o registro expandido serve aos cálculos dos painéis", () => {
    const { acoes } = expandirAcoes({
      mes: "2026-09",
      reconstituido: false,
      coletado_em: "2026-10-29",
      companhias: [
        {
          codigo_cvm: "1",
          pregao: "A",
          razao_social: "A S.A.",
          emissor: "AAAA",
          cnpj: "1",
          setor: "X",
          segmento: "NM",
          tickers: [{ ticker: "AAAA3", classe: "ON" }],
          escriturador: "Banco B3",
          escriturador_cvm: {
            atual: "Itaú Corretora",
            inicio: "2020-01-01",
            inicio_aproximado: false,
            anterior: "Banco Safra",
            anterior_inicio: "2010-01-01",
            anterior_fim: "2019-12-31",
          },
        },
      ],
    });
    const [linha] = derivar(acoes);
    expect(linha.b).toBe("Banco B3");
    expect(linha.outE).toBe("Banco Safra");
    expect(acoes[0].divergente_b3_cvm).toBe(true);
  });

  it("descreve a coleta real pela data real e a reconstituída pelo fim do mês", () => {
    expect(descreverPosicao({ mes: "2026-09", reconstituido: false, coletado_em: "2026-10-29" })).toBe(
      "posição coletada em 29/10/2026",
    );
    expect(descreverPosicao({ mes: "2024-02", reconstituido: true, coletado_em: null })).toBe(
      "posição de 29/02/2024",
    );
  });

  it("calcula a diferença contra hoje só nos KPIs que são contagens", () => {
    expect(diferenca(570, 567, UNIDADE_COMPANHIA)).toBe("+3 companhias desde então");
    expect(diferenca(560, 567, UNIDADE_COMPANHIA)).toBe("−7 companhias desde então");
    expect(diferenca(566, 567, UNIDADE_COMPANHIA)).toBe("−1 companhia desde então");
    expect(diferenca(567, 567, UNIDADE_COMPANHIA)).toBe("Igual a hoje");
    expect(diferenca(9, 7)).toBe("+2 desde então");
    const r = kpisComDiferenca(
      [kpi("Empresas", "1.000"), kpi("Volume", "R$ 1,2 bi")],
      [kpi("Empresas", "1.003"), kpi("Volume", "R$ 2,0 bi")],
      UNIDADE_COMPANHIA,
    );
    expect(r[0].sub).toBe("+3 companhias desde então");
    expect(r[1].sub).toBe("original");
  });
});

describe("BDRs com janela menor que 24 meses", () => {
  const bdr = (volume_mensal: number[]): Bdr => ({
    ticker: "AAAA34",
    nome: "A",
    tipo: "DRN",
    isin: "",
    depositaria: "Banco B3",
    fonte_depositaria: "",
    categoria: "",
    qualificado: false,
    primeiro_pregao: null,
    ultimo_pregao: "2025-08-29",
    ultimo_preco: 1,
    negocios_24m: 1,
    negocios_mensal: null,
    meses_negocios_suspeitos: [],
    perfil: null,
    volume_24m: volume_mensal.reduce((a, b) => a + b, 0),
    volume_mensal,
    volume_mes_parcial: null,
  });
  const meses = (n: number) => Array.from({ length: n }, (_, i) => `2025-${String(i + 1).padStart(2, "0")}`);

  it("não inventa queda de 100% nem rótulo de mês inexistente", () => {
    const { kpis } = kpisBdrs(derivarBdrs([bdr(Array(11).fill(10))]), meses(11));
    expect(kpis[1].rotulo).toBe("Volume em 11 meses");
    expect(kpis[2].sub).toBe("sem o mesmo mês do ano anterior");
    expect(kpis[3].valor).toBe("—");
    expect(kpis[3].sub).toBe("esta posição tem 11 meses");
    expect(JSON.stringify(kpis)).not.toContain("undefined");
  });

  it("com 24 meses, compara os 12 últimos com os 12 anteriores", () => {
    const [d] = derivarBdrs([bdr([...Array(12).fill(10), ...Array(12).fill(20)])]);
    expect(d.y0).toBe(120);
    expect(d.y1).toBe(240);
  });
});
