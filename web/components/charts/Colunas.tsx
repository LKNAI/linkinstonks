"use client";

// Colunas simples clicáveis ("tickers por classe").
import { formatInt, formatPct } from "@/lib/format";
import { TipConteudo, useTip } from "./Tooltip";

export function Colunas({
  itens,
  selecionado,
  onSelecionar,
  rotuloDica,
  cor = "var(--accent)",
}: {
  itens: { k: string; n: number }[];
  selecionado: string | null;
  onSelecionar: (k: string) => void;
  rotuloDica: (k: string) => string;
  cor?: string;
}) {
  const tip = useTip();
  const max = Math.max(1, ...itens.map((i) => i.n));
  const total = itens.reduce((a, i) => a + i.n, 0);
  return (
    <>
      <div
        className={`cols${selecionado != null ? " has-sel" : ""}`}
        role="group"
        aria-label="Quantidade de tickers por classe"
      >
        {itens.map((i) => (
          <button
            key={i.k}
            type="button"
            className={`col${selecionado === i.k ? " sel" : ""}`}
            aria-pressed={selecionado === i.k}
            aria-label={`${rotuloDica(i.k)}: ${i.n} tickers`}
            onClick={() => onSelecionar(i.k)}
            {...tip(() => (
              <TipConteudo
                titulo={rotuloDica(i.k)}
                linhas={[
                  ["Tickers", formatInt(i.n)],
                  ["Participação", formatPct(i.n, total)],
                ]}
              />
            ))}
          >
            <span className="v">{formatInt(i.n)}</span>
            <span className="b" style={{ height: (i.n / max) * 140, background: cor }} />
          </button>
        ))}
      </div>
      <div className="xl" aria-hidden="true">
        {itens.map((i) => (
          <span key={i.k}>{i.k}</span>
        ))}
      </div>
    </>
  );
}
