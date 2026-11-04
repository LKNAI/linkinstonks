"use client";

// Os painéis grandes são baixados em paralelo com os dados: só são desenhados depois que o JSON chega, então ninguém
// espera por eles, e o JS inicial da rota fica dentro do orçamento de 200 KB gzip.
import { lazy, Suspense } from "react";
import { Carregando } from "@/components/layout/Pagina";

const Acoes = lazy(() => import("./PainelAcoes").then((m) => ({ default: m.PainelAcoes })));
const Bdrs = lazy(() => import("./PainelBdrs").then((m) => ({ default: m.PainelBdrs })));

export const PainelAcoes = () => (
  <Suspense fallback={<Carregando comHero />}>
    <Acoes />
  </Suspense>
);

export const PainelBdrs = () => (
  <Suspense fallback={<Carregando comHero />}>
    <Bdrs />
  </Suspense>
);
