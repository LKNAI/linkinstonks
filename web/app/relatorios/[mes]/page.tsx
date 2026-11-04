import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Migalhas } from "@/components/paineis/Detalhe";
import { BotaoImprimir } from "@/components/paineis/BotaoImprimir";
import { rotuloMes } from "@/lib/format";
import { todosRelatorios } from "@/lib/servidor";

type Props = { params: Promise<{ mes: string }> };

export const dynamicParams = false;
export const generateStaticParams = () => todosRelatorios().map((r) => ({ mes: r.mes }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { mes } = await params;
  const r = todosRelatorios().find((x) => x.mes === mes);
  return r
    ? { title: r.titulo, description: `O que mudou em ${rotuloMes(mes)} nos dados de ações e BDRs.` }
    : {};
}

export default async function Page({ params }: Props) {
  const { mes } = await params;
  const r = todosRelatorios().find((x) => x.mes === mes);
  if (!r) notFound();
  return (
    <div className="dash">
      <div className="wrap relatorio">
        <div className="relatorio-cabecalho" aria-hidden>
          linkinstonks · {r.titulo}
        </div>
        <div className="relatorio-corpo">
          <Migalhas
            itens={[
              { href: "/", texto: "Início" },
              { href: "/relatorios/", texto: "Relatórios" },
              { texto: rotuloMes(mes) },
            ]}
          />
          <h1 className="page-title">{r.titulo}</h1>
          <p className="page-sub">
            Texto gerado automaticamente a partir do log de eventos e dos arquivos oficiais da B3 e da CVM.
          </p>
          <BotaoImprimir />
          <div className="prose card" style={{ maxWidth: 900 }}>
            {r.secoes.map((s) => (
              <section key={s.id} aria-labelledby={`s-${s.id}`}>
                <h2 id={`s-${s.id}`}>{s.titulo}</h2>
                {s.itens.length ? (
                  <ul>
                    {s.itens.map((i) => (
                      <li key={i.texto}>
                        {i.href ? (
                          <Link prefetch={false} href={i.href}>
                            {i.texto}
                          </Link>
                        ) : (
                          i.texto
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>{s.vazio}</p>
                )}
              </section>
            ))}
          </div>
          <div style={{ height: 40 }} />
        </div>
        <div className="relatorio-rodape">
          Fontes: B3 e CVM (dados públicos). Referência: {rotuloMes(mes)}. Não é recomendação de investimento.
        </div>
      </div>
    </div>
  );
}
