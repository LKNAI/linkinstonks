"use client";

// Cartão de gráfico. Todo gráfico tem uma alternativa "ver como tabela" (acessibilidade, seção 11.4).
import { useId, useState, type ReactNode } from "react";

export interface TabelaAlternativa {
  cabecalho: string[];
  linhas: (string | number | ReactNode)[][];
}

export function ChartCard({
  titulo,
  descricao,
  tag,
  coluna,
  tabela,
  children,
  id,
  elastico,
}: {
  titulo: string;
  descricao?: string;
  tag?: string;
  /** Largura no grid de 12 colunas: "c3" | "c4" | "c5" | "c8" | "c12". */
  coluna: string;
  tabela?: TabelaAlternativa;
  children: ReactNode;
  id?: string;
  /** O gráfico cresce até a altura do cartão vizinho na mesma linha (só no desktop). */
  elastico?: boolean;
}) {
  const [comoTabela, setComoTabela] = useState(false);
  const uid = useId();
  return (
    <section className={`card ${coluna}${elastico ? " elastico" : ""}`} aria-labelledby={`${uid}-t`} id={id}>
      <div className="card-head">
        <div>
          <h2 id={`${uid}-t`}>{titulo}</h2>
          {descricao ? <p className="desc">{descricao}</p> : null}
        </div>
        <div className="card-tools">
          {tag ? <span className="tag">{tag}</span> : null}
          {tabela ? (
            <button
              type="button"
              className="as-table"
              aria-pressed={comoTabela}
              onClick={() => setComoTabela((v) => !v)}
            >
              {comoTabela ? "Ver gráfico" : "Ver como tabela"}
            </button>
          ) : null}
        </div>
      </div>
      {comoTabela && tabela ? (
        <div className="tbl-wrap" style={{ maxHeight: 360 }}>
          <table className="alt-table">
            <caption className="sr-only">{titulo}</caption>
            <thead>
              <tr>
                {tabela.cabecalho.map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabela.linhas.map((l, i) => (
                <tr key={i}>
                  {l.map((c, j) =>
                    j === 0 ? (
                      <th key={j} scope="row">
                        {c}
                      </th>
                    ) : (
                      <td key={j}>{c}</td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
