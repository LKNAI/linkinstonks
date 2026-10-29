"use client";

// Controles da barra de filtros: busca, alternador, controle segmentado, chips e seletor.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { normalizar } from "@/lib/acoes";

export function Busca({
  valor,
  onChange,
  placeholder,
  rotulo = "Buscar",
}: {
  /** Valor já normalizado (sem acento, minúsculo), como fica no estado/URL. */
  valor: string;
  onChange: (normalizado: string) => void;
  placeholder: string;
  rotulo?: string;
}) {
  const [texto, setTexto] = useState(valor);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Mudança externa (limpar filtros, URL carregada): ressincroniza o campo.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronização com estado externo
    setTexto((t) => (normalizar(t.trim()) === valor ? t : valor));
  }, [valor]);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <label className="search">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        aria-label={rotulo}
        placeholder={placeholder}
        autoComplete="off"
        value={texto}
        onChange={(e) => {
          const v = e.target.value;
          setTexto(v);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => onChange(normalizar(v.trim())), 120);
        }}
      />
    </label>
  );
}

export function Alternador({
  ligado,
  onChange,
  children,
}: {
  ligado: boolean;
  onChange: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className="toggle" aria-pressed={ligado} onClick={onChange}>
      <span className="sw" />
      {children}
    </button>
  );
}

export function Segmentado<V extends string>({
  valor,
  opcoes,
  onChange,
  rotulo,
}: {
  valor: V;
  opcoes: { v: V; texto: string }[];
  onChange: (v: V) => void;
  rotulo: string;
}) {
  return (
    <div className="seg-ctl" role="group" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button key={o.v} type="button" aria-pressed={valor === o.v} onClick={() => onChange(o.v)}>
          {o.texto}
        </button>
      ))}
    </div>
  );
}

export function Chips({
  chips,
  mostrarLimpar,
  onLimpar,
}: {
  chips: { id: string; rotulo: string; valor: string; onRemover: () => void }[];
  mostrarLimpar: boolean;
  onLimpar: () => void;
}) {
  return (
    <>
      <div className="chips" aria-label="Filtros ativos">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            className="chip"
            onClick={c.onRemover}
            aria-label={`Remover filtro ${c.rotulo}: ${c.valor}`}
          >
            <b>{c.rotulo}:</b>
            {c.valor}
            <span className="x" aria-hidden="true">
              ✕
            </span>
          </button>
        ))}
      </div>
      {mostrarLimpar ? (
        <button type="button" className="clear" onClick={onLimpar}>
          Limpar filtros
        </button>
      ) : null}
    </>
  );
}

export function Seletor({
  valor,
  onChange,
  rotulo,
  opcoes,
}: {
  valor: string;
  onChange: (v: string) => void;
  rotulo: string;
  opcoes: { v: string; texto: string }[];
}) {
  return (
    <select className="select" aria-label={rotulo} value={valor} onChange={(e) => onChange(e.target.value)}>
      {opcoes.map((o) => (
        <option key={o.v} value={o.v}>
          {o.texto}
        </option>
      ))}
    </select>
  );
}
