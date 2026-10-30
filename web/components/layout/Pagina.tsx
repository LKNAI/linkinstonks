// Peças comuns das páginas de painel: hero, KPIs e estados de carregando/erro.
import type { ReactNode } from "react";
import type { Kpi } from "@/lib/acoes";
import { ReguaProvider, ReguaSlot } from "./Regua";

export function Hero({ selo, titulo, texto }: { selo: string; titulo: string; texto: string }) {
  return (
    <section className="hero">
      <div className="wrap">
        <span className="eyebrow">{selo}</span>
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
          <div className="lbl">
            {k.cor.startsWith("var(") ? null : (
              <i className="dot" style={{ background: k.cor }} aria-hidden="true" />
            )}
            {k.rotulo}
          </div>
          <div className="val">{k.valor}</div>
          <div className="sub" title={k.sub}>
            {k.sub}
          </div>
        </div>
      ))}
    </div>
  );
}

export interface HeroProps {
  selo: string;
  titulo: string;
  texto: string;
}

/**
 * Página com cabeçalho persistente. O texto de apresentação é o maior elemento de texto da página: ele já está
 * no primeiro quadro e é o MESMO elemento do DOM antes e depois dos dados chegarem (se fosse recriado, o LCP
 * só seria registrado quando o painel terminasse de montar).
 */
export function PaginaComHero({ hero, children }: { hero: HeroProps; children: ReactNode }) {
  return (
    <ReguaProvider>
      <div className="dash">
        <ReguaSlot />
        <Hero {...hero} />
        {children}
      </div>
    </ReguaProvider>
  );
}

/** Estado de carregamento. A área reserva a altura da tela para o rodapé não pular quando os dados chegam (CLS). */
export function Carregando({
  rotulo = "Carregando dados…",
  comHero = false,
}: {
  rotulo?: string;
  comHero?: boolean;
}) {
  return (
    <div
      className="wrap"
      style={{ paddingTop: comHero ? 16 : 40, minHeight: "100vh" }}
      role="status"
      aria-live="polite"
    >
      <p className="sr-only">{rotulo}</p>
      <div className="skeleton" />
      <div className="skeleton" style={{ marginTop: "var(--space-4)", height: 320 }} />
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
  return (
    <div className="notes" role="note">
      {children}
    </div>
  );
}
