// Link que abre em nova aba: registros, fontes e listas filtradas, para quem compara sem perder a lista de onde veio.
// Menu, logo, migalhas e botões da Capa continuam na mesma aba (usam o Link comum).
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ComponentProps } from "react";

type Props = Omit<ComponentProps<typeof Link>, "target" | "rel">;

export function LinkNovaAba({ children, prefetch = false, ...resto }: Props) {
  return (
    <Link {...resto} prefetch={prefetch} target="_blank" rel="noopener noreferrer">
      {children}
      <ExternalLink className="nova-aba" size={14} strokeWidth={1.5} aria-hidden="true" />
      <span className="sr-only"> (abre em nova aba)</span>
    </Link>
  );
}
