import { describe, expect, it } from "vitest";
import {
  FILTROS_PADRAO,
  concentracaoVolume,
  csvAcoes,
  derivar,
  detalheAnterior,
  fatiasPorBanco,
  fatiasPorHistorico,
  fatiasPorSegmento,
  fatiasVolumePorBanco,
  fatiasVolumePorSegmento,
  filtrar,
  kpisAcoes,
  ordenar,
  rankingVolume,
  saldoDeTrocas,
  textoDesde,
  tickersPorClasse,
  topSetores,
  trocasPorAno,
  volumeMensalDe,
  type FiltrosAcoes,
} from "@/lib/acoes";
import { acoesDocSchema, acoesVolumeDocSchema } from "@/lib/schemas";
import { publico } from "../dados";

const rows = derivar(acoesDocSchema.parse(publico("acoes.json")).companhias);
const f = (p: Partial<FiltrosAcoes> = {}): FiltrosAcoes => ({ ...FILTROS_PADRAO, ...p });
const milhar = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

describe("painel de ações (dados reais)", () => {
  it("568 companhias; o padrão mostra só as com ticker", () => {
    expect(rows).toHaveLength(568);
    const comTicker = rows.filter((d) => d.tickers.length).length;
    expect(filtrar(rows, f())).toHaveLength(comTicker);
    expect(filtrar(rows, f({ onlyT: false }))).toHaveLength(568);
  });

  it("filtro cruzado: cada gráfico ignora só o seu próprio filtro", () => {
    const filtros = f({ onlyT: false, bank: "Itaú Corretora", hist: "Trocou de escriturador" });
    const todos = filtrar(rows, filtros);
    expect(todos.every((d) => d.b === "Itaú Corretora" && d.hist === "Trocou de escriturador")).toBe(true);
    const donutBanco = fatiasPorBanco(filtrar(rows, filtros, "bank"));
    expect(donutBanco.length).toBeGreaterThan(1);
    expect(donutBanco.reduce((a, i) => a + i.n, 0)).toBe(
      filtrar(rows, f({ onlyT: false, hist: "Trocou de escriturador" })).length,
    );
    const donutHist = fatiasPorHistorico(filtrar(rows, filtros, "hist"));
    expect(donutHist.reduce((a, i) => a + i.n, 0)).toBe(
      filtrar(rows, f({ onlyT: false, bank: "Itaú Corretora" })).length,
    );
  });

  it("busca sem acento e sem caixa, por nome, ticker e CNPJ com ou sem máscara", () => {
    expect(filtrar(rows, f({ onlyT: false, q: "petrobras" })).length).toBeGreaterThan(0);
    expect(filtrar(rows, f({ onlyT: false, q: "petr4" })).map((d) => d.pregao)).toContain("PETROBRAS");
    const cnpj = rows.find((d) => d.pregao === "PETROBRAS")!.cnpj;
    expect(filtrar(rows, f({ onlyT: false, q: cnpj.replace(/\D/g, "") }))).toHaveLength(1);
    expect(filtrar(rows, f({ onlyT: false, q: "itau corretora" })).length).toBeGreaterThan(100);
  });

  it("KPIs: totais e proporções coerentes com os dados", () => {
    const base = filtrar(rows, f());
    const k = kpisAcoes(base, rows.length, 2026);
    expect(k).toHaveLength(6);
    expect(k[0].valor).toBe(milhar(base.length));
    expect(k[0].sub).toContain("568");
    expect(k[4].rotulo).toBe("Trocas desde 2023");
    expect(k[5].sub).toMatch(/^Itaú Corretora · /);
  });

  it("segmentos, histórico e classes somam o total filtrado", () => {
    const base = filtrar(rows, f({ onlyT: false }));
    expect(fatiasPorSegmento(base).reduce((a, i) => a + i.n, 0)).toBe(568);
    expect(fatiasPorHistorico(base).reduce((a, i) => a + i.n, 0)).toBe(568);
    const classes = tickersPorClasse(base, null);
    expect(classes.reduce((a, c) => a + c.n, 0)).toBe(rows.reduce((a, d) => a + d.tickers.length, 0));
  });

  it("saldo de trocas: tudo que alguém ganha, alguém perdeu", () => {
    const s = saldoDeTrocas(rows);
    expect(s.reduce((a, l) => a + l.ganhou, 0)).toBe(s.reduce((a, l) => a + l.perdeu, 0));
    expect(s.reduce((a, l) => a + l.ganhou, 0)).toBe(rows.filter((d) => d.escriturador_cvm?.anterior).length);
  });

  it("trocas por ano: 2010 é o piso e só entram trocas com data real", () => {
    const t = trocasPorAno(rows, 2026, []);
    expect(t.anos[0]).toBe("2010");
    expect(t.anos.at(-1)).toBe("2026");
    expect(t.total).toBe(rows.filter((d) => d.yr).length);
    expect(
      rows
        .filter((d) => d.yr)
        .every((d) => d.escriturador_cvm?.anterior && !d.escriturador_cvm.inicio_aproximado),
    ).toBe(true);
  });

  it("setores: 10 maiores, mais o selecionado se ficar de fora", () => {
    expect(topSetores(rows, null)).toHaveLength(10);
    const top = topSetores(rows, null).map((x) => x.k);
    const raro = rows.map((d) => d.sec).find((s) => !top.includes(s))!;
    expect(topSetores(rows, raro)).toHaveLength(11);
  });

  it("ordenação: datas ausentes por último e anterior vazio por último", () => {
    expect(ordenar(rows, { k: "since", dir: 1 }).at(-1)!.since).toBe("");
    // o seed usa "~" para quem não tem anterior; no collation pt isso cai antes das letras (paridade mantida)
    const comAnterior = ordenar(rows, { k: "prev", dir: 1 })
      .map((d) => d.escriturador_cvm?.anterior)
      .filter(Boolean) as string[];
    expect(comAnterior).toEqual([...comAnterior].sort((x, y) => x.localeCompare(y, "pt", { numeric: true })));
    const cresc = ordenar(rows, { k: "pregao", dir: 1 });
    const decresc = ordenar(rows, { k: "pregao", dir: -1 });
    expect(decresc[0].pregao >= cresc[0].pregao).toBe(true);
  });

  it("textos da tabela: desde, aproximada, sem CVM e anterior", () => {
    const semCvm = rows.find((d) => !d.escriturador_cvm)!;
    expect(textoDesde(semCvm)).toEqual({ tipo: "sem-cvm", texto: "Sem dados na CVM" });
    const aprox = rows.find((d) => d.escriturador_cvm?.inicio_aproximado)!;
    expect(textoDesde(aprox).texto).toMatch(/^~\d{2}\/\d{4}$/);
    const trocou = rows.find((d) => d.escriturador_cvm?.anterior)!;
    expect(detalheAnterior(trocou)!.quando).toMatch(/até \d{2}\/\d{2}\/\d{4}|consta até o FCA de \d{4}/);
    expect(detalheAnterior(semCvm)).toBeNull();
  });

  it("CSV: BOM, separador ;, 18 colunas (19 na tabela completa) e uma linha por empresa", () => {
    const base = filtrar(rows, f());
    const a = csvAcoes(base, false);
    const b = csvAcoes(base, true);
    expect(a.startsWith("﻿Empresa;Razão social;Código;CNPJ;")).toBe(true);
    expect(a.split("\n")[0].split(";")).toHaveLength(18);
    expect(b.split("\n")[0].split(";")).toHaveLength(19);
    expect(b.split("\n")[0]).toContain("Código CVM");
    expect(a.split("\n")).toHaveLength(base.length + 1);
  });
});

