"use client";

// Seletor "Ver como em" e faixa fixa da posição de um mês passado. Reconstituição nunca aparece como foto da época.
import { useEffect, useState } from "react";
import { Seletor } from "@/components/filters/Controles";
import { trocarEm, useEm } from "@/lib/em";
import { rotuloMes } from "@/lib/format";
import { carregarIndice, descreverPosicao, type IndiceSnapshots, type InfoMes } from "@/lib/snapshots";

type Pagina = "acoes" | "bdrs";

const AVISO: Record<Pagina, string> = {
  acoes:
    "Montada depois, a partir do histórico da CVM: só companhias atuais com escriturador conhecido na data. Não é foto da época.",
  bdrs: "Volume do COTAHIST; depositária e tipo vêm do primeiro snapshot guardado, não da época.",
};

export function VerComoEm({ pagina, resumo }: { pagina: Pagina; resumo?: string }) {
  const em = useEm();
  const [indice, setIndice] = useState<IndiceSnapshots | null>(null);
  useEffect(() => {
    carregarIndice().then(setIndice, () => setIndice({ meses: [] }));
  }, []);

  const meses = (indice?.meses ?? []).filter((m) => m[pagina]);
  const info: InfoMes | null | undefined = indice?.meses.find((m) => m.mes === em)?.[pagina];
  if (!meses.length && !em) return null;
  return (
    <>
      <div className="em-barra">
        <span aria-hidden>Ver como em:</span>
        <Seletor
          rotulo="Ver como em"
          valor={em ?? ""}
          onChange={(v) => trocarEm(v || null)}
          opcoes={[
            { v: "", texto: "Hoje" },
            ...meses.map((m) => ({
              v: m.mes,
              texto: `${rotuloMes(m.mes)}${m[pagina]?.reconstituido ? " (reconstituída)" : ""}`,
            })),
          ]}
        />
      </div>
      {em ? (
        <div className="em-faixa" role="status">
          <p>
            <b>
              Você está vendo a{" "}
              {info ? descreverPosicao({ mes: em, ...info }) : `posição de ${rotuloMes(em)}`}
              {info?.reconstituido ? " [reconstituída]" : ""}.
            </b>{" "}
            {info?.reconstituido ? AVISO[pagina] : null} {resumo}
          </p>
          <button type="button" className="btn" onClick={() => trocarEm(null)}>
            Voltar para hoje
          </button>
        </div>
      ) : null}
    </>
  );
}
