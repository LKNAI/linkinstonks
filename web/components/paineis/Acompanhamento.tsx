"use client";

// /acompanhamento: itens da lista com os dados atuais, eventos dos últimos 90 dias, exportação e importação.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Estrela } from "@/components/acompanhamento/Estrela";
import { ErroDados } from "@/components/layout/Pagina";
import { Migalhas } from "@/components/paineis/Detalhe";
import {
  analisarLista,
  armazenamentoDisponivel,
  eventosRecentes,
  lerLista,
  marcarVisita,
  novidadesDaLista,
  substituirLista,
  useLista,
  type ItemLista,
} from "@/lib/acompanhamento";
import { carregar, useDados } from "@/lib/data";
import { formatDate, formatDinheiro, formatInt } from "@/lib/format";
import { ROTULO_TIPO, mudancaDoEvento, nomeDoItem } from "@/lib/rotulos";
import { ROTULO_LIQUIDEZ } from "@/lib/rotulos-liquidez";
import { hojeEmBrasilia } from "@/lib/stale";

const ROTULO_ITEM = { companhia: "Companhia", bdr: "BDR", instituicao: "Instituição" } as const;

export function Acompanhamento() {
  const lista = useLista();
  const acoes = useDados("acoes.json");
  const bdrs = useDados("bdrs.json");
  const eventos = useDados("eventos.json");
  const [disponivel, setDisponivel] = useState(true);
  const [aviso, setAviso] = useState("");
  const arquivo = useRef<HTMLInputElement>(null);
  const hoje = hojeEmBrasilia();
  const [desde, setDesde] = useState<string | null>(null);

  // a contagem de novidades é a da chegada à página; só depois a visita é registrada
  useEffect(() => {
    let vivo = true;
    carregar("eventos.json").then(
      () => {
        if (!vivo) return;
        setDisponivel(armazenamentoDisponivel());
        setDesde(lerLista().ultima_visita);
        marcarVisita(hoje);
      },
      () => undefined,
    );
    return () => {
      vivo = false;
    };
  }, [hoje]);

  const companhias = useMemo(
    () => new Map((acoes.estado === "ok" ? acoes.dados.companhias : []).map((c) => [c.codigo_cvm, c])),
    [acoes],
  );
  const programas = useMemo(
    () => new Map((bdrs.estado === "ok" ? bdrs.dados.bdrs : []).map((b) => [b.ticker, b])),
    [bdrs],
  );
  const todos = useMemo(() => (eventos.estado === "ok" ? eventos.dados.eventos : []), [eventos]);
  const recentes = useMemo(() => eventosRecentes(todos, lista, hoje), [todos, lista, hoje]);
  const novos = useMemo(
    () => (desde ? novidadesDaLista(todos, { ...lista, ultima_visita: desde }) : []),
    [todos, lista, desde],
  );

  const erro = [acoes, bdrs, eventos].find((e) => e.estado === "erro");
  if (erro?.estado === "erro") return <ErroDados mensagem={erro.mensagem} />;

  const linha = (i: ItemLista): { href: string; atual: string } => {
    if (i.tipo === "companhia") {
      const c = companhias.get(i.chave);
      if (!c) return { href: `/acoes/${i.chave}/`, atual: "Não está mais no cadastro atual" };
      const esc = c.escriturador_b3.on ?? c.escriturador_b3.pn ?? "—";
      const liq = c.liquidez ? ROTULO_LIQUIDEZ[c.liquidez.categoria] : null;
      return { href: `/acoes/${i.chave}/`, atual: [`Escriturador: ${esc}`, liq].filter(Boolean).join(" · ") };
    }
    if (i.tipo === "bdr") {
      const b = programas.get(i.chave);
      if (!b) return { href: `/bdrs/${i.chave}/`, atual: "Não está mais no cadastro atual" };
      return {
        href: `/bdrs/${i.chave}/`,
        atual: `Depositária: ${b.depositaria} · ${formatDinheiro(b.volume_24m)} em 24 meses`,
      };
    }
    const emp = [...companhias.values()].filter(
      (c) => c.escriturador_b3.on === i.chave || c.escriturador_b3.pn === i.chave,
    ).length;
    const prog = [...programas.values()].filter((b) => b.depositaria === i.chave).length;
    return {
      href:
        emp || !prog
          ? `/acoes/?bank=${encodeURIComponent(i.chave)}`
          : `/bdrs/?dep=${encodeURIComponent(i.chave)}`,
      atual:
        [
          emp ? `${formatInt(emp)} empresas escrituradas` : null,
          prog ? `${formatInt(prog)} BDRs como depositária` : null,
        ]
          .filter(Boolean)
          .join(" · ") || "Sem empresas ou BDRs no cadastro atual",
    };
  };

  const exportar = () => {
    const url = URL.createObjectURL(
      new Blob([`${JSON.stringify(lista, null, 2)}\n`], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "linkinstonks-acompanhamento.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importar = async (f: File | undefined) => {
    if (!f) return;
    try {
      const nova = analisarLista(await f.text());
      setAviso(
        substituirLista({ ...nova, ultima_visita: nova.ultima_visita ?? hoje })
          ? `Lista importada com ${formatInt(nova.itens.length)} item(ns).`
          : "Não foi possível guardar a lista neste navegador.",
      );
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "Não foi possível ler o arquivo.");
    }
    if (arquivo.current) arquivo.current.value = "";
  };

  const nomes = acoes.estado === "ok" ? acoes.dados.companhias : [];
  return (
    <div className="dash">
      <div className="wrap">
        <Migalhas itens={[{ href: "/", texto: "Início" }, { texto: "Minha lista" }]} />
        <h1 className="page-title">Minha lista</h1>
        <p className="page-sub">
          Esta lista fica só neste navegador e não é enviada a lugar nenhum. Use a exportação para levá-la a
          outro aparelho.
        </p>

        {!disponivel ? (
          <div className="state" role="alert">
            <strong>A lista está desativada neste navegador.</strong>
            <p>O armazenamento local está bloqueado ou cheio. Libere-o nas configurações do navegador.</p>
          </div>
        ) : (
          <div className="grid">
            <section className="card c12" aria-labelledby="t-itens">
              <div className="tbl-head">
                <div>
                  <h2 id="t-itens">Itens acompanhados</h2>
                  <p className="desc" style={{ marginBottom: 0 }}>
                    {formatInt(lista.itens.length)} item(ns)
                    {novos.length ? ` · ${formatInt(novos.length)} novidade(s) desde a última visita` : ""}
                  </p>
                </div>
                <div className="acomp-acoes">
                  <button type="button" className="btn" onClick={exportar} disabled={!lista.itens.length}>
                    Exportar JSON
                  </button>
                  <button type="button" className="btn" onClick={() => arquivo.current?.click()}>
                    Importar JSON
                  </button>
                  <input
                    ref={arquivo}
                    type="file"
                    accept="application/json,.json"
                    hidden
                    aria-label="Arquivo da lista"
                    onChange={(e) => importar(e.target.files?.[0])}
                  />
                </div>
              </div>
              {aviso ? (
                <p className="note" role="status">
                  {aviso}
                </p>
              ) : null}
              {lista.itens.length ? (
                <div className="tbl-wrap">
                  <table className="stats-table">
                    <thead>
                      <tr>
                        <th scope="col">Item</th>
                        <th scope="col">Tipo</th>
                        <th scope="col">Dados atuais</th>
                        <th scope="col">Remover</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lista.itens.map((i) => {
                        const l = linha(i);
                        return (
                          <tr key={`${i.tipo}-${i.chave}`}>
                            <td>
                              <Link prefetch={false} href={l.href}>
                                {i.nome}
                              </Link>
                            </td>
                            <td>{ROTULO_ITEM[i.tipo]}</td>
                            <td>{acoes.estado === "ok" && bdrs.estado === "ok" ? l.atual : "Carregando…"}</td>
                            <td>
                              <Estrela item={i} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="state">
                  <strong>Sua lista está vazia.</strong>
                  <p>
                    Marque a estrela nas tabelas, nas páginas de detalhe ou nos resultados da busca (Ctrl+K).
                  </p>
                </div>
              )}
            </section>

            <section className="card c12" aria-labelledby="t-eventos">
              <h2 id="t-eventos">Eventos dos últimos 90 dias</h2>
              {recentes.length ? (
                <div className="tbl-wrap">
                  <table className="stats-table">
                    <thead>
                      <tr>
                        <th scope="col">Data</th>
                        <th scope="col">Evento</th>
                        <th scope="col">Item</th>
                        <th scope="col">Mudança</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentes.map((e, i) => (
                        <tr key={`${e.data}-${e.tipo}-${e.chave}-${i}`}>
                          <td>{formatDate(e.data)}</td>
                          <td>{ROTULO_TIPO[e.tipo] ?? e.tipo}</td>
                          <td>
                            <Link
                              prefetch={false}
                              href={e.dataset === "acoes" ? `/acoes/${e.chave}/` : `/bdrs/${e.chave}/`}
                            >
                              {nomeDoItem(e, nomes)}
                            </Link>
                          </td>
                          <td>{mudancaDoEvento(e) ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted">Nenhum evento dos itens da lista nos últimos 90 dias.</p>
              )}
            </section>
          </div>
        )}
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
