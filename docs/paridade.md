# Paridade funcional com os HTMLs do seed

Checklist obrigatório da seção 11.2 do prompt. Origem: leitura integral dos três templates em `seed/etl/**/*.html`. Os HTMLs finais em `seed/html/` são idênticos aos templates, linha a linha, exceto pelos dados embutidos (verificado na Fase 0).

Legenda: `[ ]` a portar · `[x]` portado (Fase 4) e coberto por teste unitário ou e2e · **Δ** = comportamento do seed que precisa mudar na versão nova (ver seção 4).

Referências: **A** = `dashboard_acoes_b3.html` → rota `/acoes` · **T** = `empresas_acoes_b3.html` → rota `/acoes/tabela` · **B** = `dashboard_bdrs_b3.html` → rota `/bdrs`.

## 1. Dashboard de ações (A) — `/acoes`

### 1.1 Estrutura e estado
- [x] Hero com selo ("B3 + CVM · dados abertos · data"), título e texto de apoio. **Δ** data fixa `23/10/2026`
- [x] Estado global de filtros `S`: busca `q`, `onlyT`, e oito dimensões cruzadas (`bank`, `mkt`, `cls`, `sec`, `hist`, `yr`, `inE`, `outE`) + ordenação
- [x] Filtro cruzado: cada gráfico recalcula com todos os filtros **exceto o seu próprio** (`rows(except)`); clicar de novo no mesmo item limpa
- [x] Busca textual sem acento/caixa (NFD), debounce de 120 ms, sobre pregão, razão social, emissor, tickers, CNPJ (com e sem máscara), setor, escriturador B3 ON/PN (normalizado e bruto), segmento, escriturador CVM atual e anterior
- [x] Botão "Somente negociadas (com ticker)" (`aria-pressed`, ligado por padrão)
- [x] Chips de filtros ativos com rótulo + valor + ✕ (remove um); botão "Limpar filtros" (limpa tudo, inclusive a busca) visível só quando há filtro
- [x] Tooltip flutuante seguindo o mouse, com reposicionamento nas bordas da janela
- [x] Estados de seleção: `has-sel` esmaece os não selecionados; item selecionado destacado
- [x] Ordem fixa de instituições (`ENT_ORDER`: marcas conhecidas primeiro, ordenadas por nº de empresas)

### 1.2 KPIs (6 cartões, reagem aos filtros)
- [x] Empresas no filtro (de N emissoras) + barra de proporção
- [x] Negociadas (com ticker) + nº de tickers
- [x] Com histórico na CVM (% das filtradas)
- [x] Trocaram de escriturador (% e nº "desde 2010")
- [x] Trocas desde 2023 (**Δ** limiar 2023 fixo no código)
- [x] Maior escriturador (% + nome + nº), cor da marca

### 1.3 Gráficos
- [x] Donut "Participação por escriturador" (escriturador B3 ON; legenda com nº, %, tickers no tooltip; cores de marca)
- [x] Donut "Segmento de listagem" (NM, N2, N1, MP, B, SO, BN, "?"; cores fixas de segmento)
- [x] Donut "Histórico na CVM" (Trocou / Sem troca / Sem dados)
- [x] Centro do donut: total, ou % do item selecionado
- [x] Colunas empilhadas "Trocas de escriturador por ano": 2010–2026, empilhado por **novo** escriturador, total no topo, "≤10" para início anterior a 2010, legenda de instituições, tag "N trocas", clique filtra por ano. **Δ** faixa de anos fixa 2010–2026
- [x] Barras divergentes "Saldo de trocas": perdeu (esquerda) × conquistou (direita) por instituição, ordenado por saldo, clique em cada lado filtra `outE`/`inE` (um limpa o outro), tooltip com saldo, mensagem "Nenhuma troca no filtro atual"
- [x] Barras horizontais "Setores com mais empresas": 10 maiores no filtro, mantém o setor selecionado mesmo se fora do top 10, "Não classificado" unificado
- [x] Colunas "Tickers por classe": ON, PN, PNA, PNB, PNC, PND, Units, Outros; nota explicando "Outros"

