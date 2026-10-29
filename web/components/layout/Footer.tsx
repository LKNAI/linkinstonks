// Rodapé obrigatório em todas as páginas (seção 11.4). A data de atualização vem de meta.json (Fase 4).
export function Footer({ atualizadoEm }: { atualizadoEm?: string }) {
  return (
    <footer className="border-t border-line bg-surface px-4 py-6 text-sm text-ink-2 sm:px-7">
      <p className="mx-auto max-w-[1440px]">
        Fontes: B3 e CVM (dados públicos). Última atualização: {atualizadoEm ?? "—"}. Não é recomendação de
        investimento.
      </p>
    </footer>
  );
}
