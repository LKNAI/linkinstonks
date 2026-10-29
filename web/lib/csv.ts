// Exportação CSV (Excel pt-BR): separador `;`, UTF-8 com BOM, linhas terminadas em \n.
export function escaparCsv(v: unknown): string {
  const s = String(v ?? "");
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function montarCsv(cabecalho: readonly string[], linhas: readonly (readonly unknown[])[]): string {
  return "﻿" + [cabecalho, ...linhas].map((l) => l.map(escaparCsv).join(";")).join("\n");
}

export function baixarCsv(nomeArquivo: string, conteudo: string): void {
  const url = URL.createObjectURL(new Blob([conteudo], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
