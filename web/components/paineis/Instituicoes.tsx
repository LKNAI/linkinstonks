"use client";

// /instituicoes: ranking de escrituradores (e ganhos/perdas de clientes no período) e de depositárias de BDR.
import { Estrela } from "@/components/acompanhamento/Estrela";
import { LinkNovaAba } from "@/components/layout/LinkNovaAba";
import { useMemo, useState } from "react";
import { VerComoEm } from "@/components/paineis/VerComoEm";
import { useEm } from "@/lib/em";
import {
  carregarAcoes as carregarAcoesEm,
  carregarBdrs as carregarBdrsEm,
  diferenca,
  UNIDADE_COMPANHIA,
  useSnapshot,
} from "@/lib/snapshots";
import { Carregando, ErroDados } from "@/components/layout/Pagina";
import { Seletor } from "@/components/filters/Controles";
import { Banco } from "@/components/paineis/celulas-acoes";
import { Migalhas } from "@/components/paineis/Detalhe";
import { derivar, filtrar, FILTROS_PADRAO, saldoDeTrocas } from "@/lib/acoes";
import { derivarBdrs } from "@/lib/bdrs";
import { corDepositaria } from "@/lib/colors";
import { useDados } from "@/lib/data";
import { formatDinheiro, formatInt, formatPct } from "@/lib/format";

import { hojeEmBrasilia } from "@/lib/stale";

const PERIODOS = [
  { v: "2010", texto: "Desde 2010 (todo o histórico)" },
  { v: "3", texto: "Últimos 3 anos" },
  { v: "1", texto: "Último ano" },
];

const carregarBdrsOpcional = (m: string) => carregarBdrsEm(m).catch(() => null);

