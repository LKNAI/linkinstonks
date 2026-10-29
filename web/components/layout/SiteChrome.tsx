"use client";

// Cabeçalho, faixa de dados desatualizados e rodapé (com a data real do meta.json) de todas as páginas.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDados } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { metaSchema } from "@/lib/schemas";
import { fontesDesatualizadas, hojeEmBrasilia, ultimaAtualizacao } from "@/lib/stale";

const LINKS = [
  { href: "/", texto: "Capa" },
  { href: "/acoes/", texto: "Ações" },
  { href: "/acoes/tabela/", texto: "Tabela de ações" },
  { href: "/bdrs/", texto: "BDRs" },
  { href: "/instituicoes/", texto: "Instituições" },
  { href: "/novidades/", texto: "Novidades" },
  { href: "/status/", texto: "Status" },
  { href: "/sobre/", texto: "Sobre" },
];

export function SiteHeader() {
  const atual = usePathname();
  const ativo = (href: string) =>
    href === "/" ? atual === "/" : atual === href || atual === href.slice(0, -1);
  return (
    <header className="site-header">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2.5 sm:px-7">
        <Link prefetch={false} href="/" className="text-[15px] font-extrabold tracking-tight">
          linkinstonks
        </Link>
        <nav aria-label="Principal" className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-semibold">
          {LINKS.map((l) => (
            <Link
              prefetch={false}
              key={l.href}
              href={l.href}
              aria-current={ativo(l.href) ? "page" : undefined}
              className="nav-link"
            >
              {l.texto}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function StaleBanner() {
  const meta = useDados("meta.json", metaSchema);
  if (meta.estado !== "ok") return null;
  const atrasos = fontesDesatualizadas(meta.dados, hojeEmBrasilia());
  if (!atrasos.length) return null;
  return (
    <div role="status" className="stale">
      <strong>Atenção: alguns dados podem estar desatualizados.</strong>{" "}
      {atrasos.map((a) => `${a.rotulo}: ${a.motivo}`).join("; ")}.
    </div>
  );
}

export function SiteFooter() {
  const meta = useDados("meta.json", metaSchema);
  const data = meta.estado === "ok" ? ultimaAtualizacao(meta.dados) : null;
  return (
    <footer className="site-footer">
      <p className="mx-auto max-w-[1440px]">
        Fontes: B3 e CVM (dados públicos). Última atualização: {data ? formatDate(data) : "—"}. Não é
        recomendação de investimento.
      </p>
    </footer>
  );
}
