"use client";

// O mapa é baixado sob demanda, em paralelo com o fetch dos dados: fica fora do JS inicial de /bdrs (orçamento de
// 200 KB gzip por rota), como a tabela.
import { lazy, Suspense, type ComponentProps } from "react";

const Carregado = lazy(() => import("./MapaCalor").then((m) => ({ default: m.MapaCalor })));

export function MapaCalor(props: ComponentProps<typeof Carregado>) {
  return (
    <Suspense
      fallback={
        <div role="status" className="note" style={{ minHeight: 320 }}>
          Carregando o mapa…
        </div>
      }
    >
      <Carregado {...props} />
    </Suspense>
  );
}
