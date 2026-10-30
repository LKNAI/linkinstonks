"use client";

// Catálogo interno (/design): tokens, tipografia, cores e componentes com os estados. Os valores dos tokens são
// lidos do CSS em tempo de execução, então não há literal de cor, tamanho ou raio duplicado aqui.
import { Search } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Donut } from "@/components/charts/Donut";
import { Sparkline } from "@/components/charts/Sparkline";
import { Alternador, Chips, Segmentado, Seletor } from "@/components/filters/Controles";
import { LinkNovaAba } from "@/components/layout/LinkNovaAba";
import { ErroDados, KpiGrid, Notas } from "@/components/layout/Pagina";
import { COR_ESCRITURADOR, coresDoConjunto } from "@/lib/colors";
import { formatInt, formatPct } from "@/lib/format";
import {
  CAT_ALT_COR,
  CAT_COR,
  TIPO_GRUPO_COR,
  TIPO_GRUPO_NOME,
  contraste,
  textoSobre,
  type TipoGrupo,
} from "@/lib/palette";

const NEUTROS = ["bg", "surface", "surface-raised", "surface-sunken", "border", "border-strong"];
const TEXTOS = ["text", "text-muted", "text-subtle"];
const DESTAQUE = ["accent", "accent-hover", "accent-soft", "on-accent"];
const STATUS = ["ok", "ok-soft", "warn", "warn-soft", "error", "error-soft", "stale"];
const CATEGORIAS = [
  "cat-1",
  "cat-2",
  "cat-3",
  "cat-none",
  "cat-alt-1",
  "cat-alt-2",
  "cat-alt-3",
  "cat-alt-4",
];
const ESCALA = ["xs", "sm", "md", "lg", "xl", "2xl", "kpi"];
const PESOS = ["regular", "medium", "semibold", "bold"];
const ESPACOS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16];
const RAIOS = ["none", "sm", "md", "lg", "round"];
const TIPOS = Object.keys(TIPO_GRUPO_NOME) as TipoGrupo[];
const MARCAS_PAR = ["Banco Bradesco", "Banco Santander", "Itaú Corretora", "Itaú Unibanco"];

function useToken(nome: string): string {
  const [v, setV] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lê o CSS computado depois da montagem
    setV(getComputedStyle(document.documentElement).getPropertyValue(`--${nome}`).trim());
  }, [nome]);
  return v;
}

function Amostra({ nome }: { nome: string }) {
  const valor = useToken(nome);
  return (
    <li className="ds-amostra">
      <span className="ds-cor" style={{ background: `var(--${nome})` }} aria-hidden="true" />
      <code>--{nome}</code>
      <span className="muted">{valor}</span>
    </li>
  );
}

function Secao({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <section className="ds-secao" aria-labelledby={id}>
      <h2 id={id}>{titulo}</h2>
      {children}
    </section>
  );
}

function Grupo({ titulo, nomes }: { titulo: string; nomes: string[] }) {
  return (
    <div>
      <h3>{titulo}</h3>
      <ul className="ds-lista">
        {nomes.map((n) => (
          <Amostra key={n} nome={n} />
        ))}
      </ul>
    </div>
  );
}

function Marcas({ itens }: { itens: [string, string][] }) {
  return (
    <ul className="ds-marcas">
      {itens.map(([nome, cor]) => (
        <li
          key={nome}
          style={{ background: cor, color: textoSobre(cor) }}
          title={`contraste ${contraste(textoSobre(cor), cor).toFixed(2).replace(".", ",")}:1`}
        >
          {nome}
        </li>
      ))}
    </ul>
  );
}

