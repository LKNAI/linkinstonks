"use client";

// /status: saúde dos dados (por fonte, defasagem, BDRs sem depositária).
import Link from "next/link";
import { Carregando, ErroDados } from "@/components/layout/Pagina";
import { Migalhas } from "@/components/paineis/Detalhe";
import { useDados } from "@/lib/data";
import { formatDate, formatDinheiro, formatInt } from "@/lib/format";

import { diasEntre, fontesDesatualizadas, hojeEmBrasilia } from "@/lib/stale";

const NOME_FONTE: Record<string, string> = {
  b3_listed: "B3 · Empresas listadas",
  b3_bdr_api: "B3 · BDRs (API)",
  b3_cotahist: "B3 · Cotações de BDRs (COTAHIST)",
  b3_cotahist_acoes: "B3 · Cotações de ações (COTAHIST)",
  b3_finservices: "Banco B3 · programas de BDR",
  bradesco: "Bradesco Custódia",
  cvm_fca: "CVM · Formulário Cadastral",
  cvm_cad: "CVM · Cadastro de companhias",
};

export function Status() {
  const meta = useDados("meta.json");
  const bdrs = useDados("bdrs.json");
  if (meta.estado === "erro") return <ErroDados mensagem={meta.mensagem} />;
  if (bdrs.estado === "erro") return <ErroDados mensagem={bdrs.mensagem} />;
  if (meta.estado !== "ok" || bdrs.estado !== "ok") return <Carregando />;

  const hoje = hojeEmBrasilia();
  const atrasos = fontesDesatualizadas(meta.dados, hoje);
  const semDep = bdrs.dados.bdrs
    .filter((b) => b.depositaria === "Não identificado")
    .sort((a, b) => b.volume_24m - a.volume_24m);
  const volTotal = bdrs.dados.bdrs.reduce((s, b) => s + b.volume_24m, 0);
  const volSem = semDep.reduce((s, b) => s + b.volume_24m, 0);

  return (
    <div className="dash">
      <div className="wrap">
        <Migalhas itens={[{ href: "/", texto: "Início" }, { texto: "Status dos dados" }]} />
        <h1 className="page-title">Status dos dados</h1>
        <p className="status-resumo">
          {atrasos.length ? (
            <span className="badge warn">⚠ {atrasos.length} fonte(s) com atraso</span>
          ) : (
            <span className="badge ok">Todas as fontes em dia</span>
          )}
        </p>
        <p className="page-sub">
          Atualizado automaticamente pelo GitHub Actions; o histórico das execuções fica na aba Actions do
          repositório.
        </p>

        <div className="grid">
          <section className="card c8" aria-labelledby="t-fontes">
            <h2 id="t-fontes">Fontes</h2>
            <p className="desc">Fontes diárias avisam após 3 dias úteis sem coleta; semanais, após 10 dias</p>
            <div className="tbl-wrap">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th scope="col">Fonte</th>
                    <th scope="col">Situação</th>
                    <th scope="col">Último sucesso</th>
                    <th scope="col" className="r">
                      Defasagem
                    </th>
                    <th scope="col" className="r">
                      Itens
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(meta.dados.fontes)
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([k, f]) => {
                      const atraso = atrasos.find((x) => x.fonte === k);
                      return (
                        <tr key={k}>
                          <td>{NOME_FONTE[k] ?? k}</td>
                          <td>
                            <span
                              className={`badge ${f.status === "ok" && !atraso ? "ok" : f.status === "erro" ? "err" : "warn"}`}
                            >
                              {atraso ? "atrasada" : f.status}
                            </span>
                            {f.mensagem ? <div className="small">{f.mensagem}</div> : null}
                          </td>
                          <td>{f.ultimo_sucesso ? formatDate(f.ultimo_sucesso) : "—"}</td>
                          <td className="r">
                            {f.ultimo_sucesso ? `${diasEntre(f.ultimo_sucesso, hoje)} d` : "—"}
                          </td>
                          <td className="r">
                            {f.contagem != null
                              ? formatInt(f.contagem)
                              : f.ultimo_pregao
                                ? formatDate(f.ultimo_pregao)
                                : "—"}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card c4" aria-labelledby="t-ds">
            <h2 id="t-ds">Datasets</h2>
            <p className="desc">Última mudança de conteúdo</p>
            <table className="stats-table">
              <tbody>
                {Object.entries(meta.dados.datasets).map(([k, d]) => (
                  <tr key={k}>
                    <th scope="row">{k === "acoes" ? "Ações" : k === "bdrs" ? "BDRs" : k}</th>
                    <td>{formatDate(d.atualizado_em)}</td>
                    <td className="r">{formatInt(d.contagem)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="card c12" aria-labelledby="t-sem">
            <h2 id="t-sem">BDRs sem depositária identificada</h2>
            <p className="desc">
              {formatInt(semDep.length)} BDRs,{" "}
              {volTotal
                ? ((volSem / volTotal) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })
                : "0"}
              % do volume de 24 meses. Programas encerrados ou ausentes das listas consultadas. Quem souber a
              depositária pode informar via correção manual (<code>config/overrides/depositarias.csv</code>).
            </p>
            {semDep.length ? (
              <div className="tbl-wrap" style={{ maxHeight: 420 }}>
                <table className="stats-table">
                  <thead>
                    <tr>
                      <th scope="col">BDR</th>
                      <th scope="col">Nome</th>
                      <th scope="col" className="r">
                        Volume 24 meses
                      </th>
                      <th scope="col" className="r">
                        Mês parcial
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {semDep.map((b) => (
                      <tr key={b.ticker}>
                        <td>
                          <Link href={`/bdrs/${b.ticker}/`} prefetch={false}>
                            {b.ticker}
                          </Link>
                        </td>
                        <td>{b.nome}</td>
                        <td className="r">{formatDinheiro(b.volume_24m)}</td>
                        <td className="r">
                          {b.volume_mes_parcial != null ? formatDinheiro(b.volume_mes_parcial) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">Todos os BDRs têm depositária identificada.</p>
            )}
          </section>
        </div>
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
