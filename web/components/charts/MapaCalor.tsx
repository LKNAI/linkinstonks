"use client";

// Mapa de calor genérico: linhas × colunas num único SVG, com um <path> por cor em vez de um elemento por célula
// (2.400 células custam 9 elementos). O ponteiro e o teclado acham a célula por conta; o foco é um só elemento,
// com uma região aria-live que lê a célula. Acima de LIMITE_JANELA linhas, só o trecho visível é desenhado.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CELULA_SEM_NEGOCIOS, CELULA_SEM_REFERENCIA, type Celula } from "./celulas";
import { useTipApi } from "./Tooltip";

export interface LinhaMapa {
  id: string;
  rotulo: string;
  sub?: string;
  direita?: string;
  href?: string;
  celulas: Celula[];
}

export interface ColunaMapa {
  id: string;
  rotulo: string;
  /** Rótulo do ano, na primeira coluna de cada ano: desenha também o fio que separa os anos. */
  ano?: string;
}

const LIMITE_JANELA = 150;
const ALTURA_LINHA = 20;
const FOLGA_LINHAS = 20;

const classeDaCor = (escala: "seq" | "div", c: number): string =>
  escala === "seq"
    ? `mapa-seq-${c}`
    : c === 0
      ? "mapa-neutro"
      : `mapa-${c < 0 ? "frio" : "quente"}-${Math.abs(c)}`;

function montarCaminhos(linhas: readonly LinhaMapa[], ini: number, fim: number) {
  const porCor = new Map<number, string>();
  let vazias = "";
  let pontos = "";
  let semRef = "";
  let riscos = "";
  for (let i = ini; i < fim; i++) {
    const y = i - ini;
    linhas[i].celulas.forEach((c, j) => {
      if (c === CELULA_SEM_NEGOCIOS) {
        vazias += `M${j + 0.03} ${y + 0.08}h.94v.84h-.94z`;
        pontos += `M${j + 0.5} ${y + 0.5}h0`;
      } else if (c === CELULA_SEM_REFERENCIA) {
        semRef += `M${j} ${y}h1v1h-1z`;
        riscos += `M${j} ${y + 1}L${j + 1} ${y}`;
      } else {
        porCor.set(c, `${porCor.get(c) ?? ""}M${j} ${y}h1v1h-1z`);
      }
    });
  }
  return { porCor, vazias, pontos, semRef, riscos };
}

