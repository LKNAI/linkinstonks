"use client";

export function BotaoImprimir() {
  return (
    <button type="button" className="btn relatorio-imprimir" onClick={() => window.print()}>
      Imprimir ou salvar em PDF
    </button>
  );
}