export function Catalogo() {
  const [seg, setSeg] = useState("a");
  const [lig, setLig] = useState(true);
  const [sel, setSel] = useState("x");
  const [fatia, setFatia] = useState<string | null>(null);
  const [chips, setChips] = useState(["Escriturador", "Segmento"]);
  const cores = coresDoConjunto(MARCAS_PAR);

  return (
    <div className="dash">
      <div className="wrap ds">
        <header>
          <p className="eyebrow">Catálogo interno</p>
          <h1>Design system</h1>
          <p className="muted">
            Direção A, “Livro-razão”: ameixa como destaque, IBM Plex, cor com função. Só tema claro. Decisões
            em docs/design-system.md.
          </p>
        </header>

        <Secao id="ds-cor" titulo="Cor">
          <div className="ds-grid">
            <Grupo titulo="Superfícies e bordas" nomes={NEUTROS} />
            <Grupo titulo="Texto" nomes={TEXTOS} />
            <Grupo titulo="Destaque do produto" nomes={DESTAQUE} />
            <Grupo titulo="Status de dados (nunca identidade de série)" nomes={STATUS} />
            <Grupo titulo="Categorias: rampa ameixa e neutros" nomes={CATEGORIAS} />
          </div>
        </Secao>

        <Secao id="ds-marcas" titulo="Cores de marca">
          <p className="muted">
            Vêm de config/instituicoes.yaml. O texto sobre a cor é escolhido pelo contraste (passe o mouse
            para ver a razão). Quando um par confuso aparece junto num gráfico, o membro ajustado ganha uma
            variante.
          </p>
          <Marcas itens={Object.entries(COR_ESCRITURADOR)} />
          <p>
            <strong>No mesmo gráfico:</strong>
          </p>
          <Marcas itens={MARCAS_PAR.map((n) => [n, cores(n)])} />
        </Secao>

        <Secao id="ds-tipo" titulo="Tipografia">
          <ul className="ds-tipo">
            {ESCALA.map((t) => (
              <li key={t} style={{ fontSize: `var(--fs-${t})`, lineHeight: `var(--lh-${t})` }}>
                <code>--fs-{t}</code> Quem escritura cada ação: R$ 1.234.567,89
              </li>
            ))}
          </ul>
          <ul className="ds-tipo">
            {PESOS.map((p) => (
              <li key={p} style={{ fontWeight: `var(--fw-${p})` }}>
                <code>--fw-{p}</code> Banco Bradesco
              </li>
            ))}
          </ul>
          <p>
            Ticker em monoespaçada: <span className="tk">PETR4</span> CNPJ{" "}
            <span style={{ fontFamily: "var(--font-mono)" }}>60.746.948/0001-12</span>
          </p>
        </Secao>

        <Secao id="ds-forma" titulo="Espaço, raio, elevação e movimento">
          <ul className="ds-lista">
            {ESPACOS.map((n) => (
              <li key={n} className="ds-amostra">
                <span className="ds-barra" style={{ width: `var(--space-${n})` }} aria-hidden="true" />
                <code>--space-{n}</code>
              </li>
            ))}
          </ul>
          <ul className="ds-lista ds-fila">
            {RAIOS.map((r) => (
              <li key={r} className="ds-amostra">
                <span
                  className="ds-caixa"
                  style={{ borderRadius: `var(--radius-${r})` }}
                  aria-hidden="true"
                />
                <code>--radius-{r}</code>
              </li>
            ))}
            {["float", "modal"].map((s) => (
              <li key={s} className="ds-amostra">
                <span className="ds-caixa" style={{ boxShadow: `var(--shadow-${s})` }} aria-hidden="true" />
                <code>--shadow-{s}</code>
              </li>
            ))}
          </ul>
          <p className="muted">
            Movimento: <code>--dur</code> e <code>--ease</code>, só como resposta a ação; respeita
            prefers-reduced-motion.
          </p>
        </Secao>

        <Secao id="ds-controles" titulo="Controles e selos">
          <div className="ds-fila">
            <button type="button" className="btn">
              Botão
            </button>
            <button type="button" className="btn" aria-pressed="true">
              Pressionado
            </button>
            <button type="button" className="btn" disabled>
              Desabilitado
            </button>
            <label className="search">
              <Search size={16} strokeWidth={1.5} aria-hidden="true" />
              <input type="search" aria-label="Exemplo de busca" placeholder="Buscar ticker, empresa…" />
            </label>
            <Alternador ligado={lig} onChange={() => setLig((v) => !v)}>
              Somente com ticker
            </Alternador>
            <Segmentado
              rotulo="Exemplo"
              valor={seg}
              onChange={setSeg}
              opcoes={[
                { v: "a", texto: "Todas" },
                { v: "b", texto: "Negociadas" },
                { v: "c", texto: "Sem negócios" },
              ]}
            />
            <Seletor
              rotulo="Exemplo de lista"
              valor={sel}
              onChange={setSel}
              opcoes={[
                { v: "x", texto: "Todos os escrituradores" },
                { v: "y", texto: "Banco Bradesco" },
              ]}
            />
          </div>
          <div className="ds-fila">
            <LinkNovaAba href="/acoes/9512/">Link para registro ou fonte (abre em nova aba)</LinkNovaAba>
          </div>
          <div className="ds-fila">
            <Chips
              chips={chips.map((c) => ({
                id: c,
                rotulo: c,
                valor: "exemplo",
                onRemover: () => setChips((l) => l.filter((x) => x !== c)),
              }))}
              mostrarLimpar={chips.length > 0}
              onLimpar={() => setChips([])}
            />
          </div>
          <div className="ds-fila">
            <span className="badge ok">Em dia</span>
            <span className="badge warn">Atrasado</span>
            <span className="badge err">Falhou</span>
            <span className="status on">ativo</span>
            <span className="status off">inativo</span>
            <span className="qual">QUALIF.</span>
            <span className="seg NM">Novo Mercado</span>
            <span className="seg N2">Nível 2</span>
            <span className="seg N1">Nível 1</span>
            <span className="seg">Tradicional</span>
            <span className="tag">Etiqueta</span>
          </div>
        </Secao>

        <Secao id="ds-dados" titulo="KPI, gráfico e tabela">
          <KpiGrid
            kpis={[
              {
                rotulo: "Empresas no filtro",
                valor: formatInt(344),
                sub: "de 568 emissoras",
                cor: "var(--accent)",
                p: 0.6,
              },
              {
                rotulo: "Trocaram de escriturador",
                valor: formatPct(146, 334),
                sub: "146 empresas",
                cor: "var(--accent)",
              },
            ]}
          />
          <div className="ds-fila">
            <Donut
              itens={TIPOS.map((k, i) => ({
                k,
                label: TIPO_GRUPO_NOME[k],
                n: [841, 295, 16][i],
                color: TIPO_GRUPO_COR[k],
              }))}
              selecionado={fatia}
              onSelecionar={(k) => setFatia((a) => (a === k ? null : k))}
              centro="BDRs"
              rotuloValor="BDRs"
              rotuloAria="Exemplo: BDRs por tipo de programa"
            />
            <Sparkline
              valores={[3, 5, 4, 8, 7, 9, 12, 10]}
              cor={CAT_COR[0]}
              rotulo="Exemplo de série de 8 meses"
            />
            <Marcas itens={[...CAT_COR, ...CAT_ALT_COR].map((c) => [c, c])} />
          </div>
          <div className="tbl-wrap">
            <table className="dtable">
              <thead>
                <tr>
                  <th scope="col">Empresa</th>
                  <th scope="col">Escriturador</th>
                  <th scope="col" style={{ textAlign: "right" }}>
                    Volume 24m
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <span className="tk">PETR4</span> Petrobras
                  </td>
                  <td>
                    <span className="dot" style={{ background: COR_ESCRITURADOR["Banco Bradesco"] }} /> Banco
                    Bradesco
                  </td>
                  <td style={{ textAlign: "right" }}>R$ 1,2 bi</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Secao>

        <Secao id="ds-estados" titulo="Estados">
          <div className="skeleton" role="status" aria-label="Carregando (exemplo)" />
          <ErroDados mensagem="Exemplo de erro de carregamento." />
          <p className="empty">Nenhum resultado para os filtros atuais.</p>
          <Notas>
            Exemplo de nota de rodapé com fonte e data: <strong>Fonte:</strong> B3, atualizado em 29/10/2026.
          </Notas>
        </Secao>
      </div>
    </div>
  );
}
