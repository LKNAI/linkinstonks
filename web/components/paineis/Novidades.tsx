"use client";

// /novidades: eventos (trocas de escriturador, novas listagens, novos BDRs...), filtráveis por tipo, dataset e período.
import Link from "next/link";
import { useMemo, useState } from "react";
import { Carregando, ErroDados } from "@/components/layout/Pagina";
import { Seletor } from "@/components/filters/Controles";
import { Migalhas } from "@/components/paineis/Detalhe";
import { useDados } from "@/lib/data";
import { formatDate, formatInt } from "@/lib/format";
import { diasEntre, hojeEmBrasilia } from "@/lib/stale";
import { type Evento } from "@/lib/schemas";

export const ROTULO_TIPO: Record<string, string> = {
  nova_listagem: "Nova listagem",
  deslistagem: "Deslistagem",
  troca_escriturador: "Troca de escriturador",
  divergencia_b3_cvm: "Divergência B3 × CVM",
  ticker_novo: "Novo ticker",
  ticker_removido: "Ticker removido",
  mudanca_segmento: "Mudança de segmento",
  novo_bdr: "Novo BDR",
  bdr_cancelado: "BDR cancelado",
  troca_depositaria: "Troca de depositária",
};

const PERIODOS = [
  { v: "", texto: "Todo o período" },
  { v: "30", texto: "Últimos 30 dias" },
  { v: "90", texto: "Últimos 90 dias" },
  { v: "365", texto: "Último ano" },
];

function linkDoEvento(e: Evento): string {
  return e.dataset === "acoes" ? `/acoes/${e.chave}/` : `/bdrs/${e.chave}/`;
}

export function Novidades() {
  const d = useDados("eventos.json");
  const [tipo, setTipo] = useState("");
  const [dataset, setDataset] = useState("");
  const [periodo, setPeriodo] = useState("");
  const hoje = hojeEmBrasilia();

  const todos = useMemo(() => (d.estado === "ok" ? d.dados.eventos : []), [d]);
  const lista = useMemo(
    () =>
      todos.filter(
        (e) =>
          (!tipo || e.tipo === tipo) &&
          (!dataset || e.dataset === dataset) &&
          (!periodo || diasEntre(e.data, hoje) <= Number(periodo)),
      ),
    [todos, tipo, dataset, periodo, hoje],
  );
  if (d.estado === "erro") return <ErroDados mensagem={d.mensagem} />;
  if (d.estado === "carregando") return <Carregando />;

  return (
    <div className="dash">
      <div className="wrap">
        <Migalhas itens={[{ href: "/", texto: "Início" }, { texto: "Novidades" }]} />
        <h1 className="page-title">Novidades</h1>
        <p className="page-sub">
          Mudanças detectadas a cada coleta: trocas de escriturador, novas listagens, novos BDRs e outras.
          Acompanhe por leitor de RSS:{" "}
          <a href="/feed.xml" style={{ color: "var(--accent-hover)", fontWeight: 600 }}>
            feed Atom
          </a>
          .
        </p>

        <div
          className="filters"
          style={{
            position: "static",
            padding: 0,
            margin: "0 0 16px",
            background: "none",
            backdropFilter: "none",
          }}
        >
          <div className="fbar">
            <Seletor
              rotulo="Tipo de evento"
              valor={tipo}
              onChange={setTipo}
              opcoes={[
                { v: "", texto: "Todos os tipos" },
                ...Object.entries(ROTULO_TIPO).map(([v, texto]) => ({ v, texto })),
              ]}
            />
            <Seletor
              rotulo="Painel"
              valor={dataset}
              onChange={setDataset}
              opcoes={[
                { v: "", texto: "Ações e BDRs" },
                { v: "acoes", texto: "Só ações" },
                { v: "bdrs", texto: "Só BDRs" },
              ]}
            />
            <Seletor rotulo="Período" valor={periodo} onChange={setPeriodo} opcoes={PERIODOS} />
            <span className="count" aria-live="polite">
              <b>{formatInt(lista.length)}</b> de {formatInt(todos.length)} eventos
            </span>
          </div>
        </div>

        <section className="card" aria-label="Lista de eventos">
          {lista.length ? (
            <div className="tbl-wrap">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th scope="col">Data</th>
                    <th scope="col">Evento</th>
                    <th scope="col">Item</th>
                    <th scope="col">Mudança</th>
                    <th scope="col">Fonte</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((e, i) => (
                    <tr key={`${e.data}-${e.tipo}-${e.chave}-${i}`}>
                      <td>{formatDate(e.data)}</td>
                      <td>{ROTULO_TIPO[e.tipo] ?? e.tipo}</td>
                      <td>
                        <Link href={linkDoEvento(e)} prefetch={false}>
                          {e.chave}
                        </Link>
                      </td>
                      <td>{e.de || e.para ? `${e.de ?? "—"} → ${e.para ?? "—"}` : "—"}</td>
                      <td>{e.fonte}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="state">
              <strong>
                {todos.length ? "Nenhum evento com esses filtros." : "Nenhuma mudança registrada ainda."}
              </strong>
              {todos.length ? null : (
                <p>
                  O histórico de mudanças começa na primeira coleta automática depois da carga inicial. Quando
                  uma empresa trocar de escriturador ou um BDR novo estrear, ele aparece aqui.
                </p>
              )}
            </div>
          )}
        </section>
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
