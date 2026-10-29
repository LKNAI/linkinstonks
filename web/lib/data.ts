// Carregamento dos JSON de /data com validação por zod. Cada arquivo é buscado uma vez por sessão.
"use client";

import { useEffect, useState } from "react";
import type { ZodType } from "zod";

export type Estado<T> =
  { estado: "carregando" } | { estado: "erro"; mensagem: string } | { estado: "ok"; dados: T };

const cache = new Map<string, Promise<unknown>>();

export function carregar<T>(arquivo: string, schema: ZodType<T>): Promise<T> {
  let p = cache.get(arquivo) as Promise<T> | undefined;
  if (!p) {
    p = fetch(`/data/${arquivo}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${arquivo}: HTTP ${r.status}`);
        return r.json();
      })
      .then((j) => schema.parse(j));
    p.catch(() => cache.delete(arquivo)); // permite nova tentativa
    cache.set(arquivo, p);
  }
  return p;
}

export function useDados<T>(arquivo: string, schema: ZodType<T>): Estado<T> {
  const [estado, setEstado] = useState<Estado<T>>({ estado: "carregando" });
  useEffect(() => {
    let vivo = true;
    carregar(arquivo, schema).then(
      (dados) => vivo && setEstado({ estado: "ok", dados }),
      (e: unknown) =>
        vivo && setEstado({ estado: "erro", mensagem: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      vivo = false;
    };
  }, [arquivo, schema]);
  return estado;
}
