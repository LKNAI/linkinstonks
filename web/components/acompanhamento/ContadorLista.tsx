"use client";

// "N novidades na sua lista", no cabeçalho e na capa. Os eventos só são baixados se a lista tiver itens.
import Link from "next/link";
import { useEffect, useState } from "react";
import { novidadesDaLista, useLista } from "@/lib/acompanhamento";
import { carregar } from "@/lib/data";

export function ContadorLista({ className }: { className?: string }) {
  const lista = useLista();
  const [n, setN] = useState(0);
  const temItens = lista.itens.length > 0;
  useEffect(() => {
    if (!temItens) return;
    let vivo = true;
    carregar("eventos.json").then(
      (d) => vivo && setN(novidadesDaLista(d.eventos, lista).length),
      () => undefined,
    );
    return () => {
      vivo = false;
    };
  }, [lista, temItens]);
  if (!temItens || !n) return null;
  return (
    <Link prefetch={false} href="/acompanhamento/" className={className ?? "contador-lista"}>
      {n === 1 ? "1 novidade na sua lista" : `${n} novidades na sua lista`}
    </Link>
  );
}