export function Instituicoes() {
  const a = useDados("acoes.json");
  const b = useDados("bdrs.json");
  const em = useEm();
  const snapA = useSnapshot(em, carregarAcoesEm);
  const snapB = useSnapshot(em, carregarBdrsOpcional);
  const [periodo, setPeriodo] = useState("2010");
  const anoRef = Number(hojeEmBrasilia().slice(0, 4));

  const passadoA = snapA?.estado === "ok" ? snapA.dados.acoes : null;
  const passadoB = snapB?.estado === "ok" ? snapB.dados : null;
  const linhasA = useMemo(
    () => (passadoA ? derivar(passadoA) : a.estado === "ok" ? derivar(a.dados.companhias) : []),
    [a, passadoA],
  );
  const linhasB = useMemo(
    () =>
      em ? (passadoB ? derivarBdrs(passadoB.bdrs) : []) : b.estado === "ok" ? derivarBdrs(b.dados.bdrs) : [],
    [b, em, passadoB],
  );
  if (a.estado === "erro") return <ErroDados mensagem={a.mensagem} />;
  if (b.estado === "erro") return <ErroDados mensagem={b.mensagem} />;
  if (snapA?.estado === "erro")
    return (
      <>
        <VerComoEm pagina="acoes" />
        <ErroDados mensagem={snapA.mensagem} />
      </>
    );
  if (
    a.estado !== "ok" ||
    b.estado !== "ok" ||
    snapA?.estado === "carregando" ||
    snapB?.estado === "carregando"
  )
    return <Carregando />;

  const nMeses = passadoB?.meses.length ?? 24;
  const desde = periodo === "2010" ? 2010 : anoRef - Number(periodo) + 1;
  const comTicker = filtrar(linhasA, { ...FILTROS_PADRAO, onlyT: true });
  const porBanco: Record<string, number> = {};
  for (const d of comTicker) porBanco[d.b] = (porBanco[d.b] ?? 0) + 1;
  const trocasNoPeriodo = linhasA.filter((d) => d.yr && Number(d.yr) >= desde);
  const saldo = Object.fromEntries(saldoDeTrocas(trocasNoPeriodo).map((s) => [s.entidade, s]));
  const nomes = [...new Set([...Object.keys(porBanco), ...Object.keys(saldo)])].sort(
    (x, y) => (porBanco[y] ?? 0) - (porBanco[x] ?? 0) || x.localeCompare(y, "pt"),
  );

  const dep: Record<string, { n: number; vol: number }> = {};
  for (const d of linhasB) {
    dep[d.depositaria] ??= { n: 0, vol: 0 };
    dep[d.depositaria].n++;
    dep[d.depositaria].vol += d.tot;
  }
  const volTotal = linhasB.reduce((s, d) => s + d.tot, 0);
  const deps = Object.entries(dep).sort((x, y) => y[1].vol - x[1].vol);

  return (
    <div className="dash">
      <div className="wrap">
        <Migalhas itens={[{ href: "/", texto: "Início" }, { texto: "Instituições" }]} />
        <h1 className="page-title">Instituições: escrituradores e depositárias</h1>
        <p className="page-sub">
          Quem escritura mais empresas, quem ganhou e perdeu clientes, e quais bancos são depositários dos
          BDRs.
        </p>
        <VerComoEm
          pagina="acoes"
          resumo={
            passadoA
              ? `${formatInt(passadoA.length)} companhias nesta posição. ${diferenca(a.dados.companhias.length, passadoA.length, UNIDADE_COMPANHIA)}.`
              : undefined
          }
        />

        <div className="grid">
          <section className="card c12" aria-labelledby="t-esc">
            <div className="tbl-head">
              <div>
                <h2 id="t-esc">Escrituradores de ações</h2>
                <p className="desc" style={{ marginBottom: 0 }}>
                  Empresas negociadas por escriturador atual (B3) e saldo de trocas registradas na CVM no
                  período
                </p>
              </div>
              <Seletor rotulo="Período das trocas" valor={periodo} onChange={setPeriodo} opcoes={PERIODOS} />
            </div>
            <div className="tbl-wrap">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th scope="col">Escriturador</th>
                    <th scope="col" className="r">
                      Empresas
                    </th>
                    <th scope="col" className="r">
                      Participação
                    </th>
                    <th scope="col" className="r">
                      Conquistou
                    </th>
                    <th scope="col" className="r">
                      Perdeu
                    </th>
                    <th scope="col" className="r">
                      Saldo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {nomes.map((n) => {
                    const s = saldo[n];
                    const sal = (s?.ganhou ?? 0) - (s?.perdeu ?? 0);
                    return (
                      <tr key={n}>
                        <td>
                          <Estrela item={{ tipo: "instituicao", chave: n, nome: n }} />
                          <LinkNovaAba href={`/acoes/?bank=${encodeURIComponent(n)}`}>
                            <Banco nome={n} />
                          </LinkNovaAba>
                        </td>
                        <td className="r">{formatInt(porBanco[n] ?? 0)}</td>
                        <td className="r">{formatPct(porBanco[n] ?? 0, comTicker.length)}</td>
                        <td className="r">{s?.ganhou ? `+${s.ganhou}` : "—"}</td>
                        <td className="r">{s?.perdeu ? `−${s.perdeu}` : "—"}</td>
                        <td className="r">
                          <b style={{ color: sal > 0 ? "var(--ok)" : sal < 0 ? "var(--error)" : undefined }}>
                            {sal > 0 ? `+${sal}` : sal < 0 ? `−${-sal}` : "0"}
                          </b>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="note">
              Só empresas com ticker de ações. As trocas contam o ano em que o escriturador atual assumiu, nas
              empresas com data informada no FCA. Clique numa instituição para ver as empresas dela.
            </p>
          </section>

          {em && !passadoB ? (
            <p className="note c12">Não há posição de BDRs guardada para este mês.</p>
          ) : null}
          <section className="card c12" aria-labelledby="t-dep" hidden={!!em && !passadoB}>
            <h2 id="t-dep">Depositárias de BDR</h2>
            <p className="desc">
              Banco emissor dos programas, por volume financeiro em {nMeses} meses
              {passadoB?.reconstituido
                ? ". Depositária e tipo vêm do primeiro snapshot guardado, não da época"
                : ""}
            </p>
            <div className="tbl-wrap">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th scope="col">Depositária</th>
                    <th scope="col" className="r">
                      BDRs
                    </th>
                    <th scope="col" className="r">
                      Volume {nMeses} meses
                    </th>
                    <th scope="col" className="r">
                      Participação
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {deps.map(([n, v]) => (
                    <tr key={n}>
                      <td>
                        <Estrela item={{ tipo: "instituicao", chave: n, nome: n }} />
                        <LinkNovaAba href={`/bdrs/?dep=${encodeURIComponent(n)}`}>
                          <span className="dep">
                            <i style={{ background: corDepositaria(n) }} />
                            {n}
                          </span>
                        </LinkNovaAba>
                      </td>
                      <td className="r">{formatInt(v.n)}</td>
                      <td className="r">{formatDinheiro(v.vol)}</td>
                      <td className="r">{formatPct(v.vol, volTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
