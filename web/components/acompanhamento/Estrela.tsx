"use client";

// Botão de estrela: entra e sai da lista de acompanhamento. Sem armazenamento, informa o motivo no título.
import { Star } from "lucide-react";
import { useState } from "react";
import { acompanha, alternar, useLista, type ItemLista } from "@/lib/acompanhamento";
import { hojeEmBrasilia } from "@/lib/stale";

export function Estrela({ item, comTexto = false }: { item: ItemLista; comTexto?: boolean }) {
  const lista = useLista();
  const [falhou, setFalhou] = useState(false);
  const ativa = acompanha(lista, item.tipo, item.chave);
  const texto = ativa ? "Na sua lista" : "Acompanhar";
  // o nome sempre contém o texto visível (WCAG 2.5.3)
  const rotulo = falhou
    ? `${texto}: este navegador não permite guardar a lista`
    : ativa
      ? `Na sua lista. Remover ${item.nome} da lista`
      : `Acompanhar ${item.nome}`;
  return (
    <button
      type="button"
      className={comTexto ? "estrela estrela-texto" : "estrela"}
      aria-pressed={ativa}
      aria-label={rotulo}
      title={rotulo}
      disabled={falhou}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        setFalhou(!alternar(item, hojeEmBrasilia()));
      }}
    >
      <Star size={16} strokeWidth={1.5} aria-hidden />
      {comTexto ? <span>{texto}</span> : null}
    </button>
  );
}