### 1.4 Tabela
- [x] Colunas: Empresa (pregão, razão social, código emissor), Tickers (com classe), Escriturador atual, **Escriturador desde**, **Escriturador anterior**, Segmento, Setor, CNPJ
- [x] Escriturador atual: ponto colorido + nome; `title` com o valor bruto da B3; linha "PN: …" quando difere da ON
- [x] Selo "⚠ CVM indica …" quando o escriturador do FCA difere do da B3
- [x] "Desde": data, "~mm/aaaa" com tooltip quando aproximada, "Não informada", "Sem dados na CVM"
- [x] "Anterior": nome, "desde … · até …" ou "consta até o FCA de AAAA", "N escrituradores desde 2010" quando N > 2
- [x] Ordenação por clique no cabeçalho (`aria-sort`); regras: tickers pelo 1º ticker, segmento pela ordem de `MKT`, "desde" nulo por último, texto com `localeCompare('pt', numeric)`
- [x] Contador "N de M empresas" e linha de vazio
- [x] Exportar CSV da visão filtrada **e ordenada** (`;`, BOM UTF-8, 18 colunas, nome `escrituradores_b3_cvm.csv`)
- [x] Rodapé com fontes e notas metodológicas. **Δ** contém números fixos ("141 empresas")

## 2. Tabela de ações (T) — `/acoes/tabela`
- [x] Cabeçalho com 5 estatísticas (emissoras, com ticker, tickers, com histórico CVM, trocaram desde 2010)
- [x] Barra fixa (sticky) de filtros: busca; select de escriturador atual **com contagem**; select de escriturador anterior **com contagem**; select de histórico; select de segmento **com contagem**; "Somente com ticker"
- [x] Mesmas colunas de A **mais Cód. CVM** (9 colunas)
- [x] Mesmas regras de célula, ordenação e selo "CVM indica"
- [x] CSV com 19 colunas (inclui Código CVM)
- [x] Os filtros **não** são cruzados com gráficos (não há gráficos); são independentes e combinados com AND

## 3. Dashboard de BDRs (B) — `/bdrs`

### 3.1 Estrutura e estado
- [x] Hero com selo de período. **Δ** "out/2024 – set/2026" fixo
- [x] Estado `S`: busca, situação (`all|on|off`), `dep`, `type`, `cat`, `month`, ordenação, `showM`
- [x] Controle segmentado "Todas / Negociadas em set/26 / Sem negócios em set/26". **Δ** rótulo e corte `l >= 2026-09-01` fixos → derivar do último mês de `meta.meses`
- [x] Filtros cruzados em `dep`, `type`, `cat`; clique repetido limpa
- [x] Mês de referência (`month`) escolhido no gráfico mensal altera o **ranking e a concentração**, não os KPIs
- [x] Chips (inclui chip "Mês do ranking") e "Limpar filtros" (restaura situação e mês)
- [x] Busca sem acento por ticker, nome, ISIN, depositária, rótulo do tipo e sigla (DRN, DR1…)
- [x] Agrupamento de tipos: DRN, DRE, e **SPO** = DR1+DR2+DR3 ("Patrocinado")

### 3.2 KPIs (6 cartões)
- [x] BDRs no filtro (+ nº negociados no último mês)
- [x] Volume em 24 meses (+ média mensal)
- [x] Volume no último mês (+ variação vs mesmo mês do ano anterior, ▲/▼, "novo")
- [x] Últimos 12 × 12 anteriores (variação + valores)
- [x] Maior depositária (% do volume + nome + valor)
- [x] BDR mais negociado (ticker + nome + valor)

### 3.3 Gráficos
- [x] Colunas empilhadas mensais por tipo (DRN/DRE/SPO), eixo Y "bonito" (degraus 1 mil … 50 mi), rótulo de janeiro com ano, tooltip com total, por tipo e variação vs ano anterior, clique define o mês, tag "R$ X em 24 meses"
- [x] Donut "Volume por depositária" (Banco B3, Bradesco, Itaú, Não identificado); tooltip com nº de BDRs
- [x] Donut "BDRs por tipo de programa" (contagem; tooltip com volume)
- [x] Donut "BDRs de ETF por classe" (volume; mensagem quando não há ETF no filtro). **Δ** categorias fixas no código
- [x] Ranking top 15 por volume (24m ou mês escolhido), barra colorida pela depositária, % do total filtrado, clique filtra a tabela por aquele ticker e rola até ela
- [x] Curva de concentração: barra empilhada (maior, top 5, top 10, top 50), 4 estatísticas e "N de M BDRs respondem por 80%"

