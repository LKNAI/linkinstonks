"use client";

// Tooltip flutuante global (como o #tip do seed): segue o mouse e se reposiciona nas bordas da janela.
// Também aparece ao focar um elemento com o teclado.
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface Estado {
  conteudo: ReactNode;
  x: number;
  y: number;
  on: boolean;
}

interface Api {
  mostrar(x: number, y: number, conteudo: ReactNode): void;
  mover(x: number, y: number): void;
  esconder(): void;
}

const Ctx = createContext<Api | null>(null);

export function TooltipProvider({ children }: { children: ReactNode }) {
  const [e, setE] = useState<Estado>({ conteudo: null, x: 0, y: 0, on: false });
  const ref = useRef<HTMLDivElement>(null);
  const alvo = useRef({ x: 0, y: 0 });

  const posicionar = useCallback((cx: number, cy: number) => {
    const r = ref.current?.getBoundingClientRect();
    const w = r?.width ?? 0;
    const h = r?.height ?? 0;
    let x = cx + 14;
    let y = cy + 14;
    if (x + w > window.innerWidth - 8) x = cx - w - 14;
    if (y + h > window.innerHeight - 8) y = cy - h - 14;
    return { x: Math.max(8, x), y: Math.max(8, y) };
  }, []);

  const api = useMemo<Api>(
    () => ({
      mostrar(x, y, conteudo) {
        alvo.current = { x, y };
        setE((a) => ({ ...a, conteudo, on: true, ...posicionar(x, y) }));
      },
      mover(x, y) {
        alvo.current = { x, y };
        setE((a) => (a.on ? { ...a, ...posicionar(x, y) } : a));
      },
      esconder() {
        setE((a) => ({ ...a, on: false }));
      },
    }),
    [posicionar],
  );

  // Depois de renderizar o conteúdo novo, a largura mudou: reposiciona.
  useLayoutEffect(() => {
    if (!e.on) return;
    const p = posicionar(alvo.current.x, alvo.current.y);
    if (p.x !== e.x || p.y !== e.y) setE((a) => ({ ...a, ...p }));
  }, [e.conteudo, e.on, e.x, e.y, posicionar]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div id="tip" ref={ref} role="tooltip" className={e.on ? "on" : ""} style={{ left: e.x, top: e.y }}>
        {e.conteudo}
      </div>
    </Ctx.Provider>
  );
}

/** Props de evento para ligar um tooltip a qualquer elemento: `<button {...tip(() => <TipConteudo .../>)}>`. */
export function useTip() {
  const api = useContext(Ctx);
  return useCallback(
    (conteudo: () => ReactNode) => ({
      onMouseEnter: (ev: React.MouseEvent) => api?.mostrar(ev.clientX, ev.clientY, conteudo()),
      onMouseMove: (ev: React.MouseEvent) => api?.mover(ev.clientX, ev.clientY),
      onMouseLeave: () => api?.esconder(),
      onFocus: (ev: React.FocusEvent<Element>) => {
        const r = ev.currentTarget.getBoundingClientRect();
        api?.mostrar(r.left + r.width / 2, r.top, conteudo());
      },
      onBlur: () => api?.esconder(),
    }),
    [api],
  );
}

export function TipConteudo({
  titulo,
  cor,
  linhas,
}: {
  titulo: string;
  cor?: string | null;
  linhas: [ReactNode, ReactNode][];
}) {
  return (
    <>
      <div className="t">
        {cor ? <i style={{ background: cor }} /> : null}
        {titulo}
      </div>
      {linhas.map(([a, b], i) => (
        <div className="r" key={i}>
          <span>{a}</span>
          <b>{b}</b>
        </div>
      ))}
    </>
  );
}
