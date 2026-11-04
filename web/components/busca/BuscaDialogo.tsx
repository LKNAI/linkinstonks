"use client";

// Diálogo da busca global, baixado na primeira abertura. Padrão ARIA combobox: o foco fica no campo, e as setas
// movem a opção ativa. A estrela da opção é só para ponteiro; pelo teclado, Alt+A faz o mesmo no resultado ativo.
import { Search, Star, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { acompanha, alternar, useLista } from "@/lib/acompanhamento";
import {
  buscar,
  guardarHistorico,
  lerHistorico,
  prepararIndice,
  type IndiceBusca,
  type Resultado,
} from "@/lib/busca";
import { hojeEmBrasilia } from "@/lib/stale";

let indice: Promise<ReturnType<typeof prepararIndice>> | null = null;
function carregarIndice() {
  indice ??= fetch("/data/search-index.json")
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<IndiceBusca>;
    })
    .then(prepararIndice);
  indice.catch(() => (indice = null));
  return indice;
}

export default function BuscaDialogo({ aoFechar }: { aoFechar: () => void }) {
  const router = useRouter();
  const lista = useLista();
  const [consulta, setConsulta] = useState("");
  const [ativo, setAtivo] = useState(0);
  const [dados, setDados] = useState<Awaited<ReturnType<typeof prepararIndice>> | null>(null);
  const [erro, setErro] = useState(false);
  const [aviso, setAviso] = useState("");
  const [historico] = useState(lerHistorico);
  const campo = useRef<HTMLInputElement>(null);
  const fechar = useRef<HTMLButtonElement>(null);
  const idLista = useId();

  useEffect(() => {
    campo.current?.focus();
    carregarIndice().then(setDados, () => setErro(true));
    const estilo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = estilo;
    };
  }, []);

  const grupos = useMemo(() => (dados ? buscar(dados, consulta) : []), [dados, consulta]);
  const planos = useMemo(() => grupos.flatMap((g) => g.itens), [grupos]);
  const mostrarHistorico = !consulta.trim() && historico.length > 0;
  const total = mostrarHistorico ? historico.length : planos.length;
  const idOpcao = (i: number) => `${idLista}-${i}`;

  useEffect(() => {
    document.getElementById(idOpcao(ativo))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);

  const abrir = (r: Resultado) => {
    guardarHistorico(consulta);
    aoFechar();
    router.push(r.href);
  };

  const estrela = (r: Resultado) => {
    const tinha = acompanha(lista, r.tipo, r.chave);
    const gravou = alternar({ tipo: r.tipo, chave: r.chave, nome: r.titulo }, hojeEmBrasilia());
    setAviso(
      !gravou
        ? "Não foi possível guardar a lista neste navegador."
        : `${r.titulo} ${tinha ? "saiu da" : "entrou na"} sua lista.`,
    );
  };

  const teclas = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      aoFechar();
    } else if (e.key === "Tab") {
      // só há dois pontos de foco: o campo e o botão de fechar
      e.preventDefault();
      (document.activeElement === campo.current ? fechar.current : campo.current)?.focus();
    } else if (e.key === "ArrowDown" && total) {
      e.preventDefault();
      setAtivo((a) => (a + 1) % total);
    } else if (e.key === "ArrowUp" && total) {
      e.preventDefault();
      setAtivo((a) => (a - 1 + total) % total);
    } else if (e.key === "Enter" && document.activeElement === campo.current) {
      e.preventDefault();
      if (mostrarHistorico) {
        if (historico[ativo]) setConsulta(historico[ativo]);
        setAtivo(0);
      } else if (planos[ativo]) abrir(planos[ativo]);
    } else if (e.altKey && e.key.toLowerCase() === "a" && planos[ativo] && !mostrarHistorico) {
      e.preventDefault();
      estrela(planos[ativo]);
    }
  };

  return (
    <div
      className="busca-fundo"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) aoFechar();
      }}
    >
      <div className="busca" role="dialog" aria-modal="true" aria-label="Busca global" onKeyDown={teclas}>
        <div className="busca-campo">
          <Search size={20} strokeWidth={1.5} aria-hidden />
          <input
            ref={campo}
            type="text"
            role="combobox"
            aria-label="Buscar companhia, BDR ou instituição"
            aria-expanded={total > 0}
            aria-controls={idLista}
            aria-autocomplete="list"
            aria-activedescendant={total ? idOpcao(ativo) : undefined}
            placeholder="Ticker, nome, CNPJ, código CVM ou ISIN"
            autoComplete="off"
            spellCheck={false}
            value={consulta}
            onChange={(e) => {
              setConsulta(e.target.value);
              setAtivo(0);
            }}
          />
          <button
            ref={fechar}
            type="button"
            className="busca-fechar"
            onClick={aoFechar}
            aria-label="Fechar busca"
          >
            <X size={20} strokeWidth={1.5} aria-hidden />
          </button>
        </div>

        <div id={idLista} role="listbox" aria-label="Resultados" className="busca-lista">
          {mostrarHistorico ? (
            <div role="group" aria-label="Buscas recentes">
              <div className="busca-grupo" aria-hidden>
                Buscas recentes
              </div>
              {historico.map((h, i) => (
                <div
                  key={h}
                  id={idOpcao(i)}
                  role="option"
                  aria-selected={i === ativo}
                  className="busca-opcao"
                  onMouseMove={() => setAtivo(i)}
                  onClick={() => {
                    setConsulta(h);
                    setAtivo(0);
                    campo.current?.focus();
                  }}
                >
                  <b>{h}</b>
                </div>
              ))}
            </div>
          ) : null}
          {grupos.map((g, ig) => (
            <div key={g.tipo} role="group" aria-label={g.rotulo}>
              <div className="busca-grupo" aria-hidden>
                {g.rotulo}
              </div>
              {g.itens.map((r, j) => {
                const i = j + grupos.slice(0, ig).reduce((s, x) => s + x.itens.length, 0);
                const naLista = acompanha(lista, r.tipo, r.chave);
                return (
                  <div
                    key={`${r.tipo}-${r.chave}`}
                    id={idOpcao(i)}
                    role="option"
                    aria-selected={i === ativo}
                    aria-label={`${r.titulo}, ${r.detalhe}${naLista ? ", na sua lista" : ""}`}
                    className="busca-opcao"
                    onMouseMove={() => setAtivo(i)}
                    onClick={() => abrir(r)}
                  >
                    <span className="busca-texto">
                      <b>{r.titulo}</b>
                      <span>{r.detalhe}</span>
                    </span>
                    <span
                      className="busca-estrela"
                      data-ativa={naLista || undefined}
                      title={naLista ? "Remover da lista" : "Acompanhar"}
                      aria-hidden
                      onClick={(e) => {
                        e.stopPropagation();
                        estrela(r);
                      }}
                    >
                      <Star size={16} strokeWidth={1.5} aria-hidden />
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="busca-rodape">
          <span role="status" aria-live="polite">
            {erro
              ? "Não foi possível carregar o índice da busca. Feche e tente de novo."
              : aviso ||
                (!dados
                  ? "Carregando índice…"
                  : consulta.trim() && !planos.length
                    ? `Nada encontrado para “${consulta.trim()}”.`
                    : consulta.trim()
                      ? `${planos.length} resultado(s)`
                      : "")}
          </span>
          <span className="busca-dicas" aria-hidden>
            ↑↓ navegar · Enter abrir · Alt+A acompanhar · Esc fechar
          </span>
        </div>
      </div>
    </div>
  );
}
