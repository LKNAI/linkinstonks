import type { Metadata } from "next";
import Link from "next/link";
import { Migalhas } from "@/components/paineis/Detalhe";
import { formatDinheiro } from "@/lib/format";
import { todosRelatorios } from "@/lib/servidor";

export const metadata: Metadata = {
  title: "Relatórios mensais",
  description: "O que mudou em cada mês: escrituradores, listagens, BDRs, volume e qualidade dos dados.",
};

export default function Page() {
  const lista = todosRelatorios();
  return (
    <div className="dash">
      <div className="wrap">
        <Migalhas itens={[{ href: "/", texto: "Início" }, { texto: "Relatórios" }]} />
        <h1 className="page-title">Relatórios mensais</h1>
        <p className="page-sub">
          Gerados automaticamente depois do fechamento de cada mês, com frases fixas a partir do log de
          eventos e dos arquivos oficiais.
        </p>
        <section className="card" aria-label="Lista de relatórios">
          {lista.length ? (
            <div className="tbl-wrap">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th scope="col">Relatório</th>
                    <th scope="col" className="r">
                      Volume de ações
                    </th>
                    <th scope="col" className="r">
                      Volume de BDRs
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((r) => (
                    <tr key={r.mes}>
                      <td>
                        <Link prefetch={false} href={`/relatorios/${r.mes}/`}>
                          {r.titulo}
                        </Link>
                      </td>
                      <td className="r">{formatDinheiro(r.resumo.volume_acoes)}</td>
                      <td className="r">{formatDinheiro(r.resumo.volume_bdrs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="state">
              <strong>Nenhum relatório gerado ainda.</strong>
              <p>O primeiro sai na rotina mensal, no dia 5 do mês seguinte ao fechamento.</p>
            </div>
          )}
        </section>
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
