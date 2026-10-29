// Estado na URL (seção 11.4): filtros, busca, ordenação e mês ficam na querystring, para que qualquer visão
// seja compartilhável. Sem `useSearchParams` do Next (que exigiria Suspense no export estático).
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface Codec<T> {
  /** Estado -> parâmetros. Valores padrão não devem aparecer (URL limpa). */
  codificar(estado: T): Record<string, string>;
  /** Parâmetros -> estado parcial; chaves ausentes ficam no padrão. */
  decodificar(p: URLSearchParams): Partial<T>;
}

export function paraQuery(params: Record<string, string>): string {
  const u = new URLSearchParams();
  for (const k of Object.keys(params).sort()) if (params[k] !== "") u.set(k, params[k]);
  const s = u.toString();
  return s ? `?${s}` : "";
}

/**
 * Estado de filtros sincronizado com a URL. No servidor e na primeira renderização usa `padrao`
 * (evita divergência de hidratação); depois de montado, lê a URL e passa a escrevê-la com `replaceState`.
 */
export function useEstadoUrl<T extends object>(
  padrao: T,
  codec: Codec<T>,
): [T, (f: (a: T) => T) => void, boolean] {
  const [estado, setEstado] = useState<T>(padrao);
  const [pronto, setPronto] = useState(false);
  const codecRef = useRef(codec);
  const padraoRef = useRef(padrao);

  useEffect(() => {
    const lido = codecRef.current.decodificar(new URLSearchParams(window.location.search));
    setEstado({ ...padraoRef.current, ...lido });
    setPronto(true);
  }, []);

  useEffect(() => {
    if (!pronto) return;
    const q = paraQuery(codecRef.current.codificar(estado));
    if (q !== window.location.search) window.history.replaceState(null, "", window.location.pathname + q);
  }, [estado, pronto]);

  const atualizar = useCallback((f: (a: T) => T) => setEstado(f), []);
  return [estado, atualizar, pronto];
}
