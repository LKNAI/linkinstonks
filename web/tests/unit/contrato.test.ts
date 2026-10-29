import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  acaoSchema,
  acoesDocSchema,
  bdrSchema,
  bdrsDocSchema,
  eventosDocSchema,
  metaSchema,
} from "@/lib/schemas";
import { publico, schemaJson } from "../dados";

describe("contrato com o ETL", () => {
  it("os arquivos publicados passam no zod", () => {
    expect(() => acoesDocSchema.parse(publico("acoes.json"))).not.toThrow();
    expect(() => bdrsDocSchema.parse(publico("bdrs.json"))).not.toThrow();
    expect(() => metaSchema.parse(publico("meta.json"))).not.toThrow();
    expect(() => eventosDocSchema.parse(publico("eventos.json"))).not.toThrow();
  });

  it("o zod rejeita dado fora do contrato", () => {
    const doc = acoesDocSchema.parse(publico("acoes.json"));
    const ruim = { ...doc, companhias: [{ ...doc.companhias[0], segmento: "XX" }] };
    expect(acoesDocSchema.safeParse(ruim).success).toBe(false);
    expect(acoesDocSchema.safeParse({ ...doc, schema_version: 2 }).success).toBe(false);
  });

  it("zod e JSON Schema de acoes declaram os mesmos campos", () => {
    const comp = schemaJson("acoes").$defs.companhia;
    expect(Object.keys(acaoSchema.shape).sort()).toEqual(Object.keys(comp.properties).sort());
    expect([...comp.required].sort()).toEqual(Object.keys(comp.properties).sort());
    const cvm = comp.properties.escriturador_cvm.oneOf[1].properties;
    const zodCvm = acaoSchema.shape.escriturador_cvm.def.innerType.shape;
    expect(Object.keys(zodCvm).sort()).toEqual(Object.keys(cvm).sort());
  });

  it("zod e JSON Schema de bdrs declaram os mesmos campos", () => {
    const js = schemaJson("bdrs");
    const props = js.properties.bdrs.items.properties;
    expect(Object.keys(bdrSchema.shape).sort()).toEqual(Object.keys(props).sort());
    expect(Object.keys(bdrsDocSchema.shape).sort()).toEqual(Object.keys(js.properties).sort());
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
});
