"use client";

// /bdrs/mapa: o mapa de calor completo, com filtros e modo sincronizados com a URL.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Chips, Segmentado, Seletor } from "@/components/filters/Controles";
import { FiltrosSheet } from "@/components/filters/FiltrosSheet";
import { Carregando, ErroDados, PaginaComHero, type HeroProps } from "@/components/layout/Pagina";
import { SecaoMapa } from "@/components/paineis/SecaoMapa";
import { derivarBdrs, FILTROS_BDR_PADRAO, filtrarBdrs, type BdrRow } from "@/lib/bdrs";
import { useDados } from "@/lib/data";
import { formatInt, rotuloMes } from "@/lib/format";
import { linhasDoMapa, type ModoMapa, type OrdemMapa } from "@/lib/mapa";
import { CATEGORIA_SEM, DEPOSITARIAS, FAIXA_NOME, TIPO_GRUPO_NOME } from "@/lib/palette";
import { useEstadoUrl, type Codec } from "@/lib/url-state";

interface FiltrosMapa {
  dep: string | null;
  type: string | null;
  cat: string | null;
  faixa: string | null;
  n: string;
  modo: ModoMapa;
  ord: OrdemMapa;
  j: "" | "12" | "24";
}

const PADRAO: FiltrosMapa = {
  dep: null,
  type: null,
  cat: null,
  faixa: null,
  n: "50",
  modo: "intensidade",
  ord: "volume",
  j: "",
};
const DIMS = ["dep", "type", "cat", "faixa"] as const;
const LINHAS = ["25", "50", "100", "todos"];
const ORDENS: { v: OrdemMapa; texto: string }[] = [
  { v: "volume", texto: "Maior volume" },
  { v: "tendencia", texto: "Tendência: 6 meses × 6 anteriores" },
  { v: "alfabetica", texto: "Ordem alfabética" },
  { v: "pico", texto: "Mês do pico, mais recente antes" },
];

export const codecMapa: Codec<FiltrosMapa> = {
  codificar(f) {
    const p: Record<string, string> = {};
    for (const k of DIMS) if (f[k]) p[k] = f[k] as string;
    if (f.n !== PADRAO.n) p.n = f.n;
    if (f.modo !== PADRAO.modo) p.modo = f.modo;
    if (f.ord !== PADRAO.ord) p.ord = f.ord;
    if (f.j) p.j = f.j;
    return p;
  },
  decodificar(p) {
    const f: Partial<FiltrosMapa> = {};
    for (const k of DIMS) if (p.get(k)) f[k] = p.get(k);
    const n = p.get("n");
    if (n && LINHAS.includes(n)) f.n = n;
    if (p.get("modo") === "variacao") f.modo = "variacao";
    const ord = p.get("ord");
    if (ORDENS.some((o) => o.v === ord)) f.ord = ord as OrdemMapa;
    const j = p.get("j");
    if (j === "12" || j === "24") f.j = j;
    return f;
  },
};

const HERO: HeroProps = {
  selo: "Dados públicos B3",
  titulo: "Mapa de calor do volume dos BDRs",
  texto:
    "Cada linha é um BDR e cada coluna, um mês. Em intensidade, o tom compara o mês com o pico do próprio BDR; em variação, com a média dos 12 meses anteriores. Clique numa linha para abrir o BDR.",
};

export function PainelMapa() {
  const d = useDados("bdrs.json");
  if (d.estado === "erro") return <ErroDados mensagem={d.mensagem} />;
  return (
    <PaginaComHero hero={HERO}>
      {d.estado === "ok" ? <Conteudo bdrs={d.dados.bdrs} meses={d.dados.meses} /> : <Carregando comHero />}
    </PaginaComHero>
  );
}

