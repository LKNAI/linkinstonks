"use client";

// Botão do cabeçalho e atalhos (Ctrl/Cmd+K e /). O diálogo e o índice só são baixados na primeira abertura.
import { Search } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";

const Dialogo = lazy(() => import("./BuscaDialogo"));

const emCampo = (el: EventTarget | null) => {
  const h = el as HTMLElement | null;
  return (
    !!h &&
    (h.tagName === "INPUT" || h.tagName === "TEXTAREA" || h.tagName === "SELECT" || h.isContentEditable)
  );
};

export function BotaoBusca() {
  const [aberto, setAberto] = useState(false);
  const origem = useRef<HTMLElement | null>(null);

  const abrir = useCallback(() => {
    origem.current = document.activeElement as HTMLElement | null;
    setAberto(true);
  }, []);
  const fechar = useCallback(() => {
    setAberto(false);
    origem.current?.focus();
  }, []);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        abrir();
      } else if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !emCampo(e.target)) {
        e.preventDefault();
        abrir();
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [abrir]);

  return (
    <>
      <button
        type="button"
        className="busca-botao"
        onClick={abrir}
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K Meta+K /"
      >
        <Search size={16} strokeWidth={1.5} aria-hidden />
        <span>Buscar</span>
        <kbd aria-hidden>Ctrl K</kbd>
      </button>
      {aberto ? (
        <Suspense fallback={null}>
          <Dialogo aoFechar={fechar} />
        </Suspense>
      ) : null}
    </>
  );
}
