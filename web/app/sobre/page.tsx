import type { Metadata } from "next";
import { Migalhas } from "@/components/paineis/Detalhe";

export const metadata: Metadata = {
  title: "Sobre",
  description: "Fontes dos dados, metodologia, regras de normalização, limitações e downloads.",
};

const FONTES: [string, string, string][] = [
  [
    "B3 · Empresas Listadas",
    "https://sistemaswebb3-listados.b3.com.br/listedCompaniesPage",
    "empresas listadas, segmento, setor, escriturador (ON/PN) e tickers; BDRs patrocinados e de ETF, com depositária e categoria.",
  ],
  [
    "B3 · Séries Históricas (COTAHIST)",
    "https://www.b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/market-data/historico/mercado-a-vista/series-historicas/",
    "preço, negócios e volume dos BDRs, em arquivos diários e mensais.",
  ],
  [
    "Banco B3 · BDR",
    "https://finservices.b3.com.br/sobre-o-bdr",
    "listas de programas de BDR não patrocinado e de ETF (depositária Banco B3).",
  ],
  [
    "Bradesco Custódia · BDR",
    "https://custodia.bradesco/",
    "lista de programas não patrocinados do Bradesco (usada para detectar mudanças).",
  ],
  [
    "CVM · Formulário Cadastral (FCA)",
    "https://dados.cvm.gov.br/dataset/cia_aberta-doc-fca",
    "histórico de escrituradores de cada companhia, de 2010 em diante.",
  ],
  [
    "CVM · Cadastro de companhias abertas",
    "https://dados.cvm.gov.br/dataset/cia_aberta-cad",
    "situação do registro na CVM.",
  ],
];

export default function Page() {
  return (
    <div className="dash">
      <div className="wrap">
        <Migalhas itens={[{ href: "/", texto: "Início" }, { texto: "Sobre" }]} />
        <h1 className="page-title">Sobre o linkinstonks</h1>
        <div className="prose card" style={{ maxWidth: 900 }}>
          <p>
            O linkinstonks mostra, a partir de dados públicos da B3 e da CVM,{" "}
            <strong>quem escritura cada ação listada na B3</strong> (com data de início, escriturador anterior
            e histórico de trocas) e <strong>qual banco é depositário de cada BDR</strong>, com o volume
            financeiro mensal. Os dados se atualizam sozinhos: diariamente o que a fonte permite, semanalmente
            o restante.
          </p>

          <h2>Fontes</h2>
          <ul>
            {FONTES.map(([nome, url, o]) => (
              <li key={nome}>
                <a href={url} rel="noopener noreferrer">
                  {nome}
                </a>
                : {o}
              </li>
            ))}
            <li>
              Itaú Investment Services: a página bloqueia coleta automática; os programas conhecidos são
              mantidos à mão, com fonte e data, em <code>config/overrides/depositarias.csv</code>.
            </li>
          </ul>

          <h2>Metodologia</h2>
          <ul>
            <li>
              <strong>Escriturador atual (B3):</strong> campos <code>institutionCommon</code> (ações ON) e{" "}
              <code>institutionPreferred</code> (PN) da API de empresas listadas, normalizados para uma
              instituição canônica.
            </li>
            <li>
              <strong>Escriturador atual, início e anterior (CVM):</strong> a maior versão de cada Formulário
              Cadastral por ano. O atual é a linha sem data de fim do documento mais recente; quando o FCA não
              informa a data de início, mostramos o primeiro ano em que a instituição aparece (marcado com
              “~”).
            </li>
            <li>
              <strong>Selo “CVM indica…”:</strong> aparece quando o escriturador do FCA difere do informado
              pela B3.
            </li>
            <li>
              <strong>Volume dos BDRs:</strong> soma dos mercados à vista e fracionário por ticker e mês, de
              arquivos oficiais da B3, sem opções, termo e units. Os 24 meses são sempre meses fechados; o mês
              corrente aparece à parte, como parcial.
            </li>
            <li>
              <strong>Depositária:</strong> API da B3 (patrocinados e ETFs) &gt; listas do Banco B3 &gt;
              correções manuais com fonte e data &gt; “Não identificado”.
            </li>
          </ul>

          <h2>Regras de normalização</h2>
          <p>
            Nomes de escrituradores variam muito entre fontes (só o Itaú Corretora aparece com mais de dez
            grafias). Cada nome é resolvido para uma instituição por padrões de nome; o CNPJ entra como
            reforço (pela raiz de 8 dígitos). Quando nome e CNPJ divergem, vale o nome, porque o FCA traz
            CNPJs trocados entre empresas do mesmo grupo. Nomes que não casam com nada aparecem com o texto
            original e são revisados. As cores seguem a identidade visual de cada instituição.
          </p>

          <h2>Limitações</h2>
          <ul>
            <li>
              As datas de início e fim são as declaradas pelas companhias no FCA e não foram verificadas em
              outras fontes.
            </li>
            <li>
              O FCA é anual: uma troca recente pode demorar a aparecer na CVM, enquanto a B3 já informa o novo
              escriturador (selo de divergência).
            </li>
            <li>141 empresas, em geral de balcão não organizado, não têm FCA com escriturador.</li>
            <li>
              Alguns BDRs não têm depositária identificada nas fontes públicas (veja{" "}
              <a href="/status/">Status dos dados</a>).
            </li>
            <li>
              Os endpoints da B3 e dos bancos não são documentados e podem mudar sem aviso. Se uma fonte
              falhar, o site mantém o último dado bom e a página de status mostra o atraso.
            </li>
          </ul>

          <h2>Aviso legal</h2>
          <p>
            Este site é informativo, <strong>não é recomendação de investimento</strong> e não é afiliado à
            B3, à CVM nem a qualquer instituição citada. Uso não comercial. Não há dados pessoais: apenas
            companhias e instituições.
          </p>

          <h2>Downloads e feed</h2>
          <ul>
            <li>
              <a href="/data/downloads/acoes.csv" download>
                acoes.csv
              </a>
              : empresas, escriturador B3 e CVM, início e anterior (separador “;”, UTF-8).
            </li>
            <li>
              <a href="/data/downloads/bdrs.csv" download>
                bdrs.csv
              </a>
              : BDRs, depositária, fonte e volume mensal em R$ mil.
            </li>
            <li>
              <a href="/data/downloads/acoes_volume.csv" download>
                acoes_volume.csv
              </a>
              : volume mensal das ações por companhia, em R$ mil.
            </li>
            <li>
              <a href="/data/acoes.json" download>
                acoes.json
              </a>
              ,{" "}
              <a href="/data/bdrs.json" download>
                bdrs.json
              </a>
              ,{" "}
              <a href="/data/acoes_historico_escrituradores.json" download>
                histórico de escrituradores
              </a>
              ,{" "}
              <a href="/data/instituicoes.json" download>
                instituições
              </a>
              : os mesmos dados que alimentam o site, em JSON.
            </li>
            <li>
              <a href="/feed.xml">feed.xml</a>: feed Atom com as últimas mudanças (500 eventos).
            </li>
          </ul>
        </div>
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
