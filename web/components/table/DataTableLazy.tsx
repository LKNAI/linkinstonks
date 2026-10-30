"use client";

// A tabela (TanStack Table + Virtual, ~30 KB gzip) é baixada sob demanda, em paralelo com o fetch dos dados:
// as telas só a desenham depois que o JSON chega, então ninguém espera por ela e o JS inicial da rota
// fica dentro do orçamento de 200 KB gzip.
import type { RowData } from "@tanstack/react-table";
import { lazy, Suspense } from "react";
import type { DataTable as DataTableReal } from "./DataTable";

const Carregada = lazy(() => import("./DataTable").then((m) => ({ default: m.DataTable })));

export function DataTable<T extends RowData>(props: Parameters<typeof DataTableReal<T>>[0]) {
  const Tabela = Carregada as unknown as typeof DataTableReal<T>;
  return (
    <Suspense
      fallback={
        <div
          role="status"
          className="p-6 text-[length:var(--fs-sm)]"
          style={{ color: "var(--text-subtle)", minHeight: 320 }}
        >
          Carregando tabela…
        </div>
      }
    >
      <Tabela {...props} />
    </Suspense>
  );
}