export function MapaCalor({
  linhas,
  colunas,
  escala,
  dica,
  textoCelula,
  onLinha,
  onColuna,
  colunaSelecionada,
  rotulo,
  tituloDireita,
  larguraMinimaCelula = 26,
}: {
  linhas: readonly LinhaMapa[];
  colunas: readonly ColunaMapa[];
  escala: "seq" | "div";
  dica: (linha: LinhaMapa, coluna: number) => ReactNode;
  /** Texto da célula lido pelo leitor de tela. */
  textoCelula: (linha: LinhaMapa, coluna: number) => string;
  /** Clique com o mouse ou Enter numa célula. */
  onLinha?: (linha: LinhaMapa) => void;
  onColuna?: (coluna: number) => void;
  colunaSelecionada?: number | null;
  rotulo: string;
  tituloDireita?: string;
  larguraMinimaCelula?: number;
}) {
  const api = useTipApi();
  const corpo = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [foco, setFoco] = useState<{ i: number; j: number } | null>(null);
  const [aviso, setAviso] = useState("");
  const [janela, setJanela] = useState({ ini: 0, fim: Math.min(linhas.length, LIMITE_JANELA) });
  const m = linhas.length;
  const n = colunas.length;
  const comJanela = m > LIMITE_JANELA;

  // Com muitas linhas, desenha só o trecho da página visível, com folga para a rolagem não mostrar buraco.
  useLayoutEffect(() => {
    if (!comJanela) return;
    const medir = () => {
      const topo = corpo.current?.getBoundingClientRect().top ?? 0;
      const primeira = Math.floor(-topo / ALTURA_LINHA);
      const ini = Math.max(0, primeira - FOLGA_LINHAS);
      const fim = Math.min(m, primeira + Math.ceil(window.innerHeight / ALTURA_LINHA) + FOLGA_LINHAS);
      setJanela((a) => (a.ini === ini && a.fim === fim ? a : { ini, fim }));
    };
    medir();
    window.addEventListener("scroll", medir, { passive: true });
    window.addEventListener("resize", medir);
    return () => {
      window.removeEventListener("scroll", medir);
      window.removeEventListener("resize", medir);
    };
  }, [comJanela, m]);

  const ini = comJanela ? Math.min(janela.ini, m - 1) : 0;
  const fim = comJanela ? Math.min(janela.fim, m) : m;
  const visiveis = fim - ini;
  const caminhos = useMemo(() => montarCaminhos(linhas, ini, fim), [linhas, ini, fim]);
  const grade = useMemo(() => {
    let d = "";
    for (let j = 1; j < n; j++) d += `M${j} 0V${visiveis}`;
    for (let i = 1; i < visiveis; i++) d += `M0 ${i}H${n}`;
    return d;
  }, [n, visiveis]);
  const fios = useMemo(() => {
    let d = "";
    colunas.forEach((c, j) => {
      if (c.ano && j > 0) d += `M${j} 0V${visiveis}`;
    });
    return d;
  }, [colunas, visiveis]);

  const celulaNoPonto = useCallback(
    (x: number, y: number) => {
      const r = svg.current?.getBoundingClientRect();
      if (!r || !r.width || !r.height) return null;
      const j = Math.floor(((x - r.left) / r.width) * n);
      const i = Math.floor(((y - r.top) / r.height) * visiveis) + ini;
      return i >= ini && i < fim && j >= 0 && j < n ? { i, j } : null;
    },
    [n, visiveis, ini, fim],
  );

  const mostrarNoFoco = useCallback(
    (i: number, j: number) => {
      const r = svg.current?.getBoundingClientRect();
      if (!r) return;
      api?.mostrar(
        r.left + (r.width * (j + 0.5)) / n,
        r.top + ((i - ini) * r.height) / visiveis,
        dica(linhas[i], j),
      );
    },
    [api, dica, linhas, n, ini, visiveis],
  );

  function aoTeclar(e: React.KeyboardEvent) {
    const atual = foco ?? { i: Math.max(ini, 0), j: n - 1 };
    const passos: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    if (e.key === "Enter") {
      if (foco) onLinha?.(linhas[foco.i]);
      return;
    }
    if (e.key === "Escape") {
      setFoco(null);
      api?.esconder();
      return;
    }
    let prox = atual;
    if (passos[e.key])
      prox = {
        i: Math.min(m - 1, Math.max(0, atual.i + passos[e.key][0])),
        j: Math.min(n - 1, Math.max(0, atual.j + passos[e.key][1])),
      };
    else if (e.key === "Home") prox = { ...atual, j: 0 };
    else if (e.key === "End") prox = { ...atual, j: n - 1 };
    else return;
    e.preventDefault();
    setFoco(prox);
    setAviso(textoCelula(linhas[prox.i], prox.j));
    if (comJanela || foco) {
      const topo = corpo.current?.getBoundingClientRect().top ?? 0;
      const y = topo + prox.i * ALTURA_LINHA;
      if (y < 80 || y > window.innerHeight - 80) window.scrollBy({ top: y - window.innerHeight / 2 });
    }
  }

  useEffect(() => {
    if (foco && foco.i >= ini && foco.i < fim) mostrarNoFoco(foco.i, foco.j);
    // A dica depende do foco e da janela; `mostrarNoFoco` muda junto com os dados.
  }, [foco, ini, fim, mostrarNoFoco]);

  useEffect(() => () => api?.esconder(), [api]);

  // Os dados mudaram (filtro, modo): o foco pode apontar para fora.
  const focoValido = foco && foco.i < m && foco.j < n ? foco : null;

  return (
    <div
      className="mapa"
      style={
        {
          "--mapa-colunas": n,
          "--mapa-celula-min": `${larguraMinimaCelula}px`,
          "--mapa-linha": `${ALTURA_LINHA}px`,
        } as React.CSSProperties
      }
    >
      <div className="mapa-rolagem">
        <div className={`mapa-tabela${tituloDireita ? " com-direita" : ""}`}>
          <div className="mapa-cab">
            <span className="mapa-canto" />
            <div className="mapa-meses">
              {colunas.map((c, j) => {
                const conteudo = (
                  <>
                    <span className="mapa-ano">{c.ano ?? ""}</span> {c.rotulo}
                  </>
                );
                return onColuna ? (
                  <button
                    key={c.id}
                    type="button"
                    className={`mapa-mes${c.ano ? " inicio-ano" : ""}`}
                    aria-pressed={colunaSelecionada === j}
                    aria-label={`${c.ano ? `${c.ano} ` : ""}${c.rotulo}: usar este mês no ranking`}
                    onClick={() => onColuna(j)}
                  >
                    {conteudo}
                  </button>
                ) : (
                  <span key={c.id} className={`mapa-mes${c.ano ? " inicio-ano" : ""}`}>
                    {conteudo}
                  </span>
                );
              })}
            </div>
            {tituloDireita ? <span className="mapa-titulo-dir">{tituloDireita}</span> : null}
          </div>
          <div className="mapa-corpo" ref={corpo} style={{ height: m * ALTURA_LINHA }}>
            <div className="mapa-janela" style={{ transform: `translateY(${ini * ALTURA_LINHA}px)` }}>
              <ul className="mapa-rotulos">
                {linhas.slice(ini, fim).map((l) => (
                  <li key={l.id}>
                    {l.href ? (
                      <a href={l.href} target="_blank" rel="noopener noreferrer" className="mapa-tk">
                        {l.rotulo}
                        <span className="sr-only"> (abre em nova aba)</span>
                      </a>
                    ) : (
                      <span className="mapa-tk">{l.rotulo}</span>
                    )}
                    {l.sub ? <span className="mapa-sub">{l.sub}</span> : null}
                  </li>
                ))}
              </ul>
              <div
                className="mapa-area"
                tabIndex={0}
                role="group"
                aria-label={`${rotulo}. Use as setas para percorrer as células e Enter para abrir o item.`}
                onKeyDown={aoTeclar}
                onBlur={() => {
                  setFoco(null);
                  api?.esconder();
                }}
              >
                <svg
                  ref={svg}
                  className="mapa-svg"
                  viewBox={`0 0 ${n} ${visiveis || 1}`}
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  style={{ height: visiveis * ALTURA_LINHA }}
                  onPointerMove={(e) => {
                    if (e.pointerType !== "mouse") return;
                    const c = celulaNoPonto(e.clientX, e.clientY);
                    if (!c) return api?.esconder();
                    api?.mostrar(e.clientX, e.clientY, dica(linhas[c.i], c.j));
                  }}
                  onPointerLeave={(e) => {
                    if (e.pointerType === "mouse") api?.esconder();
                  }}
                  onClick={(e) => {
                    const c = celulaNoPonto(e.clientX, e.clientY);
                    if (!c) return;
                    const toque = (e.nativeEvent as PointerEvent).pointerType === "touch";
                    if (toque) api?.mostrar(e.clientX, e.clientY, dica(linhas[c.i], c.j));
                    else onLinha?.(linhas[c.i]);
                  }}
                >
                  {[...caminhos.porCor].map(([c, d]) => (
                    <path key={c} className={classeDaCor(escala, c)} d={d} />
                  ))}
                  <path className="mapa-sem-ref" d={caminhos.semRef} />
                  <path className="mapa-sem-ref-risco" d={caminhos.riscos} />
                  <path className="mapa-grade" d={grade} />
                  <path className="mapa-vazia" d={caminhos.vazias} />
                  <path className="mapa-ponto" d={caminhos.pontos} />
                  <path className="mapa-fio" d={fios} />
                  {colunaSelecionada != null ? (
                    <rect className="mapa-sel" x={colunaSelecionada} y={0} width={1} height={visiveis} />
                  ) : null}
                  {focoValido && focoValido.i >= ini && focoValido.i < fim ? (
                    <>
                      <rect
                        className="mapa-foco-a"
                        x={focoValido.j}
                        y={focoValido.i - ini}
                        width={1}
                        height={1}
                      />
                      <rect
                        className="mapa-foco-b"
                        x={focoValido.j}
                        y={focoValido.i - ini}
                        width={1}
                        height={1}
                      />
                    </>
                  ) : null}
                </svg>
              </div>
              {tituloDireita ? (
                <ul className="mapa-direita" aria-hidden="true">
                  {linhas.slice(ini, fim).map((l) => (
                    <li key={l.id}>{l.direita}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <div className="sr-only" aria-live="polite">
        {aviso}
      </div>
    </div>
  );
}
