# Paridade funcional com os HTMLs do seed

Checklist obrigatório da seção 11.2 do prompt. Origem: leitura integral dos três templates em `seed/etl/**/*.html`. Os HTMLs finais em `seed/html/` são idênticos aos templates, linha a linha, exceto pelos dados embutidos (verificado na Fase 0).

Legenda: `[ ]` a portar · `[x]` portado e testado · **Δ** = comportamento do seed que precisa mudar na versão nova (ver seção 4).

Referências: **A** = `dashboard_acoes_b3.html` → rota `/acoes` · **T** = `empresas_acoes_b3.html` → rota `/acoes/tabela` · **B** = `dashboard_bdrs_b3.html` → rota `/bdrs`.

## 1. Dashboard de ações (A) — `/acoes`

### 1.1 Estrutura e estado
- [ ] Hero com selo ("B3 + CVM · dados abertos · data"), título e texto de apoio. **Δ** data fixa `23/10/2026`
- [ ] Estado global de filtros `S`: busca `q`, `onlyT`, e oito dimensões cruzadas (`bank`, `mkt`, `cls`, `sec`, `hist`, `yr`, `inE`, `outE`) + ordenação
- [ ] Filtro cruzado: cada gráfico recalcula com todos os filtros **exceto o seu próprio** (`rows(except)`); clicar de novo no mesmo item limpa
- [ ] Busca textual sem acento/caixa (NFD), debounce de 120 ms, sobre pregão, razão social, emissor, tickers, CNPJ (com e sem máscara), setor, escriturador B3 ON/PN (normalizado e bruto), segmento, escriturador CVM atual e anterior
- [ ] Botão "Somente negociadas (com ticker)" (`aria-pressed`, ligado por padrão)
- [ ] Chips de filtros ativos com rótulo + valor + ✕ (remove um); botão "Limpar filtros" (limpa tudo, inclusive a busca) visível só quando há filtro
- [ ] Tooltip flutuante seguindo o mouse, com reposicionamento nas bordas da janela
- [ ] Estados de seleção: `has-sel` esmaece os não selecionados; item selecionado destacado
- [ ] Ordem fixa de instituições (`ENT_ORDER`: marcas conhecidas primeiro, ordenadas por nº de empresas)

### 1.2 KPIs (6 cartões, reagem aos filtros)
- [ ] Empresas no filtro (de N emissoras) + barra de proporção
- [ ] Negociadas (com ticker) + nº de tickers
- [ ] Com histórico na CVM (% das filtradas)
- [ ] Trocaram de escriturador (% e nº "desde 2010")
- [ ] Trocas desde 2023 (**Δ** limiar 2023 fixo no código)
- [ ] Maior escriturador (% + nome + nº), cor da marca

### 1.3 Gráficos
- [ ] Donut "Participação por escriturador" (escriturador B3 ON; legenda com nº, %, tickers no tooltip; cores de marca)
- [ ] Donut "Segmento de listagem" (NM, N2, N1, MP, B, SO, BN, "?"; cores fixas de segmento)
- [ ] Donut "Histórico na CVM" (Trocou / Sem troca / Sem dados)
- [ ] Centro do donut: total, ou % do item selecionado
- [ ] Colunas empilhadas "Trocas de escriturador por ano": 2010–2026, empilhado por **novo** escriturador, total no topo, "≤10" para início anterior a 2010, legenda de instituições, tag "N trocas", clique filtra por ano. **Δ** faixa de anos fixa 2010–2026
- [ ] Barras divergentes "Saldo de trocas": perdeu (esquerda) × conquistou (direita) por instituição, ordenado por saldo, clique em cada lado filtra `outE`/`inE` (um limpa o outro), tooltip com saldo, mensagem "Nenhuma troca no filtro atual"
- [ ] Barras horizontais "Setores com mais empresas": 10 maiores no filtro, mantém o setor selecionado mesmo se fora do top 10, "Não classificado" unificado
- [ ] Colunas "Tickers por classe": ON, PN, PNA, PNB, PNC, PND, Units, Outros; nota explicando "Outros"

### 1.4 Tabela
- [ ] Colunas: Empresa (pregão, razão social, código emissor), Tickers (com classe), Escriturador atual, **Escriturador desde**, **Escriturador anterior**, Segmento, Setor, CNPJ
- [ ] Escriturador atual: ponto colorido + nome; `title` com o valor bruto da B3; linha "PN: …" quando difere da ON
- [ ] Selo "⚠ CVM indica …" quando o escriturador do FCA difere do da B3
- [ ] "Desde": data, "~mm/aaaa" com tooltip quando aproximada, "Não informada", "Sem dados na CVM"
- [ ] "Anterior": nome, "desde … · até …" ou "consta até o FCA de AAAA", "N escrituradores desde 2010" quando N > 2
- [ ] Ordenação por clique no cabeçalho (`aria-sort`); regras: tickers pelo 1º ticker, segmento pela ordem de `MKT`, "desde" nulo por último, texto com `localeCompare('pt', numeric)`
- [ ] Contador "N de M empresas" e linha de vazio
- [ ] Exportar CSV da visão filtrada **e ordenada** (`;`, BOM UTF-8, 18 colunas, nome `escrituradores_b3_cvm.csv`)
- [ ] Rodapé com fontes e notas metodológicas. **Δ** contém números fixos ("141 empresas")