### 3.4 Tabela
- [x] Colunas: BDR (sticky à esquerda; ticker, selo QUALIF., nome), Tipo (+ classe do ETF), Depositária (tooltip com **fonte**), **sparkline 24 meses** (SVG, cor da depositária), Volume 24m, Volume do último mês, 12m × 12m ant., Negócios 24m, Último preço (BRL), 1º pregão ("antes de out/24" quando na borda), Último pregão, Situação, ISIN
- [x] Alternância **"Mostrar os 24 meses"** (acrescenta uma coluna por mês, `·` para zero)
- [x] Ordenação por qualquer coluna (inclui `last`, `var`, meses); padrão desc para números, asc para textos; sparkline não ordena
- [x] **Δ** a tabela corta em 1.200 linhas (`slice(0,1200)`); na versão nova usar virtualização (`@tanstack/react-virtual`)
- [x] Moeda compacta (`R$ 1,2 bi / mi / mil`, "< R$ 1 mil", "—")
- [x] CSV (`bdrs_b3_volume_mensal.csv`; 14 colunas fixas + 24 de meses, volumes em **R$ inteiros** = R$ mil × 1000, preço com vírgula)

## 4. Valores fixos no seed que precisam virar dinâmicos
| onde | valor fixo | como tratar |
|---|---|---|
| A, T (hero/rodapé) | `23/10/2026` | **feito:** a data vem de `meta.json` no rodapé do site |
| A (rodapé/T) | "141 empresas sem FCA" | calcular da base |
| A (anos) | loop `2010…2026`; `"2010"` como piso | do ano mínimo ao corrente, vindo de `meta` |
| A (KPI) | "Trocas desde 2023" | parametrizar (ex.: últimos 3 anos) |
| B (hero/rodapé) | "out/2024 – set/2026", "set/26", `2026-09-01`, `2024-10-01` | derivar de `meta.meses` |
| B (rodapé) | "0,2% do volume" não identificado, "PPLA11" | calcular / listar das exceções |
| B (ETF) | mapa de categoria por prefixo de ticker (`CAT_LINE`) | usar `describleCategoryBVMF` da API (ver `docs/fontes.md`) |
| B (tabela) | corte de 1.200 linhas | virtualização |
| todos | cores de marca em JS | gerar `colors.ts` de `config/instituicoes.yaml` |
| todos | sem estado na URL | querystring (requisito 11.4) |
| todos | sem "ver como tabela" nem navegação por teclado nos SVGs | requisito 11.4 (acessibilidade) |

## 5. Divergências de dados (golden) — Fases 2 e 3

Entradas congeladas em `etl/tests/golden/` (dados reais de 29/10/2026) contra o seed (23/10 e 28/10). Testes: `etl/tests/golden/test_acoes_golden.py` e `test_bdrs_golden.py`. A mesma comparação foi refeita sobre a publicação real (`data/public/`, pipeline contra as fontes vivas): resultados idênticos.

### Ações (meta do prompt: 568 companhias; atual e anterior iguais em >= 99%)
| métrica | resultado |
|---|---|
| companhias, mesmo conjunto | 568 de 568 |
| escriturador B3 (ON/PN, texto cru) | 568 de 568 (100%) |
| escriturador CVM atual | 427 de 427 (100%) |
| escriturador CVM anterior | 427 de 427 (100%) |
| início do escriturador atual | 99,8% |
| nº de escrituradores no histórico | 99,3% |
| divergências B3 × CVM (selo "CVM indica…") | 59 de 59 |

| item | seed | pipeline novo | justificativa |
|---|---|---|---|
| HELBOR (20877): segmento | `NM` | `B` | A B3 mudou o `marketIndicator` entre 23/10 e 29/10. Decisão da Fase 0: mudança real, vale a API. |
| BIOMM (19305): tickers | inclui `BIOM12` | sem `BIOM12` | Ticker deixou de constar no `GetDetail` desde a coleta do seed. |
| EMAE (16993): tickers | `EMAE3`, `EMAE4` | sem eles | Idem. |
| debêntures em `otherCodes` (`PETR-DEB62`…) | excluídas | excluídas | Mesma regra: código com hífen não é ação. |
| ordem dos tickers | ordem da API | ordenação natural (`SANB3`, `SANB4`, `SANB11`) | Saída determinística. |
| início do atual (1 caso) e nº de escrituradores (3 casos) | | | Casos isolados em que o seed escolhe outra linha do histórico do FCA; a regra exata do seed não é conhecida (ver `docs/decisoes/0003-historico-de-escrituradores.md`). |
| `pn` | igual ao ON quando coincide | `null` quando não há PN distinto | Contrato mais explícito; o front compara com `on`. |

