"use client";

// Capa: KPIs dos dois painéis, data da última atualização por fonte, últimos eventos e atalhos.
import Link from "next/link";
import { Carregando, ErroDados, KpiGrid, PaginaComHero, type HeroProps } from "@/components/layout/Pagina";
import { derivar, kpisAcoes, type Kpi } from "@/lib/acoes";
import { derivarBdrs, kpisBdrs } from "@/lib/bdrs";
import { useDados } from "@/lib/data";
import { formatDate, formatInt } from "@/lib/format";

import { hojeEmBrasilia } from "@/lib/stale";

const NOME_FONTE: Record<string, string> = {
  b3_listed: "B3 · Empresas listadas",
  b3_bdr_api: "B3 · BDRs (API)",
  b3_cotahist: "B3 · Cotações (COTAHIST)",
  b3_finservices: "Banco B3 · programas de BDR",
  bradesco: "Bradesco Custódia",
  cvm_fca: "CVM · Formulário Cadastral",
  cvm_cad: "CVM · Cadastro de companhias",
};

const HERO: HeroProps = {
  selo: "B3 + CVM · dados abertos",
  titulo: "linkinstonks: escrituradores e BDRs",
  texto:
    "Quem escritura cada ação listada na B3 e qual banco é depositário de cada BDR, com histórico de trocas e volume mensal. Os dados se atualizam sozinhos a partir das fontes oficiais.",
};

export function Capa() {
  const acoes = useDados("acoes.json");
  const bdrs = useDados("bdrs.json");
  const meta = useDados("meta.json");
  const eventos = useDados("eventos.json");
  const erro = [acoes, bdrs, meta].find((e) => e.estado === "erro");
  if (erro?.estado === "erro") return <ErroDados mensagem={erro.mensagem} />;
  if (acoes.estado !== "ok" || bdrs.estado !== "ok" || meta.estado !== "ok")
    return (
      <PaginaComHero hero={HERO}>
        <Carregando comHero />
      </PaginaComHero>
    );

  const linhasA = derivar(acoes.dados.companhias);
  const linhasB = derivarBdrs(bdrs.dados.bdrs);
  const ano = Number(hojeEmBrasilia().slice(0, 4));
  const kA = kpisAcoes(linhasA, linhasA.length, ano);
  const kB = kpisBdrs(linhasB, bdrs.dados.meses).kpis;
  const destaques: Kpi[] = [kA[0], kA[2], kA[3], kB[0], kB[1], kB[4]].map((k, i) => ({
    ...k,
    rotulo: i < 3 ? `Ações · ${k.rotulo}` : `BDRs · ${k.rotulo}`,
  }));

  return (
    <PaginaComHero hero={HERO}>
      <div className="wrap">
        <KpiGrid kpis={destaques} />
        <div className="grid" style={{ marginTop: "var(--space-6)" }}>
          <section className="card c4" aria-labelledby="atalhos">
            <h2 id="atalhos">Painéis</h2>
            <p className="desc">Comece por aqui</p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "var(--space-3)" }}>
              <li>
                <Link prefetch={false} className="btn" href="/acoes/">
                  Ações: escrituradores
                </Link>
              </li>
              <li>
                <Link prefetch={false} className="btn" href="/acoes/tabela/">
                  Tabela completa de ações
                </Link>
              </li>
              <li>
                <Link prefetch={false} className="btn" href="/bdrs/">
                  BDRs: depositárias e volume
                </Link>
              </li>
            </ul>
          </section>

          <section className="card c4" aria-labelledby="fontes">
            <h2 id="fontes">Fontes e atualização</h2>
            <p className="desc">Último dia com coleta bem-sucedida</p>
            <table className="alt-table">
              <tbody>
                {Object.entries(meta.dados.fontes)
                  .sort((a, b) => a[0].localeCompare(b[0]))
                  .map(([k, f]) => (
                    <tr key={k}>
                      <th scope="row" style={{ textAlign: "left", fontWeight: "var(--fw-semibold)" }}>
                        {NOME_FONTE[k] ?? k}
                      </th>
                      <td>{f.status === "ok" ? formatDate(f.ultimo_sucesso ?? "") : `${f.status}`}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>

          <section className="card c4" aria-labelledby="novidades">
            <h2 id="novidades">Últimas mudanças</h2>
            <p className="desc">Trocas de escriturador, novas listagens e outros eventos</p>
            {eventos.estado === "ok" && eventos.dados.eventos.length ? (
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "var(--space-5)",
                  display: "grid",
                  gap: "var(--space-2)",
                  fontSize: "var(--fs-sm)",
                }}
              >
                {eventos.dados.eventos.slice(0, 6).map((e, i) => (
                  <li key={i}>
                    <b>{formatDate(e.data)}</b> · {e.tipo.replaceAll("_", " ")} · {e.chave}
                    {e.de || e.para ? ` (${e.de ?? "—"} → ${e.para ?? "—"})` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">
                Nenhuma mudança registrada ainda. O histórico começa na primeira coleta automática (
                {formatInt(linhasA.length)} empresas e {formatInt(linhasB.length)} BDRs na carga inicial).
              </p>
            )}
          </section>
        </div>
      </div>
    </PaginaComHero>
  );
}
