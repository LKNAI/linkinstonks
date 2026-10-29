// "Fonte do volume": de onde vem cada volume mensal de um BDR e como conferir (qualidade e rastreabilidade).
import { Cartao } from "@/components/paineis/Detalhe";
import { comoConferir, nomeDoArquivo, type FontesVolume } from "@/lib/fonte-volume";
import { rotuloMes } from "@/lib/format";

export function FonteVolume({
  ticker,
  meses,
  mesParcial,
  fontes,
  pagina,
}: {
  ticker: string;
  meses: string[];
  mesParcial: string | null;
  fontes: FontesVolume;
  pagina: string;
}) {
  const todos = [...meses, ...(mesParcial ? [mesParcial] : [])].reverse();
  return (
    <Cartao
      coluna="c12"
      titulo="Fonte do volume e como conferir"
      descricao="Cada barra e cada célula de volume mensal leva ao arquivo oficial da B3 de onde o número foi obtido"
    >
      <p style={{ margin: "0 0 10px", fontSize: 13, lineHeight: 1.55, color: "var(--ink-2)" }}>
        Fonte: B3, <b>Séries Históricas de cotações (COTAHIST)</b>, dados públicos. {comoConferir(ticker)} Os
        arquivos também estão listados na{" "}
        <a href={pagina} target="_blank" rel="noopener noreferrer" className="fonte-link">
          página oficial da B3
        </a>
        .
      </p>
      <details>
        <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          Arquivos de origem por mês ({todos.length})
        </summary>
        <div className="tbl-wrap" style={{ maxHeight: 320, marginTop: 8 }}>
          <table className="alt-table fonte-tab">
            <caption className="sr-only">Arquivos oficiais da B3 por mês de volume</caption>
            <thead>
              <tr>
                <th scope="col">Mês</th>
                <th scope="col">Origem</th>
                <th scope="col">Arquivo(s) oficial(is)</th>
              </tr>
            </thead>
            <tbody>
              {todos.map((m) => {
                const f = fontes[m];
                return (
                  <tr key={m}>
                    <td>{rotuloMes(m)}</td>
                    <td>{f?.tipo === "mensal" ? "Mensal (oficial)" : "Diários somados (parcial)"}</td>
                    <td>
                      {(f?.arquivos ?? []).map((u) => (
                        <a
                          key={u}
                          href={u}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="fonte-link"
                          style={{ marginRight: 10, display: "inline-block" }}
                        >
                          {nomeDoArquivo(u)}
                        </a>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </Cartao>
  );
}
