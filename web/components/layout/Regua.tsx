"use client";

// Régua de marcas: faixa plana de 4 px no topo da página, com dado real e a cor de cada instituição.
// O painel (que carrega os dados) preenche a faixa com `useRegua`; enquanto isso a faixa já ocupa os 4 px,
// então nada se desloca quando os dados chegam.
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { formatPct } from "@/lib/format";

export interface ParteRegua {
  nome: string;
  cor: string;
  valor: number;
}

type Setter = (partes: ParteRegua[]) => void;

const ReguaContext = createContext<Setter | null>(null);
const ReguaPartes = createContext<ParteRegua[]>([]);

export function ReguaProvider({ children }: { children: ReactNode }) {
  const [partes, setPartes] = useState<ParteRegua[]>([]);
  return (
    <ReguaContext.Provider value={setPartes}>
      <ReguaPartes.Provider value={partes}>{children}</ReguaPartes.Provider>
    </ReguaContext.Provider>
  );
}

/** Registra as partes da régua desta página (e as remove ao sair). */
export function useRegua(partes: ParteRegua[]) {
  const definir = useContext(ReguaContext);
  const ultima = useRef("");
  const chave = partes.map((p) => `${p.nome}|${p.cor}|${p.valor}`).join(";");
  const estavel = useMemo(() => partes, [chave]); // eslint-disable-line react-hooks/exhaustive-deps -- a chave resume o conteúdo
  useEffect(() => {
    if (!definir || ultima.current === chave) return;
    ultima.current = chave;
    definir(estavel);
  }, [definir, chave, estavel]);
  useEffect(
    () => () => {
      ultima.current = "";
      definir?.([]);
    },
    [definir],
  );
}

export function ReguaSlot() {
  const partes = useContext(ReguaPartes);
  const total = partes.reduce((a, p) => a + p.valor, 0);
  const rotulo = total
    ? `Participação de cada instituição: ${partes.map((p) => `${p.nome} ${formatPct(p.valor, total)}`).join(", ")}`
    : undefined;
  return (
    <div className="regua" role={rotulo ? "img" : undefined} aria-label={rotulo}>
      {total
        ? partes.map((p) => (
            <span
              key={p.nome}
              title={`${p.nome}: ${formatPct(p.valor, total)}`}
              style={{ flexGrow: p.valor, background: p.cor }}
            />
          ))
        : null}
    </div>
  );
}
