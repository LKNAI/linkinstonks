// Parâmetro ?em=AAAA-MM: de qual mês passado a tela mostra a posição. Sem `useSearchParams` (ver lib/url-state.ts).
"use client";

import { useSyncExternalStore } from "react";

const EVENTO = "painel:em";

function ler(): string | null {
  const m = new URLSearchParams(window.location.search).get("em");
  return m && /^\d{4}-\d{2}$/.test(m) ? m : null;
}

function assinar(f: () => void): () => void {
  window.addEventListener(EVENTO, f);
  window.addEventListener("popstate", f);
  return () => {
    window.removeEventListener(EVENTO, f);
    window.removeEventListener("popstate", f);
  };
}

export const useEm = (): string | null => useSyncExternalStore(assinar, ler, () => null);

export function trocarEm(mes: string | null): void {
  const u = new URL(window.location.href);
  if (mes) u.searchParams.set("em", mes);
  else u.searchParams.delete("em");
  window.history.replaceState(null, "", u);
  window.dispatchEvent(new Event(EVENTO));
}
