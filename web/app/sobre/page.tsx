import type { Metadata } from "next";
import { Migalhas } from "@/components/paineis/Detalhe";
import { todasAcoes } from "@/lib/servidor";

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
  const semFca = todasAcoes().filter((c) => !c.escriturador_cvm).length;
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
              <strong>Volume das ações:</strong> mesma regra, somada por companhia (todos os tickers de ações
              da empresa, ON, PN, units e demais classes). Tickers antigos entram na companhia pelo Formulário
              Cadastral da CVM; os que não se resolvem ficam fora das somas por companhia e aparecem à parte.
            </li>
            <li>
              <strong>Depositária:</strong> API da B3 (patrocinados e ETFs) &gt; listas do Banco B3 &gt;
              correções manuais com fonte e data &gt; “Não identificado”.
            </li>
          </ul>

          <h2 id="metodologia">Metodologia dos indicadores</h2>
          <p>
            O texto descreve o dado e não julga a ação nem o BDR. Os limiares ficam em{" "}
            <code>config/indicadores.yaml</code>, no repositório público do projeto.
          </p>

          <h3 id="metodologia-liquidez">Liquidez das ações</h3>
          <p>
            Entram os mercados à vista (<code>TPMERC</code> 010) e fracionário (020) de ações e units, pela
            espécie do papel. Ficam de fora opções, termo, FIIs, ETFs, BDRs, bônus de subscrição, direitos e
            recibos.
          </p>
          <ul>
            <li>
              <strong>Volume:</strong> soma de <code>VOLTOT</code>, em R$. <strong>Negócios:</strong> soma de{" "}
              <code>TOTNEG</code>. <strong>Ticket médio:</strong> volume ÷ negócios, vazio em mês sem
              negócios.
            </li>
            <li>
              <strong>Pregões do mês:</strong> datas distintas do arquivo do mês, considerando todo o mercado.{" "}
              <strong>Presença:</strong> dias com negócio ÷ pregões do mês. Dia só com negócio no fracionário
              conta.
            </li>
            <li>
              <strong>Companhia:</strong> soma os tickers; dias e presença são os do ticker mais negociado no
              mês. Nas janelas de 3, 6 e 12 meses, a presença é o total de dias ÷ o total de pregões.
            </li>
            <li>
              <strong>Tickers antigos:</strong> quando a companhia troca de código, o Formulário Cadastral da
              CVM liga o código antigo ao CNPJ, e a série continua.
            </li>
          </ul>

          <h3 id="metodologia-categorias">Categorias de negociação</h3>
          <p>Aplicadas à companhia, nesta ordem de precedência:</p>
          <ul>
            <li>
              <strong>Sem código de negociação:</strong> a B3 não informa ticker.
            </li>
            <li>
              <strong>Listagem recente:</strong> listada há menos de 3 meses.
            </li>
            <li>
              <strong>Sem cotação no período:</strong> nenhum registro nos últimos 24 meses.
            </li>
            <li>
              <strong>Sem negócios:</strong> tem registro em 24 meses e nenhum nos 3 últimos meses fechados.
            </li>
            <li>
              <strong>Presença baixa, média ou alta:</strong> presença em 6 meses abaixo de 25%, de 25% a 75%,
              ou acima de 75%.
            </li>
          </ul>
          <p>
            O COTAHIST não traz linha para o papel que não negociou: sem registro significa sem negócio. Uma
            companhia listada há 4 meses é medida contra os 6 meses inteiros.
          </p>

          <h3 id="metodologia-negocios">Número de negócios: limite da fonte</h3>
          <p>
            <code>TOTNEG</code> tem 5 dígitos no layout da B3 e parece perder o que passa de 99.999. Em
            11/02/2026 a PETR4 aparece com 39 negócios e R$ 2,13 bi. Isso é uma inferência a partir dos dados,
            sem confirmação da B3. Os números ficam como vieram; o mês com pregão suspeito leva a marca “≈”,
            porque os negócios podem estar subestimados e o ticket médio, superestimado. Volume, quantidade e
            presença não são afetados.
          </p>
          <p>
            Um pregão é suspeito quando quantidade ÷ tamanho típico do negócio (mediana dos demais pregões do
            mês) fica mais perto de <code>TOTNEG</code> + 100.000 do que de <code>TOTNEG</code>, desde que
            chegue a 60.000 e o papel tenha mediana de ao menos 10.000 negócios por pregão. Negócios em bloco
            também podem acionar a marca.
          </p>

          <h3 id="metodologia-ticket">Faixas de ticket médio dos BDRs (estimativa)</h3>
          <p>
            <strong>Estimativa baseada no tamanho médio dos negócios; não identifica investidores.</strong>{" "}
            BDRs não têm mercado fracionário: não há nenhum registro em 25 meses. A cada mês, entre os BDRs
            com ao menos 30 negócios, calculam-se o 1º e o 3º quartis do ticket médio: até o 1º quartil,
            ticket baixo; acima do 3º, ticket alto; entre os dois, intermediário. Com menos de 30 negócios,
            dados insuficientes. A faixa descreve a posição do BDR em relação aos demais naquele mês, e o
            ticket depende do preço do BDR.
          </p>

          <h3 id="metodologia-mapa">Mapa de calor</h3>
          <p>
            Em <strong>intensidade relativa</strong>, o tom compara o volume do mês com o maior volume mensal
            do próprio BDR em 24 meses. Em <strong>variação contra a média</strong>, compara com a média dos
            12 meses anteriores, em escala logarítmica de ×0,25 a ×4, com ×1 no centro. A variação só existe
            nos 12 meses mais recentes. Tendência é a média dos últimos 6 meses ÷ a média dos 6 anteriores.
          </p>

          <h3 id="metodologia-listagem">Listagem e segmento segundo a CVM</h3>
          <p>
            Vale a maior versão de cada documento do Formulário Cadastral. A linha do tempo de segmento começa
            na referência de 2018, porque antes não há ticker e o segmento não concorda com a B3 em mais de
            2,6% dos casos. A data é a da primeira referência anual em que o segmento aparece, por isso é
            aproximada, e o primeiro trecho marca o início da série, não a entrada no segmento. Divergência
            entre B3 e CVM vira só um selo informativo: nenhuma fonte corrige a outra. Na falta da data no
            FCA, usa-se a data da lista da B3, marcada como incerta; a data 20/07/1977, repetida em 27
            tickers, também é marcada como incerta.
          </p>

          <h3 id="metodologia-busca">Busca global</h3>
          <p>
            Código exato (ticker, emissor, CNPJ, código CVM ou ISIN) vem primeiro, depois prefixo de código,
            início de palavra do nome, trecho do nome e, por último, correspondência aproximada, para erros de
            digitação. A busca ignora acentos e maiúsculas e mostra até 8 resultados por grupo.
          </p>

          <h3 id="metodologia-relatorio">Relatório mensal</h3>
          <p>
            O texto usa frases fixas, sem modelo de linguagem. Os eventos são os detectados no mês, com a data
            da detecção. As altas e quedas de BDRs só consideram R$ 10 mi ou mais nos dois meses, para evitar
            ruído percentual. O registro de falhas de coleta começa em novembro de 2026.
          </p>

          <h3 id="metodologia-passado">Ver um mês passado</h3>
          <p>
            A posição real é a guardada pela rotina mensal, e a tela mostra a data da coleta. A reconstituída
            é montada depois e sempre marcada como tal. Nas ações, usa o escriturador vigente no último dia do
            mês segundo o histórico da CVM, só para companhias do cadastro atual: quem saiu da bolsa não
            aparece, e setor, segmento e tickers são os de hoje. Nos BDRs, o volume vem do COTAHIST, e a
            depositária e o tipo vêm do primeiro snapshot guardado. Por isso, em mês reconstituído, a
            diferença contra hoje não equivale ao número de novas listagens.
          </p>

          <h3 id="metodologia-lista">Sua lista de acompanhamento</h3>
          <p>
            Fica só neste navegador, no armazenamento local, e não é enviada a lugar nenhum. As novidades
            contam os eventos dos itens da lista desde a última visita a Novidades ou a Minha lista.
          </p>

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
            <li>{semFca} empresas, em geral de balcão não organizado, não têm FCA com escriturador.</li>
            <li>
              Alguns BDRs não têm depositária identificada nas fontes públicas (veja{" "}
              <a href="/status/">Status dos dados</a>).
            </li>
            <li>
              Os endpoints da B3 e dos bancos não são documentados e podem mudar sem aviso. Se uma fonte
              falhar, o site mantém o último dado bom e a página de status mostra o atraso.
            </li>
          </ul>

          <h2 id="aviso-legal">Aviso legal</h2>
          <p>
            Este site é informativo, <strong>não é recomendação de investimento</strong> e não é afiliado à
            B3, à CVM nem a qualquer instituição citada, nem foi autorizado ou revisado por elas. Projeto
            pessoal, sem fins comerciais. Não há dados pessoais: apenas companhias e instituições.
          </p>
          <p>
            Os dados de negociação e os cadastros da B3 pertencem à B3 e seguem os{" "}
            <a href="https://www.b3.com.br/pt_br/termos-de-uso-e-protecao-de-dados/termos-de-uso/">
              Termos de Uso da B3
            </a>
            , que limitam o uso a fins pessoais e exigem autorização dela para redistribuir ou usar para fins
            comerciais. O que está aqui serve para consulta e não concede nenhuma licença sobre esses dados.
            Quem representa uma das fontes e quer corrigir ou retirar algum dado pode{" "}
            <a href="https://github.com/LKNAI/linkinstonks/issues">
              abrir um pedido no repositório do projeto
            </a>
            .
          </p>

          <h2>Downloads e feed</h2>
          <p>
            Os arquivos para baixar trazem só dados cadastrais. Volume, preço e negócios ficam nas telas e na
            exportação de cada tabela, para consulta pessoal.
          </p>
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
              : BDRs, tipo, depositária, fonte da depositária e ISIN.
            </li>
            <li>
              <a href="/data/acoes_historico_escrituradores.json" download>
                histórico de escrituradores
              </a>{" "}
              e{" "}
              <a href="/data/instituicoes.json" download>
                instituições
              </a>
              , em JSON.
            </li>
            <li>
              <a href="/feed.xml">feed.xml</a>: feed Atom com as últimas mudanças (até 500 eventos).
            </li>
          </ul>
        </div>
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
