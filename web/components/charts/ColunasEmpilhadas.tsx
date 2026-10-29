"use client";

// Colunas empilhadas: "trocas por ano" (variante anos) e "volume mensal por tipo" (variante meses).
import type { ReactNode } from "react";
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
  return (
    <div className={anos ? undefined : "mchart"}>
      <div
        className={`${anos ? "yrs" : "mcols"}${selecionada != null ? " has-sel" : ""}`}
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
          const classe = `${anos ? "yr" : "mc"}${selecionada === c.id ? " sel" : ""}`;
          return c.href ? (
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
              aria-pressed={selecionada === c.id}
              aria-label={c.rotuloAria}
              disabled={anos && !c.total}
              onClick={() => onSelecionar(c.id)}
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
  );
}
