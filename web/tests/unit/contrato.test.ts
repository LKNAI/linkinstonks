import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  acaoSchema,
  acoesDocSchema,
  acoesLiquidezDocSchema,
  acoesResumoDocSchema,
  bdrSchema,
  bdrsDocSchema,
  eventosDocSchema,
  metaSchema,
  segmentosDocSchema,
} from "@/lib/schemas";
import { publico, schemaJson } from "../dados";

describe("contrato com o ETL", () => {
  it("os arquivos publicados passam no zod", () => {
    expect(() => acoesDocSchema.parse(publico("acoes.json"))).not.toThrow();
    expect(() => bdrsDocSchema.parse(publico("bdrs.json"))).not.toThrow();
    expect(() => acoesResumoDocSchema.parse(publico("acoes_liquidez_resumo.json"))).not.toThrow();
    expect(() => metaSchema.parse(publico("meta.json"))).not.toThrow();
    expect(() => eventosDocSchema.parse(publico("eventos.json"))).not.toThrow();
    expect(() => acoesLiquidezDocSchema.parse(publico("acoes_liquidez.json"))).not.toThrow();
    expect(() => segmentosDocSchema.parse(publico("acoes_historico_segmentos.json"))).not.toThrow();
  });

  it("o zod rejeita dado fora do contrato", () => {
    const doc = acoesDocSchema.parse(publico("acoes.json"));
    const ruim = { ...doc, companhias: [{ ...doc.companhias[0], segmento: "XX" }] };
    expect(acoesDocSchema.safeParse(ruim).success).toBe(false);
    expect(acoesDocSchema.safeParse({ ...doc, schema_version: 2 }).success).toBe(false);
    expect(acoesDocSchema.safeParse({ ...doc, schema_version: "2.0" }).success).toBe(false);
  });

  it("subir só o minor não derruba o site (ADR 0008)", () => {
    const doc = acoesDocSchema.parse(publico("acoes.json"));
    expect(acoesDocSchema.safeParse({ ...doc, schema_version: "1.9" }).success).toBe(true);
  });

  it("zod e JSON Schema de acoes declaram os mesmos campos", () => {
    const comp = schemaJson("acoes").$defs.companhia;
    expect(Object.keys(acaoSchema.shape).sort()).toEqual(Object.keys(comp.properties).sort());
    expect([...comp.required].sort()).toEqual(Object.keys(comp.properties).sort());
    const cvm = comp.properties.escriturador_cvm.oneOf[1].properties;
    const zodCvm = acaoSchema.shape.escriturador_cvm.def.innerType.shape;
    expect(Object.keys(zodCvm).sort()).toEqual(Object.keys(cvm).sort());
    const listagem = comp.properties.listagem.oneOf[1].properties;
    expect(Object.keys(acaoSchema.shape.listagem.def.innerType.shape).sort()).toEqual(
      Object.keys(listagem).sort(),
    );
    const liquidez = comp.properties.liquidez.oneOf[1].properties;
    const zodLiq = acaoSchema.shape.liquidez.def.innerType.shape;
    expect(Object.keys(zodLiq).sort()).toEqual(Object.keys(liquidez).sort());
    expect([...zodLiq.categoria.options].sort()).toEqual([...liquidez.categoria.enum].sort());
  });

  it("zod e JSON Schema de bdrs declaram os mesmos campos", () => {
    const js = schemaJson("bdrs");
    const props = js.properties.bdrs.items.properties;
    expect(Object.keys(bdrSchema.shape).sort()).toEqual(Object.keys(props).sort());
    expect(Object.keys(bdrsDocSchema.shape).sort()).toEqual(Object.keys(js.properties).sort());
    const perfil = props.perfil.oneOf[1].properties;
    const zodPerfil = bdrSchema.shape.perfil.def.innerType.shape;
    expect(Object.keys(zodPerfil).sort()).toEqual(Object.keys(perfil).sort());
    expect([...zodPerfil.faixa.options].sort()).toEqual([...perfil.faixa.enum].sort());
  });

  it("zod e JSON Schema de acoes_liquidez declaram os mesmos campos", () => {
    const js = schemaJson("acoes_liquidez");
    const zodDoc = acoesLiquidezDocSchema.shape;
    expect(Object.keys(zodDoc).sort()).toEqual(Object.keys(js.properties).sort());
    expect([...js.required].sort()).toEqual(Object.keys(js.properties).sort());
    const cia = zodDoc.companhias.def.element.shape;
    expect(Object.keys(cia).sort()).toEqual(Object.keys(js.properties.companhias.items.properties).sort());
    const tk = zodDoc.tickers.def.element.shape;
    expect(Object.keys(tk).sort()).toEqual(Object.keys(js.properties.tickers.items.properties).sort());
    expect(Object.keys(cia.mensal.shape).sort()).toEqual(Object.keys(js.$defs.mensal.properties).sort());
    expect(Object.keys(cia.agregados.shape["3m"].shape).sort()).toEqual(
      Object.keys(js.$defs.agregado.properties).sort(),
    );
  });

  it("zod e JSON Schema de acoes_historico_segmentos declaram os mesmos campos", () => {
    const js = schemaJson("acoes_historico_segmentos");
    const item = js.properties.companhias.additionalProperties.items.properties;
    const zodItem = segmentosDocSchema.shape.companhias.def.valueType.def.element.shape;
    expect(Object.keys(zodItem).sort()).toEqual(Object.keys(item).sort());
  });

  it("liquidez: as séries têm 24 meses, a presença fica entre 0 e 1 e o ticket só existe com negócios", () => {
    const d = acoesLiquidezDocSchema.parse(publico("acoes_liquidez.json"));
    expect(d.meses).toHaveLength(24);
    expect(d.pregoes_mes).toHaveLength(24);
    [...d.companhias, ...d.tickers].forEach((x) => {
      expect(x.mensal.volume).toHaveLength(24);
      x.mensal.presenca.forEach((p) => expect(p === null || (p >= 0 && p <= 1)).toBe(true));
      x.mensal.ticket_medio.forEach((t, i) => expect(t === null || x.mensal.negocios[i] > 0).toBe(true));
    });
  });

  it("os enums do zod coincidem com os do JSON Schema", () => {
    const comp = schemaJson("acoes").$defs.companhia.properties;
    expect([...acaoSchema.shape.segmento.options].sort()).toEqual([...comp.segmento.enum].sort());
    const bd = schemaJson("bdrs").properties.bdrs.items.properties;
    expect([...bdrSchema.shape.tipo.options].sort()).toEqual([...bd.tipo.enum].sort());
  });

  it("lib/colors.ts está em dia com instituicoes.json (gerado do YAML)", () => {
    const colors = readFileSync(join(__dirname, "..", "..", "lib", "colors.ts"), "utf8");
    const inst = (
      publico("instituicoes.json") as {
        instituicoes: { nome_curto: string; cor: string; cor_depositaria: string | null }[];
      }
    ).instituicoes;
    for (const i of inst) {
      expect(colors).toContain(`${JSON.stringify(i.nome_curto)}: ${JSON.stringify(i.cor)}`);
      if (i.cor_depositaria) {
        expect(colors).toContain(`${JSON.stringify(i.nome_curto)}: ${JSON.stringify(i.cor_depositaria)}`);
      }
    }
  });

  it("zod e JSON Schema do resumo de liquidez declaram os mesmos campos", () => {
    const js = schemaJson("acoes_liquidez_resumo");
    expect(Object.keys(acoesResumoDocSchema.shape).sort()).toEqual(Object.keys(js.properties).sort());
    expect([...js.required].sort()).toEqual(Object.keys(js.properties).sort());
    const item = js.properties.companhias.items.properties;
    const zodItem = acoesResumoDocSchema.shape.companhias.def.element.shape;
    expect(Object.keys(zodItem).sort()).toEqual(Object.keys(item).sort());
  });

  it("o volume das companhias e o não atribuído reproduzem o total do mercado, mês a mês", () => {
    const d = acoesResumoDocSchema.parse(publico("acoes_liquidez_resumo.json"));
    expect(d.meses).toHaveLength(24);
    d.companhias.forEach((c) => {
      expect(c.volume_mensal).toHaveLength(24);
      expect(c.volume_24m).toBe(c.volume_mensal.reduce((a, b) => a + b, 0));
    });
    const mercado = d.meses.map(
      (_, i) => d.companhias.reduce((a, c) => a + c.volume_mensal[i], 0) + d.nao_atribuido.volume_mensal[i],
    );
    expect(mercado.every((v) => v > 0)).toBe(true);
  });
});