describe("volume por companhia (acoes_volume.json cruzado por código CVM)", () => {
  const vol = acoesVolumeDocSchema.parse(publico("acoes_volume.json"));
  const comVol = derivar(acoesDocSchema.parse(publico("acoes.json")).companhias, vol.companhias);
  const base = filtrar(comVol, f());

  it("cada companhia do arquivo de volume casa com uma linha; as demais ficam sem volume", () => {
    expect(comVol.filter((d) => d.vol)).toHaveLength(vol.companhias.length);
    expect(comVol.filter((d) => d.vol === null).every((d) => d.v24 === null && d.vUlt === null)).toBe(true);
  });

  it("a soma mensal do filtro bate com a soma dos volumes das companhias", () => {
    const m = volumeMensalDe(base, vol.meses.length);
    const total = m.mensal.reduce((a, b) => a + b, 0);
    expect(total).toBe(base.reduce((a, d) => a + (d.v24 ?? 0), 0));
    expect(m.comVolume).toBe(base.filter((d) => d.vol).length);
  });

  it("o volume reage ao filtro: um escriturador soma menos que o todo", () => {
    const so = filtrar(comVol, f({ bank: "Banco Bradesco" }));
    const a = volumeMensalDe(so, vol.meses.length).mensal.reduce((x, y) => x + y, 0);
    const b = volumeMensalDe(base, vol.meses.length).mensal.reduce((x, y) => x + y, 0);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(b);
  });

  it("ranking em ordem decrescente e fatias por escriturador/segmento somam o total", () => {
    const rk = rankingVolume(base);
    expect(rk.itens).toHaveLength(15);
    expect(rk.itens[0].volume).toBeGreaterThanOrEqual(rk.itens[1].volume);
    expect(fatiasVolumePorBanco(base).reduce((a, x) => a + x.n, 0)).toBe(rk.total);
    expect(fatiasVolumePorSegmento(base).reduce((a, x) => a + x.n, 0)).toBe(rk.total);
  });

  it("concentração: cortes crescentes até 100% e 80% exige poucas empresas", () => {
    const rk = rankingVolume(base);
    const c = concentracaoVolume(rk.todas, rk.total);
    const partes = c.cortes.map((x) => x.parte);
    expect([...partes].sort((x, y) => x - y)).toEqual(partes);
    expect(partes.at(-1)).toBeLessThanOrEqual(1);
    expect(c.precisam80).toBeGreaterThan(0);
    expect(c.precisam80).toBeLessThan(c.comVolume);
  });

  it("ordenar por volume: maior primeiro em ordem decrescente; sem volume por último", () => {
    const o = ordenar(comVol, { k: "v24", dir: -1 });
    expect(o[0].v24).toBeGreaterThanOrEqual(o[1].v24 ?? 0);
    expect(o.at(-1)?.v24).toBeNull();
  });

  it("CSV com volume acrescenta duas colunas", () => {
    const sem = csvAcoes(base, true).split("\n")[0].split(";").length;
    const com = csvAcoes(base, true, true).split("\n")[0].split(";");
    expect(com).toHaveLength(sem + 2);
    expect(com.at(-2)).toBe("Volume 24m (R$)");
  });
});
