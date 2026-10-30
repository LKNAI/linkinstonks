"use client";

// Filtros em sheet inferior no celular (até 640 px). No desktop o componente some e os controles ficam inline,
// na barra de filtros. Como diálogo modal (só no celular): foco vai para dentro, Tab circula, Esc e o fundo fecham,
// e o foco volta ao botão que abriu.
import { SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

const CELULAR = "(max-width: 640px)";

function useCelular(): boolean {
  return useSyncExternalStore(
    (aviso) => {
      const m = window.matchMedia(CELULAR);
      m.addEventListener("change", aviso);
      return () => m.removeEventListener("change", aviso);
    },
    () => window.matchMedia(CELULAR).matches,
    () => false,
  );
}

const FOCAVEIS = 'button:not([disabled]), [href], input, select, [tabindex]:not([tabindex="-1"])';

export function FiltrosSheet({
  ativos,
  rotulo = "Filtros",
  children,
}: {
  /** Quantos filtros deste grupo estão ligados (aparece no botão). */
  ativos: number;
  rotulo?: string;
  children: ReactNode;
}) {
  const celular = useCelular();
  const [aberto, setAberto] = useState(false);
  const painel = useRef<HTMLDivElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);
  const titulo = useId();
  const modal = celular && aberto;

  const fechar = useCallback(() => {
    setAberto(false);
    gatilho.current?.focus();
  }, []);

  useEffect(() => {
    if (!modal) return;
    const el = painel.current;
    el?.querySelector<HTMLElement>(FOCAVEIS)?.focus();
    document.body.style.overflow = "hidden";
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") return fechar();
      if (e.key !== "Tab" || !el) return;
      const itens = [...el.querySelectorAll<HTMLElement>(FOCAVEIS)];
      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = "";
    };
  }, [modal, fechar]);

  return (
    <>
      <button
        ref={gatilho}
        type="button"
        className="btn fsheet-btn"
        aria-haspopup="dialog"
        aria-expanded={modal}
        onClick={() => setAberto(true)}
      >
        <SlidersHorizontal size={16} strokeWidth={1.5} aria-hidden="true" />
        {rotulo}
        {ativos > 0 ? (
          <span className="fsheet-n" aria-label={`${ativos} ativo${ativos > 1 ? "s" : ""}`}>
            {ativos}
          </span>
        ) : null}
      </button>
      {modal ? <div className="fsheet-fundo" onClick={fechar} aria-hidden="true" /> : null}
      <div
        ref={painel}
        className={`fsheet${modal ? " aberto" : ""}`}
        role={modal ? "dialog" : undefined}
        aria-modal={modal ? true : undefined}
        aria-labelledby={modal ? titulo : undefined}
      >
        <div className="fsheet-topo">
          <h2 id={titulo}>{rotulo}</h2>
          <button type="button" className="fsheet-x" aria-label="Fechar filtros" onClick={fechar}>
            <X size={20} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
        <div className="fsheet-corpo">{children}</div>
        <button type="button" className="btn fsheet-ok" onClick={fechar}>
          Ver resultados
        </button>
      </div>
    </>
  );
}
