"use client";

// Barras divergentes: instituições que perderam (esquerda) e conquistaram (direita) empresas.
import type { ReactNode } from "react";
import { TipConteudo, useTip } from "./Tooltip";

export interface LinhaDivergente {
  nome: string;
  cor: string;
  perdeu: number;
  ganhou: number;
}

export function Divergentes({
  linhas,
  selPerdeu,
  selGanhou,
  onPerdeu,
  onGanhou,
}: {
  linhas: LinhaDivergente[];
  selPerdeu: string | null;
  selGanhou: string | null;
  onPerdeu: (nome: string) => void;
  onGanhou: (nome: string) => void;
}) {
  const tip = useTip();
  const max = Math.max(1, ...linhas.map((l) => Math.max(l.ganhou, l.perdeu)));
  const conteudoDica = (l: LinhaDivergente): ReactNode => (
    <TipConteudo
      titulo={l.nome}
      cor={l.cor}
      linhas={[
        ["Conquistou", l.ganhou],
        ["Perdeu", l.perdeu],
        ["Saldo", `${l.ganhou - l.perdeu > 0 ? "+" : ""}${l.ganhou - l.perdeu}`],
      ]}
    />
  );
  const dica = (l: LinhaDivergente) => () => conteudoDica(l);
  return (
    <div className={`dv${selPerdeu != null || selGanhou != null ? " has-sel" : ""}`}>
      <div className="dv-h" aria-hidden="true">
        <span>Perdeu</span>
        <span style={{ textAlign: "center" }}>Instituição</span>
        <span>Conquistou</span>
      </div>
      {linhas.map((l) => (
        <div className="dvr" key={l.nome}>
          <button
            type="button"
            className={`side l${selPerdeu === l.nome ? " sel" : ""}`}
            aria-pressed={selPerdeu === l.nome}
            aria-label={`${l.nome}: perdeu ${l.perdeu} empresas`}
            disabled={!l.perdeu}
            onClick={() => onPerdeu(l.nome)}
            {...tip(dica(l))}
          >
            <span className="bb" style={{ width: `${(l.perdeu / max) * 100}%` }} />
            <span className="t">{l.perdeu ? `−${l.perdeu}` : ""}</span>
          </button>
          <div className="nm" title={l.nome}>
            <i style={{ background: l.cor }} />
            {l.nome}
          </div>
          <button
            type="button"
            className={`side r${selGanhou === l.nome ? " sel" : ""}`}
            aria-pressed={selGanhou === l.nome}
            aria-label={`${l.nome}: conquistou ${l.ganhou} empresas`}
            disabled={!l.ganhou}
            onClick={() => onGanhou(l.nome)}
            {...tip(dica(l))}
          >
            <span className="bb" style={{ width: `${(l.ganhou / max) * 100}%` }} />
            <span className="t">{l.ganhou ? `+${l.ganhou}` : ""}</span>
          </button>
        </div>
      ))}
      {!linhas.length ? <p className="note">Nenhuma troca no filtro atual.</p> : null}
    </div>
  );
}
