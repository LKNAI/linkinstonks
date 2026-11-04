import { describe, expect, it } from "vitest";
import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LIMITE_GZIP, montarIndice } from "../../scripts/gen-busca.mjs";
import { analisarLista, eventoDoItem, eventosRecentes, novidadesDaLista } from "@/lib/acompanhamento";
import { buscar, distancia, normalizar, prepararIndice, type IndiceBusca } from "@/lib/busca";

const INDICE: IndiceBusca = {
  c: [
    ["PETROBRAS", "PETROLEO BRASILEIRO S.A.", "PETR", "33000167000101", "9512", "PETR3 PETR4"],
    ["PETRORIO", "PRIO S.A.", "PRIO", "10629105000168", "22187", "PRIO3"],
    ["SÃO MARTINHO", "SAO MARTINHO S.A.", "SMTO", "51466860000156", "20516", "SMTO3"],
  ],
  b: [
    ["TSLA34", "Tesla Inc", "BRTSLABDR006"],
    ["TSMC34", "Taiwan Semiconductor", "BRTSMCBDR007"],
  ],
  i: [["Banco do Brasil", "Banco do Brasil S.A.", "brasil", 1]],
};
const ind = prepararIndice(INDICE);

describe("busca", () => {
  it("normaliza acentos e maiúsculas", () => {
    expect(normalizar("São  Martinho!")).toBe("sao martinho");
    expect(buscar(ind, "SAO mart")[0].itens[0].titulo).toBe("SÃO MARTINHO");
  });

  it("ticker exato vem antes de prefixo e o grupo dele vem primeiro", () => {
    const g = buscar(ind, "tsla34");
    expect(g[0].tipo).toBe("bdr");
    expect(g[0].itens[0]).toMatchObject({ titulo: "TSLA34", nivel: 0 });
    expect(buscar(ind, "ts")[0].itens.map((r) => r.nivel)).toEqual([1, 1]);
  });

  it("acha CNPJ com e sem pontuação, código CVM e ISIN", () => {
    for (const q of ["33.000.167/0001-01", "33000167000101", "9512"])
      expect(buscar(ind, q)[0].itens[0].chave).toBe("9512");
    expect(buscar(ind, "BRTSMCBDR007")[0].itens[0].chave).toBe("TSMC34");
  });

  it("aproxima erros de digitação, mas sem inventar", () => {
    expect(buscar(ind, "petrobas")[0].itens[0].titulo).toBe("PETROBRAS");
    expect(buscar(ind, "xyzw")).toEqual([]);
    expect(distancia("abcd", "abdc", 1)).toBe(1);
    expect(distancia("abc", "xyzabc", 1)).toBe(2);
  });

  it("limita a 8 por grupo", () => {
    const b = Array.from({ length: 12 }, (_, i) => [`AAA${i}34`, `Nome ${i}`, ""]) as [
      string,
      string,
      string,
    ][];
    expect(buscar(prepararIndice({ c: [], b, i: [] }), "aaa")[0].itens).toHaveLength(8);
  });

  it("instituição aponta para a lista filtrada", () => {
    expect(buscar(ind, "banco do brasil")[0].itens[0].href).toBe("/acoes/?bank=Banco%20do%20Brasil");
  });

  it("o índice real fica dentro do orçamento", () => {
    const pub = join(__dirname, "..", "..", "..", "data", "public");
    const ler = (n: string) => JSON.parse(readFileSync(join(pub, n), "utf8"));
    const real = montarIndice(
      ler("acoes.json").companhias,
      ler("bdrs.json").bdrs,
      ler("instituicoes.json").instituicoes,
    );
    expect(gzipSync(JSON.stringify(real)).length).toBeLessThan(LIMITE_GZIP);
    expect(real.i.some((i: string[]) => i[0] === "Não informado")).toBe(false);
  });
});

describe("lista de acompanhamento", () => {
  const lista = {
    itens: [
      { tipo: "companhia" as const, chave: "9512", nome: "PETROBRAS" },
      { tipo: "instituicao" as const, chave: "Itaú Corretora", nome: "Itaú Corretora" },
    ],
    ultima_visita: "2026-10-30",
  };
  const ev = (data: string, dataset: string, chave: string, tipo = "ticker_novo", de?: string, para?: string) => ({
    data, dataset, chave, tipo, de, para,
  }); // prettier-ignore

  it("casa eventos por item", () => {
    expect(eventoDoItem(ev("2026-11-01", "acoes", "9512"), lista.itens[0])).toBe(true);
    expect(eventoDoItem(ev("2026-11-01", "bdrs", "9512"), lista.itens[0])).toBe(false);
    expect(
      eventoDoItem(
        ev("2026-11-01", "acoes", "1", "troca_escriturador", "X", "Itaú Corretora"),
        lista.itens[1],
      ),
    ).toBe(true);
    expect(
      eventoDoItem(ev("2026-11-01", "acoes", "1", "ticker_novo", "Itaú Corretora"), lista.itens[1]),
    ).toBe(false);
  });

  it("conta novidades só depois da última visita", () => {
    const e = [
      ev("2026-10-30", "acoes", "9512"),
      ev("2026-11-01", "acoes", "9512"),
      ev("2026-11-01", "acoes", "1"),
    ];
    expect(novidadesDaLista(e, lista)).toHaveLength(1);
    expect(novidadesDaLista(e, { ...lista, ultima_visita: null })).toEqual([]);
  });

  it("janela de 90 dias", () => {
    const e = [ev("2026-08-04", "acoes", "9512"), ev("2026-08-05", "acoes", "9512")];
    expect(eventosRecentes(e, lista, "2026-11-03").map((x) => x.data)).toEqual(["2026-08-05"]);
  });

  it("importação rejeita formato errado e remove repetidos", () => {
    expect(() => analisarLista("nao é json")).toThrow(/JSON válido/);
    expect(() => analisarLista('{"itens":[{"tipo":"x","chave":"1","nome":"a"}]}')).toThrow(/formato/);
    const ok = analisarLista(JSON.stringify({ itens: [lista.itens[0], lista.itens[0]] }));
    expect(ok.itens).toHaveLength(1);
    expect(ok.ultima_visita).toBeNull();
  });
});
