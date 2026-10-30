// Carregamento dos JSON de /data com validação por zod. Cada arquivo é buscado uma vez por sessão.
"use client";

import { startTransition, useEffect, useState } from "react";
import type { ZodMiniType } from "zod/mini";

// Os schemas (zod) são baixados sob demanda, em paralelo com o fetch do JSON: ficam fora do JS inicial
// (orçamento de 200 KB gzip por rota) e ninguém espera por eles.
const SCHEMAS = {
  "acoes.json": () => import("@/lib/schemas").then((m) => m.acoesDocSchema),
  "acoes_volume.json": () => import("@/lib/schemas").then((m) => m.acoesVolumeDocSchema),
  "bdrs.json": () => import("@/lib/schemas").then((m) => m.bdrsDocSchema),
  "meta.json": () => import("@/lib/schemas").then((m) => m.metaSchema),
  "eventos.json": () => import("@/lib/schemas").then((m) => m.eventosDocSchema),
} as const;

export type Arquivo = keyof typeof SCHEMAS;
export type Doc<A extends Arquivo> =
  Awaited<ReturnType<(typeof SCHEMAS)[A]>> extends ZodMiniType<infer T> ? T : never;

export type Estado<T> =
  { estado: "carregando" } | { estado: "erro"; mensagem: string } | { estado: "ok"; dados: T };

const cache = new Map<string, Promise<unknown>>();

export function carregar<A extends Arquivo>(arquivo: A): Promise<Doc<A>> {
  let p = cache.get(arquivo) as Promise<Doc<A>> | undefined;
  if (!p) {
    const json = fetch(`/data/${arquivo}`).then((r) => {
      if (!r.ok) throw new Error(`${arquivo}: HTTP ${r.status}`);
      return r.json();
    });
    p = Promise.all([json, SCHEMAS[arquivo]()]).then(([j, schema]) => schema.parse(j) as Doc<A>);
    p.catch(() => cache.delete(arquivo)); // permite nova tentativa
    cache.set(arquivo, p);
  }
  return p;
}

export function useDados<A extends Arquivo>(arquivo: A): Estado<Doc<A>> {
  const [estado, setEstado] = useState<Estado<Doc<A>>>({ estado: "carregando" });
  useEffect(() => {
    let vivo = true;
    carregar(arquivo).then(
      // Em transição o React renderiza o painel em fatias de ~5 ms, sem monopolizar a thread principal
      // (tarefas longas pesam no TBT do Lighthouse); o "carregando" continua visível até a troca.
      (dados) => vivo && startTransition(() => setEstado({ estado: "ok", dados })),
      (e: unknown) =>
        vivo && setEstado({ estado: "erro", mensagem: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      vivo = false;
    };
  }, [arquivo]);
  return estado;
}