function Conteudo({ bdrs, meses }: { bdrs: Parameters<typeof derivarBdrs>[0]; meses: string[] }) {
  const todos = useMemo(() => derivarBdrs(bdrs), [bdrs]);
  const [f, setF] = useEstadoUrl(PADRAO, codecMapa);
  // No celular o padrão é 12 meses; a escolha explícita fica na URL.
  const [largura24, setLargura24] = useLarguraPadrao();
  const janela: 12 | 24 = f.j ? (Number(f.j) as 12 | 24) : largura24 ? 24 : 12;
  useEffect(() => setLargura24(), [setLargura24]);

  const base: BdrRow[] = useMemo(
    () => filtrarBdrs(todos, { ...FILTROS_BDR_PADRAO, dep: f.dep, type: f.type, cat: f.cat, faixa: f.faixa }),
    [todos, f.dep, f.type, f.cat, f.faixa],
  );
  const linhas = useMemo(
    () => linhasDoMapa(base, f.n === "todos" ? null : Number(f.n), f.ord),
    [base, f.n, f.ord],
  );

  const chips = DIMS.filter((k) => f[k]).map((k) => ({
    id: k,
    rotulo: { dep: "Depositária", type: "Tipo", cat: "Classe", faixa: "Faixa" }[k],
    valor:
      k === "type"
        ? TIPO_GRUPO_NOME[f.type as keyof typeof TIPO_GRUPO_NOME]
        : k === "faixa"
          ? FAIXA_NOME[f.faixa as string]
          : (f[k] as string),
    onRemover: () => setF((a) => ({ ...a, [k]: null })),
  }));
  const categorias = [...new Set(todos.map((d) => d.C).filter(Boolean))].sort() as string[];
  const depositarias = [
    ...DEPOSITARIAS,
    ...[...new Set(todos.map((d) => d.depositaria))].filter(
      (x) => !(DEPOSITARIAS as readonly string[]).includes(x),
    ),
  ];

  return (
    <div className="wrap">
      <div className="filters">
        <div className="fbar">
          <FiltrosSheet ativos={chips.length}>
            <Seletor
              rotulo="Tipo"
              valor={f.type ?? ""}
              onChange={(v) => setF((a) => ({ ...a, type: v || null }))}
              opcoes={[
                { v: "", texto: "Todos os tipos" },
                ...Object.entries(TIPO_GRUPO_NOME).map(([v, texto]) => ({ v, texto })),
              ]}
            />
            <Seletor
              rotulo="Depositária"
              valor={f.dep ?? ""}
              onChange={(v) => setF((a) => ({ ...a, dep: v || null }))}
              opcoes={[
                { v: "", texto: "Todas as depositárias" },
                ...depositarias.map((v) => ({ v, texto: v })),
              ]}
            />
            <Seletor
              rotulo="Classe do ETF"
              valor={f.cat ?? ""}
              onChange={(v) => setF((a) => ({ ...a, cat: v || null }))}
              opcoes={[
                { v: "", texto: "Todas as classes" },
                ...categorias.map((v) => ({ v, texto: v === CATEGORIA_SEM ? "Sem categoria" : v })),
              ]}
            />
            <Seletor
              rotulo="Faixa de ticket"
              valor={f.faixa ?? ""}
              onChange={(v) => setF((a) => ({ ...a, faixa: v || null }))}
              opcoes={[
                { v: "", texto: "Todas as faixas" },
                ...Object.entries(FAIXA_NOME).map(([v, texto]) => ({ v, texto })),
              ]}
            />
          </FiltrosSheet>
          <Chips
            chips={chips}
            mostrarLimpar={chips.length > 0}
            onLimpar={() => setF((a) => ({ ...a, dep: null, type: null, cat: null, faixa: null }))}
          />
        </div>
      </div>
      <div className="grid">
        <SecaoMapa
          rows={linhas}
          meses={meses}
          modo={f.modo}
          janela={janela}
          titulo={f.modo === "intensidade" ? "Intensidade relativa" : "Variação contra a média"}
          descricao={`${formatInt(linhas.length)} de ${formatInt(base.length)} BDRs no filtro · ${rotuloMes(meses[0])} a ${rotuloMes(meses[meses.length - 1])} · clique num mês para usá-lo no ranking de /bdrs`}
          onMes={(i) => window.open(`/bdrs/?mes=${i}`, "_blank", "noopener")}
          acoes={
            <div className="mapa-controles">
              <Segmentado<ModoMapa>
                rotulo="Modo de cor"
                valor={f.modo}
                onChange={(modo) => setF((a) => ({ ...a, modo }))}
                opcoes={[
                  { v: "intensidade", texto: "Intensidade relativa" },
                  { v: "variacao", texto: "Variação contra a média" },
                ]}
              />
              <Segmentado
                rotulo="Número de linhas"
                valor={f.n}
                onChange={(n) => setF((a) => ({ ...a, n }))}
                opcoes={LINHAS.map((v) => ({ v, texto: v === "todos" ? "Todos" : v }))}
              />
              {f.modo === "intensidade" ? (
                <Segmentado
                  rotulo="Meses visíveis"
                  valor={String(janela)}
                  onChange={(j) => setF((a) => ({ ...a, j: j as "12" | "24" }))}
                  opcoes={[
                    { v: "12", texto: "12 meses" },
                    { v: "24", texto: "24 meses" },
                  ]}
                />
              ) : null}
              <Seletor
                rotulo="Ordem das linhas"
                valor={f.ord}
                onChange={(ord) => setF((a) => ({ ...a, ord: ord as OrdemMapa }))}
                opcoes={ORDENS}
              />
            </div>
          }
        />
      </div>
      <div className="notes" role="note">
        <p>
          <b>Fonte:</b> B3 · Séries históricas de cotações (<code>COTAHIST</code>), mercado à vista. A
          variação só existe nos 12 meses mais recentes: os anteriores não têm 12 meses de referência nos
          dados publicados.
        </p>
      </div>
    </div>
  );
}

/** Largo o bastante para os 24 meses? Começa em `true` para coincidir com o HTML gerado no build. */
function useLarguraPadrao(): [boolean, () => void] {
  const [largo, setLargo] = useState(true);
  const medir = useCallback(() => setLargo(window.matchMedia("(min-width: 1024px)").matches), []);
  return [largo, medir];
}
