"use client";

// Tabela genérica e virtualizada (seção 5 do prompt). A ordenação e o filtro são do domínio (lib/acoes, lib/bdrs):
// aqui só se descrevem colunas, cabeçalhos clicáveis e linhas. TanStack Table monta o modelo de colunas e
// células; TanStack Virtual renderiza só as linhas visíveis (sem limite arbitrário de linhas).
import { createColumnHelper, tableFeatures, useTable, type RowData } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMemo, useRef, type ReactNode } from "react";

const features = tableFeatures({});

export interface ColunaSpec<T> {
  id: string;
  titulo: string;
  celula: (linha: T) => ReactNode;
  /** Classe do <td> (por linha). */
  classeTd?: (linha: T) => string;
  /** Classe do <th>. */
  classeTh?: string;
  /** Primeira coluna fixa à esquerda. */
  fixa?: boolean;
  /** `false` para colunas que não ordenam (sparkline). */
  ordenavel?: boolean;
}

export interface Ordem {
  k: string;
  dir: 1 | -1;
}

export function DataTable<T extends RowData>({
  dados,
  colunas,
  chave,
  ordem,
  onOrdenar,
  rotulo,
  vazio = "Nenhum registro corresponde aos filtros.",
  alturaEstimada = 64,
  larguraMinima = 1100,
}: {
  dados: readonly T[];
  colunas: readonly ColunaSpec<T>[];
  chave: (linha: T) => string;
  ordem: Ordem;
  onOrdenar: (id: string) => void;
  /** Nome acessível da tabela. */
  rotulo: string;
  vazio?: string;
  alturaEstimada?: number;
  larguraMinima?: number;
}) {
  const helper = useMemo(() => createColumnHelper<typeof features, T>(), []);
  const defs = useMemo(
    () =>
      colunas.map((c) =>
        helper.display({ id: c.id, header: c.titulo, cell: ({ row }) => c.celula(row.original) }),
      ),
    [colunas, helper],
  );
  const table = useTable({ features, columns: defs, data: dados as T[], getRowId: (_l, i) => String(i) });
  const rows = table.getRowModel().rows;
  const porId = useMemo(() => new Map(colunas.map((c) => [c.id, c])), [colunas]);

  const rolagem = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/incompatible-library -- API do TanStack Virtual; o resultado não é repassado a componentes memoizados
  const virt = useVirtualizer({
    count: rows.length,
    getScrollElement: () => rolagem.current,
    estimateSize: () => alturaEstimada,
    getItemKey: (i) => chave(rows[i].original),
    overscan: 8,
  });
  const itens = virt.getVirtualItems();
  const antes = itens.length ? itens[0].start : 0;
  const depois = itens.length ? virt.getTotalSize() - itens[itens.length - 1].end : 0;
  const n = colunas.length;

  return (
    <div className="tbl-wrap" ref={rolagem} tabIndex={0} role="region" aria-label={rotulo}>
      <table className="dtable" style={{ minWidth: larguraMinima }} aria-rowcount={rows.length}>
        <thead>
          <tr>
            {table.getHeaderGroups()[0].headers.map((h) => {
              const spec = porId.get(h.column.id) as ColunaSpec<T>;
              const ativa = ordem.k === spec.id;
              const ordenavel = spec.ordenavel !== false;
              return (
                <th
                  key={h.id}
                  scope="col"
                  className={[spec.classeTh, spec.fixa ? "sticky" : ""].filter(Boolean).join(" ")}
                  aria-sort={
                    ordenavel ? (ativa ? (ordem.dir > 0 ? "ascending" : "descending") : "none") : undefined
                  }
                >
                  {ordenavel ? (
                    <button type="button" onClick={() => onOrdenar(spec.id)}>
                      {spec.titulo}
                    </button>
                  ) : (
                    spec.titulo
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {!rows.length ? (
            <tr>
              <td colSpan={n} className="empty">
                {vazio}
              </td>
            </tr>
          ) : (
            <>
              {antes > 0 ? (
                <tr className="spacer" aria-hidden="true" style={{ height: antes }}>
                  <td colSpan={n} />
                </tr>
              ) : null}
              {itens.map((v) => {
                const row = rows[v.index];
                return (
                  <tr key={v.key} data-index={v.index} ref={virt.measureElement} aria-rowindex={v.index + 2}>
                    {row.getAllCells().map((cell) => {
                      const spec = porId.get(cell.column.id) as ColunaSpec<T>;
                      const cls = [spec.classeTd?.(row.original), spec.fixa ? "sticky" : ""]
                        .filter(Boolean)
                        .join(" ");
                      return (
                        <td key={cell.id} className={cls || undefined}>
                          <table.FlexRender cell={cell} />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {depois > 0 ? (
                <tr className="spacer" aria-hidden="true" style={{ height: depois }}>
                  <td colSpan={n} />
                </tr>
              ) : null}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
