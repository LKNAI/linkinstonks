"use client";

import { useSyncExternalStore } from "react";

/** `window.matchMedia(consulta).matches`, reativo. No servidor (e na hidratação) devolve `false`. */
export function useMedia(consulta: string): boolean {
  return useSyncExternalStore(
    (aviso) => {
      const m = window.matchMedia(consulta);
      m.addEventListener("change", aviso);
      return () => m.removeEventListener("change", aviso);
    },
    () => window.matchMedia(consulta).matches,
    () => false,
  );
}
