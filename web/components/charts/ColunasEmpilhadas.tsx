"use client";

// Colunas empilhadas: "trocas por ano" (variante anos) e "volume mensal por tipo" (variante meses).
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useMedia } from "@/lib/use-media";
import { useTip } from "./Tooltip";

export interface ParteColuna {
  cor: string;
  valor: number;
  nome: string;
}

export interface ColunaEmpilhada {
  id: string;
  /** Rótulo no eixo X. */
  eixo: string;
  /** Destaque do rótulo (janeiro, nos meses). */
  destaqueEixo?: boolean;
  total: number;
  /** Texto acima da coluna (variante anos). */
  topo?: string;
  partes: ParteColuna[];
  dica: () => ReactNode;
  rotuloAria: string;
  /** Se informado, a coluna é um link (abre em nova aba) em vez de um botão de seleção: usado para a fonte do dado. */
  href?: string;
}

export function ColunasEmpilhadas({
  colunas,
  selecionada,
  onSelecionar,
  variante,
  escalaMax,
  altura,
  grade,
}: {
  colunas: ColunaEmpilhada[];
  selecionada: string | null;
  onSelecionar: (id: string) => void;
  variante: "anos" | "meses";
  /** Valor que corresponde à altura total. */
  escalaMax: number;
  /** Altura em px da área das barras. */
  altura: number;
  grade?: { valor: number; rotulo: string }[];
}) {
  const tip = useTip();
  const anos = variante === "anos";
  const minimo = anos ? 2 : 1.5;
  const rolagem = useRef<HTMLDivElement>(null);
  // No toque, tocar numa coluna-link não pode abrir a página de cara: primeiro mostra o valor e deixa o link explícito.
  const toque = useMedia("(pointer: coarse)");
  const [lida, setLida] = useState<string | null>(null);
  const leitura = colunas.find((c) => c.id === lida && c.href);
  // Em tela estreita as colunas rolam na horizontal (cada uma com pelo menos 32 px de toque); começa no fim (o mais recente).
  const n = colunas.length;
  useEffect(() => {
    const el = rolagem.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [n]);
  return (
    <div className={anos ? "ychart" : "mchart"}>
      <div className="plot">
        {grade?.length ? (
          // valores do eixo Y fora da área que rola (só no celular; no desktop ficam em cada linha de grade)
          <div className="eixo-y" aria-hidden="true">
            {grade.map((g) => (
              <span key={g.valor} style={{ bottom: (g.valor / escalaMax) * altura }}>
                {g.rotulo}
              </span>
            ))}
          </div>
        ) : null}
        <div className="rolagem" ref={rolagem} style={{ "--n": n } as CSSProperties}>
          <div
            className={`${anos ? "yrs" : "mcols"}${selecionada != null || leitura ? " has-sel" : ""}`}
            role="group"
            aria-label="Colunas selecionáveis"
          >
            {grade?.map((g) => (
              <div key={g.valor} className="gridline" style={{ bottom: (g.valor / escalaMax) * altura }}>
                <span>{g.rotulo}</span>
              </div>
            ))}
            {colunas.map((c) => {
              const barra = (
                <>
                  {anos ? <span className="v">{c.topo ?? ""}</span> : null}
                  <span className="stk">
                    {c.partes
                      .filter((p) => p.valor)
                      .map((p) => (
                        <span
                          key={p.nome}
                          style={{
                            height: Math.max(minimo, (p.valor / escalaMax) * altura - 2),
                            background: p.cor,
                          }}
                        />
                      ))}
                  </span>
                </>
              );
              const marcada = c.href ? lida === c.id : selecionada === c.id;
              const classe = `${anos ? "yr" : "mc"}${marcada ? " sel" : ""}`;
              return c.href && !toque ? (
                <a
                  key={c.id}
                  href={c.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${classe} link`}
                  aria-label={`${c.rotuloAria}. Abrir a fonte oficial na B3 (nova aba)`}
                  {...tip(c.dica)}
                >
                  {barra}
                </a>
              ) : (
                <button
                  key={c.id}
                  type="button"
                  className={classe}
                  aria-pressed={marcada}
                  aria-label={c.rotuloAria}
                  disabled={anos && !c.total}
                  onClick={() => (c.href ? setLida((a) => (a === c.id ? null : c.id)) : onSelecionar(c.id))}
                  {...tip(c.dica)}
                >
                  {barra}
                </button>
              );
            })}
          </div>
          <div className={anos ? "yx" : "mx"} aria-hidden="true">
            {colunas.map((c) => (
              <span key={c.id} className={c.destaqueEixo ? "yr" : undefined}>
                {c.eixo}
              </span>
            ))}
          </div>
        </div>
      </div>
      <p className="rolagem-dica">Deslize para ver {anos ? "os anos" : "os meses"} anteriores</p>
      {leitura?.href ? (
        <div className="leitura" role="status">
          <span>{leitura.rotuloAria}</span>
          <a className="btn" href={leitura.href} target="_blank" rel="noopener noreferrer">
            Abrir arquivo oficial da B3 (nova aba)
          </a>
        </div>
      ) : null}
    </div>
  );
}