## 2. Tabela de ações (T) — `/acoes/tabela`
- [ ] Cabeçalho com 5 estatísticas (emissoras, com ticker, tickers, com histórico CVM, trocaram desde 2010)
- [ ] Barra fixa (sticky) de filtros: busca; select de escriturador atual **com contagem**; select de escriturador anterior **com contagem**; select de histórico; select de segmento **com contagem**; "Somente com ticker"
- [ ] Mesmas colunas de A **mais Cód. CVM** (9 colunas)
- [ ] Mesmas regras de célula, ordenação e selo "CVM indica"
- [ ] CSV com 19 colunas (inclui Código CVM)
- [ ] Os filtros **não** são cruzados com gráficos (não há gráficos); são independentes e combinados com AND

## 3. Dashboard de BDRs (B) — `/bdrs`

### 3.1 Estrutura e estado
- [ ] Hero com selo de período. **Δ** "out/2024 – set/2026" fixo
- [ ] Estado `S`: busca, situação (`all|on|off`), `dep`, `type`, `cat`, `month`, ordenação, `showM`
- [ ] Controle segmentado "Todas / Negociadas em set/26 / Sem negócios em set/26". **Δ** rótulo e corte `l >= 2026-09-01` fixos → derivar do último mês de `meta.meses`
- [ ] Filtros cruzados em `dep`, `type`, `cat`; clique repetido limpa
- [ ] Mês de referência (`month`) escolhido no gráfico mensal altera o **ranking e a concentração**, não os KPIs
- [ ] Chips (inclui chip "Mês do ranking") e "Limpar filtros" (restaura situação e mês)
- [ ] Busca sem acento por ticker, nome, ISIN, depositária, rótulo do tipo e sigla (DRN, DR1…)
- [ ] Agrupamento de tipos: DRN, DRE, e **SPO** = DR1+DR2+DR3 ("Patrocinado")

### 3.2 KPIs (6 cartões)
- [ ] BDRs no filtro (+ nº negociados no último mês)
- [ ] Volume em 24 meses (+ média mensal)
- [ ] Volume no último mês (+ variação vs mesmo mês do ano anterior, ▲/▼, "novo")
- [ ] Últimos 12 × 12 anteriores (variação + valores)
- [ ] Maior depositária (% do volume + nome + valor)
- [ ] BDR mais negociado (ticker + nome + valor)

### 3.3 Gráficos
- [ ] Colunas empilhadas mensais por tipo (DRN/DRE/SPO), eixo Y "bonito" (degraus 1 mil … 50 mi), rótulo de janeiro com ano, tooltip com total, por tipo e variação vs ano anterior, clique define o mês, tag "R$ X em 24 meses"
- [ ] Donut "Volume por depositária" (Banco B3, Bradesco, Itaú, Não identificado); tooltip com nº de BDRs
- [ ] Donut "BDRs por tipo de programa" (contagem; tooltip com volume)
- [ ] Donut "BDRs de ETF por classe" (volume; mensagem quando não há ETF no filtro). **Δ** categorias fixas no código
- [ ] Ranking top 15 por volume (24m ou mês escolhido), barra colorida pela depositária, % do total filtrado, clique filtra a tabela por aquele ticker e rola até ela
- [ ] Curva de concentração: barra empilhada (maior, top 5, top 10, top 50), 4 estatísticas e "N de M BDRs respondem por 80%"

### 3.4 Tabela
- [ ] Colunas: BDR (sticky à esquerda; ticker, selo QUALIF., nome), Tipo (+ classe do ETF), Depositária (tooltip com **fonte**), **sparkline 24 meses** (SVG, cor da depositária), Volume 24m, Volume do último mês, 12m × 12m ant., Negócios 24m, Último preço (BRL), 1º pregão ("antes de out/24" quando na borda), Último pregão, Situação, ISIN
- [ ] Alternância **"Mostrar os 24 meses"** (acrescenta uma coluna por mês, `·` para zero)
- [ ] Ordenação por qualquer coluna (inclui `last`, `var`, meses); padrão desc para números, asc para textos; sparkline não ordena
- [ ] **Δ** a tabela corta em 1.200 linhas (`slice(0,1200)`); na versão nova usar virtualização (`@tanstack/react-virtual`)
- [ ] Moeda compacta (`R$ 1,2 bi / mi / mil`, "< R$ 1 mil", "—")
- [ ] CSV (`bdrs_b3_volume_mensal.csv`; 14 colunas fixas + 24 de meses, volumes em **R$ inteiros** = R$ mil × 1000, preço com vírgula)

## 4. Valores fixos no seed que precisam virar dinâmicos
| onde | valor fixo | como tratar |
|---|---|---|
| A, T (hero/rodapé) | `23/10/2026` | `meta.json` (data por fonte) |
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

## 5. Divergências de dados (golden) — preencher na Fase 2/3
| item | seed | pipeline novo | justificativa |
|---|---|---|---|
| _(vazio na Fase 0)_ | | | |

Achados da Fase 0 que já devem aparecer aqui (ver relatório): HELBOR (`NM` no seed × `marketIndicator=1` na API de 29/10; decidido: mudança real, ver `docs/decisoes/0000-decisoes-fase-0.md`); regra do escriturador atual com documentos de múltiplas linhas; conflito nome × CNPJ em linhas do FCA.