### BDRs (meta: 1.143 BDRs; depositárias ±1%; volume total de 24 meses ≤ 0,1%)
| métrica | resultado |
|---|---|
| BDRs do seed presentes | 1.143 de 1.143 |
| depositária (Banco B3 / não identificado / Bradesco / Itaú) | 1.026 / 56 / 46 / 15, igual ao seed ticker a ticker |
| volume total de 24 meses | diferença de 0,00002% (R$ 538,27 bi) |
| volume mensal por ticker | no máximo R$ 0,5 mil de diferença (arredondamento do seed) |
| negócios, tipo, ISIN, último pregão, categoria do ETF, qualificado | iguais |

| item | seed | pipeline novo | justificativa |
|---|---|---|---|
| universo | 1.143 | 1.152 na publicação real | 9 BDRs sem nenhum volume nos 24 meses fechados e com negócios só em out/2026 (BBCA39, BFTC39, CEGG34, INBR34, JGLO39, JIVE39, L1TM34, S1AK34, SK1D34): têm volume só no mês parcial. |
| categoria do ETF | `Renda variável`, `Renda fixa`, `Commodities / cripto` | `Renda Variável`, `Renda Fixa`, `Commodities` | Decisão da Fase 0: rótulos da API. |
| `fonte_depositaria` dos ETFs | `Banco B3 (finservices)` / `Bradesco Custódia` | `API B3 (GetDetail)` | A API informa a depositária dos ETFs e tem prioridade. A depositária resultante é a mesma. |
| unidade do volume | R$ mil | R$ (inteiro) | `downloads/bdrs.csv` mantém R$ mil e os mesmos cabeçalhos do seed. |
| mês corrente | ausente | `volume_mes_parcial` (COTAHIST diário) | Novo: o site mostra o mês em andamento. |

Pendência observada na publicação real: **INBR34** (Inter&Co, estreou em out/2026 com R$ 937 mi no mês) está sem depositária identificada. O seed só conhece INBR32 (Bradesco). Não será atribuída sem fonte.

## 4b. Estado dos valores fixos após a Fase 4
Todos os valores fixos da tabela acima foram removidos: datas e meses vêm de `meta.json`/`bdrs.json`, a faixa de anos vai de 2010 ao ano corrente, "Trocas desde N" usa o ano de referência menos 3, as categorias de ETF vêm da API, a tabela é virtualizada (sem corte de 1.200 linhas), as cores de instituição são geradas do YAML (`web/lib/colors.ts`), o estado vai para a URL e cada gráfico tem "ver como tabela" e controles acessíveis por teclado.

Diferenças deliberadas em relação ao seed:
- O rodapé mostra só a **data** da última atualização (sem hh:mm): o `meta.json` não guarda horário, para que um dia sem mudança não gere commit.
- "Negociadas em <mês>" usa o volume do último mês fechado (`volume_mensal[23] > 0`), não o último pregão.
- O aviso de dados desatualizados (3 dias úteis para fontes diárias, 10 dias para semanais) é novo.
- As páginas têm um único marco `contentinfo` (o rodapé do site); as notas metodológicas viraram `role="note"`.
- Os links do menu não fazem pré-busca (`prefetch={false}`): o Next 16 gera os arquivos de pré-busca do export estático em pastas, mas o cliente os pede com pontos, o que dá 404. A navegação por clique foi testada e funciona.

## 6. Como foi verificado
- `web/tests/unit`: 56 testes, a maioria sobre os **dados reais** de `data/public/` (filtro cruzado, KPIs, saldo de trocas, ranking, concentração, CSV, URL, aviso de dados desatualizados) e a equivalência entre o zod e os JSON Schemas.
- `web/tests/e2e` (Playwright, sobre o build estático): 23 testes. Cada rota sem erro de console e sem resposta HTTP de erro; 360 px sem rolagem horizontal (inclusive no `body`); filtro cruzado alterando KPIs, gráficos e tabela; estado na URL sobrevivendo a recarregar; CSV baixado com as linhas da visão filtrada; mês do ranking; 24 meses na tabela; virtualização; teclado.
- Capturas de tela em 1440 px e 390 px: `docs/capturas/` (geradas por `web/scripts/capturas.mjs`).
- **Não verificado ainda** (Fase 7): Lighthouse, contraste de cor WCAG e tamanho do JS por rota.
