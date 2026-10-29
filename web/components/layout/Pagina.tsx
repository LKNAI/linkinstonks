// Peças comuns das páginas de painel: hero, KPIs e estados de carregando/erro.
import type { ReactNode } from "react";
import type { Kpi } from "@/lib/acoes";

export function Hero({ selo, titulo, texto }: { selo: string; titulo: string; texto: string }) {
  return (
    <section className="hero">
      <div className="wrap">
        <span className="eyebrow">
          <i />
          {selo}
        </span>
        <h1>{titulo}</h1>
        <p>{texto}</p>
      </div>
    </section>
  );
}

export function KpiGrid({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="kpis" role="list" aria-label="Indicadores">
      {kpis.map((k) => (
        <div className="kpi" role="listitem" key={k.rotulo} style={{ "--c": k.cor } as React.CSSProperties}>
          <div className="lbl">{k.rotulo}</div>
          <div className="val">{k.valor}</div>
          <div className="sub" title={k.sub}>
            {k.sub}
          </div>
          {k.p != null ? (
            <div className="bar" aria-hidden="true">
              <span style={{ width: `${(k.p * 100).toFixed(1)}%` }} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function Carregando({ rotulo = "Carregando dados…" }: { rotulo?: string }) {
  return (
    <div className="wrap" style={{ paddingTop: 40 }} role="status" aria-live="polite">
      <p className="sr-only">{rotulo}</p>
      <div className="skeleton" />
      <div className="skeleton" style={{ marginTop: 16, height: 320 }} />
    </div>
  );
}

export function ErroDados({ mensagem }: { mensagem: string }) {
  return (
    <div className="wrap" role="alert">
      <div className="state err">
        <strong>Não foi possível carregar os dados.</strong>
        <p>{mensagem}</p>
      </div>
    </div>
  );
}

export function Notas({ children }: { children: ReactNode }) {
  return <footer className="notes">{children}</footer>;
}
