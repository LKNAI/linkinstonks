import { describe, expect, it } from "vitest";
import { NOME_FONTE, ROTULO_STATUS_FONTE, mudancaDoEvento, nomeDoItem } from "@/lib/rotulos";
import type { Acao, Evento } from "@/lib/schemas";

const evento = (p: Partial<Evento> = {}): Evento => ({
  chave: "25887",
  data: "2026-10-30",
  dataset: "acoes",
  de: null,
  fonte: "B3",
  para: null,
  tipo: "mudanca_segmento",
  ...p,
});
const acoes = [
  { codigo_cvm: "25887", pregao: "ARANDU", razao_social: "ARANDU INVESTIMENTOS S.A." },
] as Acao[];

describe("rótulos de fontes", () => {
  it("toda fonte gravada pelo ETL tem nome legível", () => {
    for (const id of ["b3_listed", "b3_bdr_api", "b3_cotahist", "b3_cotahist_acoes", "b3_finservices"]) {
      expect(NOME_FONTE[id], id).toBeTruthy();
    }
    expect(NOME_FONTE.b3_cotahist_acoes).toBe("B3 · Cotações de ações (COTAHIST)");
    expect(ROTULO_STATUS_FONTE.desatualizado).toBe("Desatualizada");
  });
});

describe("eventos legíveis", () => {
  it("ação: mostra o nome de pregão em vez do código CVM", () => {
    expect(nomeDoItem(evento(), acoes)).toBe("ARANDU");
  });
  it("BDR: o próprio ticker", () => {
    expect(nomeDoItem(evento({ dataset: "bdrs", chave: "TSLA34" }), acoes)).toBe("TSLA34");
  });
  it("deslistagem de empresa que já saiu da lista usa o pregão guardado no evento", () => {
    expect(nomeDoItem(evento({ tipo: "deslistagem", chave: "26611", de: "MNLT SA" }), acoes)).toBe("MNLT SA");
  });
  it("sem nenhuma pista, mostra o código com o prefixo CVM (nunca um nome inventado)", () => {
    expect(nomeDoItem(evento({ chave: "1" }), acoes)).toBe("CVM 1");
  });
  it("mudança de segmento usa os nomes dos segmentos", () => {
    expect(mudancaDoEvento(evento({ de: "NM", para: "B" }))).toBe("Novo Mercado → Tradicional");
  });
  it("deslistagem não repete o nome na coluna de mudança", () => {
    expect(mudancaDoEvento(evento({ tipo: "deslistagem", de: "MNLT SA" }))).toBeNull();
  });
  it("troca de escriturador mostra de → para", () => {
    expect(
      mudancaDoEvento(evento({ tipo: "troca_escriturador", de: "Banco Bradesco", para: "Itaú Corretora" })),
    ).toBe("Banco Bradesco → Itaú Corretora");
  });
});
