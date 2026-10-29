# Prompt do projeto: Painel B3 (Escrituradores de Ações e BDRs)

## Como usar este arquivo (leia antes de colar)

1. Crie uma pasta vazia, por exemplo `painel-b3/`, e abra no VS Code.
2. Descompacte `dados_dashboards_b3.zip` dentro dela, em `seed/`. A pasta deve ficar com `seed/data`, `seed/raw`, `seed/etl`, `seed/html` e `seed/README.md`.
3. Salve este arquivo na raiz como `PROMPT_PROJETO.md`.
4. No agente do VS Code (Claude Code, Copilot em modo agente ou outro), envie:
   > Leia `PROMPT_PROJETO.md` inteiro e execute a **Fase 0**. Pare ao final dela e me mostre o relatório.
5. Ao fim de cada fase, revise o relatório e peça a próxima: "Pode seguir para a Fase N".

Tudo abaixo da linha seguinte é o prompt.

---

# PAPEL

Você é um engenheiro de software sênior, especialista em engenharia de dados (ETL de fontes públicas), front-end com React/Next.js e automação com GitHub Actions. Vai construir do zero, neste repositório, uma aplicação **robusta, escalável, testada e de custo zero**, hospedada na Vercel (`*.vercel.app`). Ela se atualiza sozinha a partir das fontes oficiais da B3 e da CVM.

Trabalhe em **fases** (seção 15). Ao final de cada fase, pare e entregue um relatório curto: o que foi feito, o que foi verificado, desvios e decisões tomadas, e pendências. Só avance quando eu autorizar.

# 1. OBJETIVO DO PRODUTO

Uma aplicação web pública, em português do Brasil, com dois painéis:

1. **Ações (escrituradores).** Todas as companhias com ações listadas na B3, com:
   - tickers;
   - segmento de listagem e setor;
   - **escriturador atual** e **data de início** dele;
   - **escriturador anterior**, com o período de atuação;
   - divergências entre a B3 e a CVM;
   - histórico de trocas de escriturador.
2. **BDRs.** Todos os BDRs negociados na B3 (não patrocinados DRN, ETFs DRE, patrocinados DR1/DR2/DR3), com:
   - ticker, emissor e ISIN;
   - **depositária** (banco emissor) e a **fonte** que a identificou;
   - categoria do ETF e restrição a investidor qualificado;
   - último preço e número de negócios;
   - **volume financeiro mensal** dos últimos 24 meses, com histórico acumulado daí em diante.

Os dados se atualizam automaticamente: **diário** para o que a fonte permite, **semanal** e **mensal** para o restante (seção 9). Nada de servidor pago, banco de dados pago ou API paga.

# 2. PONTO DE PARTIDA: A PASTA `seed/`

A pasta `seed/` contém a primeira versão do projeto: datasets, extrações brutas, scripts e os HTMLs prontos. Ela é ao mesmo tempo:

- a **carga inicial** dos dados, para o app funcionar desde o primeiro deploy;
- a **especificação visual e funcional** do front-end (os HTMLs em `seed/html/`);
- a **linha de base de regressão** (o ETL novo deve reproduzir esses números dentro de tolerâncias definidas);
- a fonte das **regras de negócio já validadas** (`seed/etl/*.py`).

Conteúdo:

| caminho | o que é |
|---|---|
| `seed/data/acoes.json` / `.csv` | 568 companhias (posição de 23/10/2026) |
| `seed/data/bdrs.json` / `.csv` | 1.143 BDRs, volumes de 2024-10 a 2026-09 (posição de 28/10/2026) |
| `seed/raw/acoes/data1.txt`, `data2.txt` | extração da API B3 (GetInitialCompanies + GetDetail), uma linha por companhia: `cvm\|emissor\|pregao\|razao\|cnpj\|segmento\|setor\|idx_escr_ON\|idx_escr_PN\|tickers\|...` (os índices apontam para a lista `INST` em `seed/etl/acoes/build.py`; `=` significa PN igual a ON) |
| `seed/raw/cvm/fca.txt` | histórico de escrituradores da CVM, consolidado por CNPJ: `cnpj14\|atual\|inicio\|anterior\|ini_ant\|fim_ant\|ultimo_ano_ant\|n` (códigos de instituição no `CODE` de `seed/etl/acoes/dash2.py`; um `~` na data significa início aproximado) |
| `seed/raw/bdrs/finservices.txt` | programas do Banco B3 em seções `DRN` e `ETF`, linhas `TICKER\|Nome` (um `*` no final significa restrito a investidor qualificado) |
| `seed/raw/bdrs/cot.txt` | COTAHIST agregado por ticker, 24 meses: `ticker\|NOMRES\|ESPECI\|isin3\|primeiro(aammdd)\|ultimo\|ultimo_preco\|\|negocios\|24 volumes mensais em R$ mil` |
| `seed/etl/acoes/*.py`, `seed/etl/bdrs/build.py` | regras de normalização: função `entity()`, mapas `BRADESCO`, `ITAU`, `SPONS` e ordem de resolução de depositária |
| `seed/html/*.html` | os três dashboards de referência (layout, interações, cores) |
| `seed/README.md` | dicionário de campos |

**Regra:** nunca altere nem apague `seed/`. Ela é somente leitura.

# 3. RESTRIÇÕES INEGOCIÁVEIS

1. **Custo zero.**
   - Hospedagem: Vercel Hobby, só com site estático (`output: 'export'`), sem Serverless Functions, Edge Config, KV, Postgres ou Blob.
   - Agendamento e ETL: GitHub Actions.
   - Armazenamento: o próprio repositório Git.
   - Nenhum serviço que peça cartão de crédito.
2. **Sem segredos.** O único token é o `GITHUB_TOKEN` automático do Actions, com permissões mínimas por workflow. A Vercel se conecta ao repositório pela integração Git nativa.
3. **Dados nunca inventados.** Se uma fonte falhar, mantenha o último dado bom, marque o dataset como desatualizado e registre o erro. É proibido publicar dataset vazio, parcial ou com campos fabricados. É proibido "chutar" endpoints ou nomes de campos: descubra sondando a fonte e registre a resposta real como fixture.
4. **Reprodutibilidade.**
   - Saídas determinísticas: chaves ordenadas, listas ordenadas por chave estável, `ensure_ascii=False`, sem timestamps dentro dos arquivos de dados (timestamps ficam só em `meta`).
   - Uma execução sem mudança na fonte não gera commit.
   - Sem caminhos absolutos fixos no código.
5. **Idioma e formatos.**
   - Interface em pt-BR.
   - Números com `Intl.NumberFormat('pt-BR')`, datas em `dd/mm/aaaa`, fuso `America/Sao_Paulo`.
   - Código, nomes de variáveis e commits podem ser em inglês. Documentação em pt-BR.
6. **Conformidade.**
   - Uso não comercial (exigência do plano Hobby da Vercel).
   - Atribuição explícita às fontes B3 e CVM em todas as páginas.
   - Aviso de que o conteúdo não é recomendação de investimento.
   - Não há dados pessoais: só companhias e instituições.

# 4. ARQUITETURA

```
                ┌──────────────── GitHub (repositório = fonte da verdade) ─────────────────┐
  Fontes        │                                                                           │
  B3 / CVM ───► │  GitHub Actions (cron)                                                    │
  bancos        │   └─ ETL Python: fetch → raw cache → parse → normalize → validate → diff  │
                │        │                                                     │            │
                │        ▼                                                     ▼            │
                │   data/** (JSON/CSV versionados)                   Issue "data-quality"   │
                │        │ commit somente se houver diff                                    │
                └────────┼──────────────────────────────────────────────────────────────────┘
                         ▼ push na main
                 Vercel (build Next.js estático) ──► CDN ──► navegador (filtros, gráficos)
```

- **Monorepo** com duas partes independentes: `etl/` em Python e `web/` em Next.js. O contrato entre elas são os JSON em `data/public/`, validados por JSON Schema.
- **Git como banco de dados:** os dados processados são versionados. Isso dá histórico, diff e rollback de graça. Downloads brutos **nunca** são commitados; ficam no `actions/cache`.
- O front lê os JSON gerados na build (copiados para `web/public/data/`) e faz todo o processamento interativo no navegador.

# 5. STACK

**ETL**
- Python 3.12, gerenciado com `uv` (`pyproject.toml` + `uv.lock`).
- `httpx` (HTTP/2, timeouts) e `tenacity` (retries).
- `pydantic` v2 (modelos e validação) e `jsonschema` (contratos).
- `typer` (CLI), `selectolax` ou `beautifulsoup4` (HTML das listas de depositárias), `pyyaml`.
- Somente stdlib para ZIP e COTAHIST (processamento em streaming, sem pandas).
- Qualidade: `pytest`, `pytest-cov`, `respx` (mock de HTTP), `ruff` (lint + format), `mypy --strict` nos módulos core.

**Web**
- Next.js na versão estável mais recente: App Router, TypeScript `strict`, `output: 'export'`.
- `pnpm` e Tailwind CSS.
- `@tanstack/react-table` + `@tanstack/react-virtual` para as tabelas.
- `zod` para validar os dados no carregamento.
- **Gráficos em SVG próprio** (componentes React), portando a lógica dos HTMLs do seed: donut, colunas empilhadas, barras divergentes, barras horizontais, sparkline. Nada de biblioteca de gráficos pesada.
- Fontes Plus Jakarta Sans e JetBrains Mono via `next/font` (self-host).
- Qualidade: `vitest` + Testing Library, `@playwright/test`, ESLint, Prettier.

**Automação:** GitHub Actions, Dependabot (pip, npm, actions) e `vercel.json` com cabeçalhos de segurança e cache.

# 6. ESTRUTURA DO REPOSITÓRIO

```
painel-b3/
├─ AGENTS.md                 # comandos, convenções e regras para agentes (crie também CLAUDE.md apontando para ele)
├─ README.md                 # visão geral, como rodar, como contribuir
├─ PROMPT_PROJETO.md         # este arquivo
├─ Makefile                  # atalhos: make setup | etl | test | web | build | probe
├─ seed/                     # SOMENTE LEITURA
├─ config/
│  ├─ instituicoes.yaml      # instituições canônicas: id, nome, aliases, CNPJs, cor da marca, papéis
│  ├─ sources.yaml           # URLs, frequência, timeouts, limites de qualidade por fonte
│  └─ overrides/
│     ├─ depositarias.csv    # ticker → depositária, fonte, data, observação (curadoria manual)
│     └─ escrituradores.csv  # correções manuais pontuais, sempre com fonte
├─ etl/
│  ├─ pyproject.toml
│  ├─ src/painel_etl/
│  │  ├─ cli.py              # typer: run, backfill, probe, validate, report, seed-import
│  │  ├─ core/               # http.py, cache.py, io.py (escrita atômica e determinística), schema.py, diff.py, quality.py, calendar.py
│  │  ├─ sources/            # um módulo por fonte (interface Source; ver seção 8)
│  │  │  ├─ b3_listed.py     # API Empresas Listadas
│  │  │  ├─ cvm_fca.py       # FCA escriturador
│  │  │  ├─ cvm_cad.py       # cadastro de companhias abertas
│  │  │  ├─ b3_cotahist.py   # séries históricas (anual, mensal, diário)
│  │  │  ├─ b3_finservices.py
│  │  │  ├─ bradesco_bdr.py
│  │  │  └─ itau_bdr.py
│  │  ├─ datasets/           # junta as fontes num dataset publicado
│  │  │  ├─ acoes.py
│  │  │  └─ bdrs.py
│  │  └─ normalize/          # instituicoes.py (entity resolution), tickers.py, cnpj.py
│  └─ tests/                 # unit/, integration/ (fixtures gravadas), golden/ (paridade com seed)
├─ schemas/                  # JSON Schema versionado de cada arquivo publicado
├─ data/
│  ├─ public/                # o que o site consome (contrato público)
│  ├─ history/               # séries longas e snapshots mensais (csv.gz)
│  ├─ events/                # log de mudanças append-only (jsonl)
│  └─ state/                 # estado do ETL: últimas datas processadas, ETags, hashes
├─ web/
│  ├─ app/                   # rotas (seção 11)
│  ├─ components/            # charts/, table/, filters/, layout/
│  ├─ lib/                   # data.ts (fetch + zod), format.ts, colors.ts (gerado), url-state.ts, csv.ts
│  ├─ scripts/copy-data.mjs  # copia data/public para web/public/data no prebuild
│  └─ tests/                 # vitest e e2e Playwright
├─ docs/
│  ├─ arquitetura.md
│  ├─ fontes.md              # cada fonte: endpoint, parâmetros, campos, peculiaridades, fixture
│  ├─ operacao.md            # runbook: fonte falhou, backfill, reprocessar, nova instituição
│  ├─ adicionar-dataset.md   # passo a passo de escalabilidade
│  └─ decisoes/              # ADRs curtos (0001-git-como-armazenamento.md, ...)
└─ .github/
   ├─ workflows/             # ci.yml, etl-daily.yml, etl-weekly.yml, etl-monthly.yml, keepalive.yml
   ├─ ISSUE_TEMPLATE/
   └─ dependabot.yml
```

# 7. FONTES DE DADOS (já identificadas e usadas no seed)

Para **cada** fonte, na Fase 0, crie um comando `painel-etl probe <fonte>` que faz uma chamada mínima e salva a resposta real em `etl/tests/fixtures/<fonte>/`. Documente em `docs/fontes.md` os campos efetivamente retornados. Os campos citados abaixo foram observados no seed. Confirme todos.

## 7.1 B3: API Empresas Listadas

- Base: `https://sistemaswebb3-listados.b3.com.br/listedCompaniesProxy/CompanyCall/{Metodo}/{param}`.
- `{param}` é um **JSON codificado em base64** (UTF-8, sem quebras de linha). Exemplo:
  ```python
  import base64, json
  p = {"language": "pt-br", "pageNumber": 1, "pageSize": 120}
  url = f"{BASE}GetInitialCompanies/{base64.b64encode(json.dumps(p).encode()).decode()}"
  ```
- Métodos:

  | método | parâmetros | uso |
  |---|---|---|
  | `GetInitialCompanies` | `language, pageNumber, pageSize` | lista paginada (`page.totalPages`, `results[]`). O campo de tipo separa: 1 = ações (568 no seed); 2 e 4 = BDR; 7 = balcão/outros |
  | `GetDetail` | `codeCVM, language` | detalhe. Ações: `institutionCommon` / `institutionPreferred` = **escriturador** ON/PN; `otherCodes` = tickers; `market`. BDR patrocinado: `institutionPreferred` = **depositária**. Às vezes retorna `{}`; trate como "sem detalhe", nunca como erro fatal (8 casos no seed) |
  | `GetCompaniesBDR` | `language, pageNumber, pageSize, codeCategoryBVMF: -1, company: ""` | BDRs DRE/ETF (321 no seed) |
  | `GetCategoryBDRETF` | `language` | categorias: 28 Renda Fixa, 29 Renda Variável, 30 Commodities, 43 Moeda |

- Política de chamadas:
  - **Diariamente**, a lista completa (barata: poucas páginas).
  - `GetDetail` para companhias **novas ou com mudança na lista**, mais um **rodízio de 1/7** das demais, para que todas sejam revisitadas a cada semana.
  - Concorrência máxima 3, pausa de 300 a 800 ms com jitter, `User-Agent` identificando o projeto e a URL do repositório.

## 7.2 CVM: Formulário Cadastral (FCA), escriturador

- `https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/FCA/DADOS/fca_cia_aberta_{AAAA}.zip`, de 2010 até o ano corrente.
- Dentro do ZIP, use o arquivo `fca_cia_aberta_escriturador_{AAAA}.csv`. Separador `;`, encoding ISO-8859-1 (confirme).
- Campos: `CNPJ_Companhia`, `Data_Referencia`, `Versao`, `Escriturador`, `CNPJ_Escriturador`, `Data_Inicio_Atuacao`, `Data_Fim_Atuacao`.
- Regras (ver `seed/raw/cvm/fca.txt` e `seed/etl/acoes/dash2.py`):
  1. Por companhia e ano, considere só a **maior `Versao`** de cada `Data_Referencia`.
  2. Identifique cada escriturador pelo **`CNPJ_Escriturador`**, que é a chave estável. O nome serve de fallback, via `config/instituicoes.yaml`.
  3. **Atual** = o escriturador do documento mais recente. **Início** = `Data_Inicio_Atuacao`. Se faltar, use o primeiro ano em que ele aparece e marque `inicio_aproximado: true`.
  4. **Anterior** = o último escriturador diferente do atual, com início, fim e último ano em que aparece.
  5. `n_escrituradores` = quantidade distinta no histórico.
- Frequência: anos anteriores só no backfill. O ZIP do ano corrente é checado **diariamente** com `HEAD`/`ETag`/`Last-Modified` e só é baixado se mudou.

## 7.3 CVM: cadastro de companhias abertas (complementar)

- `https://dados.cvm.gov.br/dados/CIA_ABERTA/CAD/DADOS/cad_cia_aberta.csv`: ponte entre CNPJ e código CVM, mais situação do registro. Use para casar B3 com FCA e para detectar cancelamentos. Semanal.

## 7.4 B3: COTAHIST (séries históricas)

- `https://bvmf.bmfbovespa.com.br/InstDados/SerHist/` com três granularidades:
  - anual `COTAHIST_A{AAAA}.ZIP`;
  - mensal `COTAHIST_M{MM}{AAAA}.ZIP` (cerca de 10 MB cada);
  - diária `COTAHIST_D{DD}{MM}{AAAA}.ZIP`.

  **Confirme o padrão do arquivo diário na Fase 0.**
- Layout de largura fixa, encoding ISO-8859-1. Registro `00` = header, `01` = cotação, `99` = trailer. Posições 1-indexadas e inclusivas:

  | campo | posição | | campo | posição |
  |---|---|---|---|---|
  | TIPREG | 1–2 | | PREULT (2 casas implícitas) | 109–121 |
  | DATA (AAAAMMDD) | 3–10 | | TOTNEG | 148–152 |
  | CODBDI | 11–12 | | QUATOT | 153–170 |
  | CODNEG | 13–24 | | VOLTOT (2 casas implícitas) | 171–188 |
  | TPMERC | 25–27 | | CODISI | 231–242 |
  | NOMRES | 28–39 | | ESPECI | 40–49 |

  Valide contra o layout oficial da B3 (`SeriesHistoricas_Layout.pdf`) e guarde o link em `docs/fontes.md`.
- Filtro de BDR:
  - `TPMERC` em `010` (vista) e `020` (fracionário);
  - ticker no padrão `^[A-Z0-9]{4}3[1-59]F?$`;
  - some o fracionário no mesmo ticker-base;
  - **exclua** opções e termo, e `ESPECI` contendo `UNT` (como PPLA11 no seed).
- Estratégia:
  - **Diária:** processe os arquivos `D` dos pregões ainda não processados, guardados em `data/state/cotahist.json`, e agregue em partições mensais `data/history/bdr_volume/{AAAA}-{MM}.json` (por ticker: volume, negócios, último preço, primeiro e último pregão).
  - **Feriados:** um 404 num dia útil não é erro. Registre como "sem pregão/sem arquivo" e tente de novo nos 3 dias seguintes; só depois disso considere sem pregão.
  - **Mensal:** quando sair o arquivo `M` do mês fechado, **reconcilie**, substituindo a partição agregada dos diários pelo mensal. Diferença acima de 0,5% gera alerta de qualidade.
  - **Backfill:** `painel-etl backfill cotahist --from 2024-10` usa os arquivos `M` (e `A` para anos fechados).
  - Processe os ZIPs em streaming, linha a linha, sem carregar tudo em memória.

## 7.5 Depositárias de BDR não patrocinados

A API da B3 não informa a depositária de BDR não patrocinado. A resolução segue esta **ordem de prioridade** (a mesma de `seed/etl/bdrs/build.py`), registrando sempre a fonte vencedora no campo `fonte_depositaria`:

1. **API B3** (`GetDetail.institutionPreferred`) para patrocinados.
2. **Banco B3**: listas de programas DRN e ETF em `https://finservices.b3.com.br/` (no seed: 761 DRN e 309 ETF; `*` = investidor qualificado). Os PDFs de programa seguem o padrão `finservices.b3.com.br/documents/823983/.../Programa_{ISIN}.pdf`, úteis para conferência pontual.
3. **Bradesco Custódia**: página de programas BDR não patrocinados em `https://custodia.bradesco/bradescocustodia/` (lista de emissores e ETFs VanEck; os descritivos ficam em `.../static_files/portal/layout/temas/custodia/pdf/...`).
4. **Itaú Securities Services**: página de BDRs não patrocinados em `itau.com.br` (11 programas no seed).
5. **`config/overrides/depositarias.csv`**: curadoria manual com fonte e data. Comece importando os mapas `BRADESCO` e `ITAU` do seed, com as fontes citadas lá.
6. Sem resolução: `"Não identificado"`. Isso aparece na página `/status` e no relatório de qualidade (era 0,2% do volume no seed).

Na Fase 0, localize as URLs exatas das listas (2, 3 e 4) navegando a partir dos domínios acima, registre-as em `config/sources.yaml` e grave fixtures. Os scrapers devem ser **tolerantes**: se o número de itens extraídos cair mais de 20% em relação à execução anterior, não sobrescreva; mantenha a lista anterior e abra alerta. Frequência semanal.

# 8. PIPELINE ETL: REQUISITOS DE ROBUSTEZ

**Interface comum**, em que cada fonte implementa:

```python
class Source(Protocol):
    name: str
    def fetch(self, ctx: RunContext) -> list[RawArtifact]: ...   # baixa para o cache, com ETag/sha256
    def parse(self, raw: list[RawArtifact]) -> Iterable[Model]: ... # pydantic
```

e cada dataset (`acoes`, `bdrs`) declara as fontes de que depende, junta, valida e publica. Um novo dataset entra **só** com um novo módulo em `datasets/`, um schema e uma página, sem mexer no core (seção 13).

**HTTP**
- Timeout de 10 s para conectar e 60 s para ler (180 s para COTAHIST).
- Retry com backoff exponencial e jitter (até 5 tentativas) em erro de rede, 429 e 5xx. Respeite `Retry-After`.
- *Circuit breaker* por fonte: 5 falhas seguidas abortam a fonte, sem derrubar as outras.
- Suporte opcional a `PAINEL_HTTP_BASE_PROXY` (variável de ambiente) para o plano B da seção 9.4.

**Cache e estado**
- Downloads em `.cache/raw/<fonte>/<data>/` com `sha256`. Conteúdo idêntico ao anterior faz pular o parse.
- `data/state/*.json` guarda ETags, últimas datas processadas e contagens anteriores.

**Escrita**
- Atômica: arquivo temporário seguido de `os.replace`.
- Determinística: JSON com `sort_keys`, indentação 0 nos arquivos grandes e 2 nos pequenos, final de linha `\n`.
- CSV com separador `;` e UTF-8 com BOM, para abrir bem no Excel.

**Portões de qualidade** (`core/quality.py`). Se qualquer um falhar, **aquele dataset não é publicado** e o anterior permanece:
- contagem de registros não cai mais de 10% em relação à última publicação (limite configurável em `sources.yaml`);
- campos obrigatórios presentes; ticker único; CNPJ com dígitos verificadores válidos; datas parseáveis e não futuras; volumes ≥ 0;
- JSON Schema válido;
- paridade com o seed na primeira execução (seção 14).

**Diff e eventos.** A cada publicação, compare com a anterior e acrescente em `data/events/AAAA.jsonl`:

```json
{"data":"2026-10-29","dataset":"acoes","tipo":"troca_escriturador","chave":"CODCVM","de":"Banco Bradesco","para":"Itaú Corretora","fonte":"B3"}
```

Tipos: `nova_listagem`, `deslistagem`, `troca_escriturador`, `divergencia_b3_cvm`, `ticker_novo`, `ticker_removido`, `mudanca_segmento`, `novo_bdr`, `bdr_cancelado`, `troca_depositaria`.

**Relatório.** `data/public/meta.json` traz, por fonte: última tentativa, último sucesso, status (`ok`, `desatualizado`, `erro`), contagens, duração e mensagem de erro resumida.

**CLI**
- `painel-etl run [--dataset acoes|bdrs|all] [--sources ...] [--dry-run]`
- `painel-etl backfill cotahist --from AAAA-MM [--to AAAA-MM]`
- `painel-etl backfill fca --from 2010`
- `painel-etl probe [fonte]`
- `painel-etl validate`
- `painel-etl report`, que imprime um resumo em Markdown (usado no Job Summary do Actions e nas Issues)
- `painel-etl seed-import`, que converte `seed/` no formato novo de `data/` (carga inicial)

# 9. AGENDAMENTO E AUTOMAÇÃO (GitHub Actions)

## 9.1 Workflows

Os crons do Actions são em UTC e podem atrasar; evite minutos cheios.

| workflow | quando | o que faz |
|---|---|---|
| `ci.yml` | PR e push | lint, typecheck, testes ETL (sem rede, com fixtures), testes web, build estático, Playwright no build |
| `etl-daily.yml` | `23 1 * * 2-6` (≈ 22h23 BRT, de seg a sex) | B3 lista + rodízio de detalhes; COTAHIST diário; FCA do ano corrente se mudou; publica `acoes` e `bdrs` |
| `etl-weekly.yml` | `41 9 * * 0` | listas de depositárias (Banco B3, Bradesco, Itaú); cadastro CVM; revisita completa de `GetDetail` |
| `etl-monthly.yml` | `7 11 5 * *` | reconciliação do COTAHIST mensal do mês anterior; snapshot mensal em `data/history/snapshots/AAAA-MM/*.csv.gz` |
| `keepalive.yml` | mensal | garante atividade no repositório, para que o GitHub não desative workflows agendados por inatividade (regra válida para repositórios públicos; confirme na documentação atual) |

## 9.2 Requisitos comuns

- `workflow_dispatch` com inputs (dataset, fontes, datas), para rodar manualmente.
- `concurrency: { group: etl, cancel-in-progress: false }`, para evitar commits concorrentes.
- `timeout-minutes` explícito (30 no diário, 60 no backfill).
- `permissions` mínimas: `contents: write` e `issues: write` só nos ETLs.
- Actions de terceiros **fixadas por SHA**.
- `actions/cache` para `.cache/raw` e para o ambiente `uv`.
- Commit apenas se `git diff --quiet data/` falhar. Mensagem: `data(acoes,bdrs): atualização 2026-10-29 [+3 eventos]`. Autor: `painel-b3-bot <github-actions[bot]@users.noreply.github.com>`.
- Com o portão de qualidade reprovado ou a fonte fora do ar, abra ou atualize **uma** Issue por fonte com label `data-quality` (via `gh`) contendo o relatório. Feche a Issue sozinho quando a fonte voltar.
- Escreva o relatório no `$GITHUB_STEP_SUMMARY`.

## 9.3 Custo

- Repositório **público**: minutos do Actions gratuitos em runners padrão. Recomendado.
- Repositório privado: consome a cota gratuita mensal do plano. Meça a duração de cada job e documente o consumo mensal estimado em `docs/operacao.md`. Meta: diário abaixo de 5 min, mensal abaixo de 15 min.
- Vercel Hobby: cada push na `main` gera um deploy (limite de 100 por dia), bem acima do necessário. Configure `ignoreCommand` para pular a build quando o commit não altera `data/public/` nem `web/`.

## 9.4 Plano B se a B3 ou a CVM bloquearem os IPs do GitHub

Teste na Fase 0, com um workflow `probe.yml` manual. A primeira coleta foi feita a partir de um navegador; não há garantia de que os IPs de datacenter sejam aceitos. Se houver bloqueio, implemente nesta ordem:

1. Headers de navegador (`Accept`, `Accept-Language: pt-BR`, `Referer` do site da B3) e ritmo mais lento.
2. **Runner self-hosted** no meu computador (gratuito), registrado só para os jobs da fonte bloqueada e com fallback para rodar manualmente: `make etl && git push`.
3. **Cloudflare Worker** (plano gratuito) como proxy de leitura restrito a uma lista de domínios permitidos, ativado por `PAINEL_HTTP_BASE_PROXY`.

Documente o que foi necessário num ADR.

# 10. CONTRATOS DE DADOS (`data/public/`)

Use chaves **legíveis** em português, sem abreviações de uma letra; a compressão da CDN cuida do tamanho. Todo arquivo tem `schema_version` e um JSON Schema correspondente em `schemas/`.

- `meta.json`: versão, data de cada fonte, status, contagens, meses cobertos.
- `instituicoes.json`: gerado de `config/instituicoes.yaml`, com `id`, `nome`, `nome_curto`, `cor`, `papeis` (`escriturador`, `depositaria`) e `cnpjs`.
- `acoes.json`: lista de companhias com
  - `codigo_cvm`, `pregao`, `razao_social`, `emissor`, `cnpj`;
  - `segmento`, `setor`, `tickers[{ticker, classe}]`;
  - `escriturador_b3{on, pn, bruto_on, bruto_pn}`;
  - `escriturador_cvm{atual, inicio, inicio_aproximado, anterior, anterior_inicio, anterior_fim, anterior_ultimo_ano, n_escrituradores}`;
  - `divergente_b3_cvm`, `situacao_cvm`.
- `acoes_historico_escrituradores.json`: por companhia, a linha do tempo completa (instituição, início, fim, fonte).
- `bdrs.json`: lista com
  - `ticker`, `nome`, `tipo` (`DRN`, `DRE`, `DR1`, `DR2`, `DR3`), `isin`;
  - `depositaria`, `fonte_depositaria`, `categoria`, `qualificado`;
  - `primeiro_pregao`, `ultimo_pregao`, `ultimo_preco`;
  - `negocios_24m`, `volume_24m`, `volume_mensal` (24 números, alinhados com `meta.meses`).
- `bdrs/{ticker}.json` (opcional, carregado sob demanda): série mensal completa desde o início do histórico.
- `eventos.json`: os últimos 500 eventos. Gere também `web/public/feed.xml` (Atom) com eles, para eu acompanhar mudanças por leitor de RSS sem custo.
- `downloads/`: `acoes.csv` e `bdrs.csv`, com cabeçalhos iguais aos de `seed/data/*.csv`.

# 11. FRONT-END

## 11.1 Rotas (todas estáticas)

| rota | conteúdo |
|---|---|
| `/` | capa com KPIs dos dois painéis, data da última atualização por fonte, últimos eventos e atalhos |
| `/acoes` | dashboard de ações: paridade total com `seed/html/dashboard_acoes_b3.html` |
| `/acoes/tabela` | tabela completa: paridade com `seed/html/empresas_acoes_b3.html` |
| `/acoes/[codigoCvm]` | página da companhia: dados, tickers e **linha do tempo de escrituradores** |
| `/bdrs` | dashboard de BDRs: paridade total com `seed/html/dashboard_bdrs_b3.html` |
| `/bdrs/[ticker]` | página do BDR: depositária e fonte, gráfico de volume mensal (24 meses e histórico completo), preço, negócios |
| `/instituicoes` | ranking de escrituradores e depositárias; ganhos e perdas de clientes no período |
| `/novidades` | eventos filtráveis (tipo, dataset, período) e link para o feed Atom |
| `/status` | saúde dos dados: status por fonte, defasagem, BDRs sem depositária, últimas execuções do ETL |
| `/sobre` | fontes com links, metodologia, regras de normalização, limitações, aviso legal, downloads |

As páginas de detalhe usam `generateStaticParams`, cerca de 1.700 páginas. Se a build passar de 3 minutos, troque para uma página única com parâmetro de busca e registre a decisão em ADR.

## 11.2 Paridade funcional com os HTMLs do seed (checklist obrigatório)

Abra os três HTMLs, liste **todas** as funcionalidades num checklist em `docs/paridade.md` e marque cada uma ao portar. No mínimo:

- **Ações**
  - KPIs.
  - Donuts por escriturador, segmento e histórico CVM.
  - Colunas empilhadas "trocas por ano" e barras divergentes "saldo de trocas".
  - Barras por setor e por classe de ticker.
  - Filtros cruzados: clicar num gráfico filtra os demais e a tabela.
  - Busca textual.
  - Tabela com as colunas "Escriturador desde" e "Escriturador anterior".
  - Selo "CVM indica…" quando há divergência.
  - Exportação CSV da visão filtrada.
- **Tabela de ações**: filtros por escriturador atual, escriturador anterior, histórico, segmento e "somente com ticker"; coluna Cód. CVM; CSV.
- **BDRs**
  - KPIs.
  - Colunas empilhadas mensais por tipo; clicar num mês define o mês do ranking.
  - Donuts por depositária, tipo e classe de ETF.
  - Top 15 do mês, curva de concentração.
  - Tabela com sparkline e alternância "Mostrar os 24 meses".
  - CSV.

## 11.3 Identidade visual

- **Tema claro** com cores vibrantes, como no seed. Tokens de cor em CSS variables, para permitir modo escuro no futuro.
- **Cores das instituições = identidade da marca.** A fonte única é `config/instituicoes.yaml`, de onde é gerado `web/lib/colors.ts`. Valores do seed:

  | instituição | cor | | instituição | cor |
  |---|---|---|---|---|
  | Itaú Corretora | `#EC7000` | | Itaú Unibanco | `#F7A04B` |
  | Banco Bradesco | `#CC092F` | | Bradesco CTVM | `#E8607A` |
  | BTG Pactual | `#0B3D91` | | Banco do Brasil | `#F2C200` |
  | Banco Santander | `#FF3B30` | | Própria empresa | `#5B6B82` |
  | Oliveira Trust | `#00A86B` | | Vórtx DTVM | `#7B2FF7` |
  | Banco Mercantil do Brasil | `#2F80ED` | | Banrisul | `#00579C` |
  | Banco do Nordeste | `#8E1B3A` | | Banco Safra | `#B8962E` |
  | ID CTVM | `#14B8A6` | | Banco Opportunity | `#334155` |
  | BRB DTVM | `#0EA5E9` | | Oslo Capital DTVM | `#94A3B8` |
  | Banco B3 (depositária) | `#0B7FA6` | | Não informado / identificado | `#D3D2DE` / `#B9B8C7` |

  Instituição sem cor definida recebe um cinza neutro. Nunca gere cor aleatória.
- Cores de categoria:
  - tipos de BDR: DRN `#6250D6`, DRE `#1BAF7A`, patrocinado `#EDA100`;
  - segmentos: NM `#4A3AA7`, N2 `#8F80E6`, N1 `#C4BCF3`, MP `#E87BA4`, B `#1BAF7A`, SO `#EDA100`, BN `#9AA3B5`;
  - histórico: trocou `#6250D6`, sem troca `#1BAF7A`, sem dados `#D3D2DE`.
- Mescle os tipos de gráfico: donut para composição (até cerca de 8 fatias; o resto vira "Outros"), barras para ranking, colunas para série temporal. Rótulos diretos sempre que couber.

## 11.4 Requisitos não funcionais do front

- **Estado na URL.** Filtros, busca, ordenação e mês ficam na querystring, para que qualquer visão seja compartilhável.
- **Desempenho.**
  - JS inicial ≤ 200 KB gzip por rota.
  - JSON carregado só na rota que o usa.
  - Tabelas virtualizadas.
  - Lighthouse ≥ 90 em Performance, Acessibilidade, Boas Práticas e SEO, em mobile.
- **Acessibilidade WCAG 2.2 AA.**
  - Navegação por teclado em gráficos e filtros.
  - `aria-label` e `<title>` nos SVGs.
  - Cor nunca é o único portador de informação (texto e padrões também).
  - Cada gráfico tem uma alternativa "ver como tabela".
  - Contraste verificado.
- **Responsivo** de 360 px a 1920 px, sem rolagem horizontal da página; tabelas largas rolam dentro do próprio container.
- **Resiliência.**
  - Dados validados com `zod` no carregamento.
  - Estados de carregando, vazio e erro.
  - Faixa de aviso quando `meta.json` indica fonte desatualizada há mais de 3 dias úteis (diário) ou 10 dias (semanal).
- **Rodapé em todas as páginas**: "Fontes: B3 e CVM (dados públicos). Última atualização: dd/mm/aaaa hh:mm. Não é recomendação de investimento."
- **SEO**: metadados por página, `sitemap.xml`, `robots.txt` e imagem Open Graph estática.
- `vercel.json`:
  - CSP restritiva, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`;
  - `Cache-Control` longo para assets com hash e curto (`max-age=300, stale-while-revalidate`) para `/data/*`.

# 12. CONFIGURAÇÃO CENTRAL DE INSTITUIÇÕES

`config/instituicoes.yaml` é a única fonte para nomes, aliases, CNPJs e cores. Exemplo:

```yaml
- id: itau-corretora
  nome: Itaú Corretora de Valores S.A.
  nome_curto: Itaú Corretora
  cnpjs: ["61.194.353/0001-64"]   # confirme na FCA
  aliases: ["itau corretora", "itaú corretora de valores"]
  cor: "#EC7000"
  papeis: [escriturador]
```

- A resolução de entidade (`normalize/instituicoes.py`) porta a função `entity()` do seed. Ordem: CNPJ → alias exato normalizado (sem acento, minúsculo) → regras do seed (por exemplo, "banco mercantil" e não só "mercantil") → detecção de "Própria empresa" (o nome do escriturador coincide com a razão social) → `nao-mapeado`.
- Nomes não mapeados aparecem no relatório de qualidade para eu incluir no YAML; nunca falham silenciosamente.
- Preencha os CNPJs a partir do campo `CNPJ_Escriturador` da FCA, e não de memória.

# 13. ESCALABILIDADE

- Adicionar um dataset novo (por exemplo, FIIs, ETFs nacionais, debêntures, volume de ações) deve exigir só:
  1. módulos de fonte, se forem novos;
  2. um módulo em `datasets/`;
  3. um schema;
  4. uma rota no `web/`;
  5. uma entrada no `sources.yaml`.

  Documente isso em `docs/adicionar-dataset.md` e prove fazendo o **volume mensal de ações** como exemplo no backlog da Fase 7: o COTAHIST já é baixado, então o custo marginal é zero.
- Orçamento de tamanho: `data/public/` com até 15 MB e o repositório com até 500 MB. Séries longas ficam em `data/history/` como `csv.gz` particionado por ano. Se o crescimento ameaçar o limite, registre um ADR com a alternativa gratuita (por exemplo, publicar históricos como assets de GitHub Releases).
- Componentes de gráfico e tabela são genéricos, configurados por props, sem lógica de domínio dentro.

# 14. TESTES E CRITÉRIOS DE ACEITE

- **Unitários (ETL):**
  - base64 dos parâmetros;
  - parser COTAHIST (linhas reais de fixture, header e trailer);
  - leitor de ZIP;
  - regras de escriturador atual e anterior (casos: sem troca, uma troca, várias trocas, data ausente, versões múltiplas);
  - resolução de entidade;
  - resolução de depositária;
  - validação de CNPJ;
  - portões de qualidade;
  - diff e eventos.
- **Integração:** cada fonte com respostas gravadas (`respx`). O CI **nunca** acessa a rede.
- **Golden (paridade com o seed):** o pipeline executado sobre as fixtures do seed deve reproduzir:
  - `acoes`: 568 companhias; mesmo escriturador atual e anterior em ≥ 99% dos casos; diferenças listadas e justificadas em `docs/paridade.md`;
  - `bdrs`: 1.143 BDRs; distribuição de depositárias igual à do seed (Banco B3 1.026, não identificado 56, Bradesco 46, Itaú 15), com tolerância de ±1%; volume total de 24 meses com diferença ≤ 0,1%.
- **Contrato:** todo arquivo em `data/public/` valida no JSON Schema; o `zod` do front e o schema não divergem (gere os tipos TS a partir do JSON Schema ou teste a equivalência).
- **Web:** vitest para formatação pt-BR, filtros, estado na URL e CSV; Playwright no build estático, cobrindo:
  - cada rota renderiza sem erro de console;
  - um filtro cruzado altera KPIs e tabela;
  - o CSV baixado tem as linhas esperadas;
  - navegação por teclado funciona;
  - viewport de 360 px sem rolagem horizontal.
- **Cobertura:** ETL ≥ 80% nos módulos `core`, `normalize` e `datasets`.

**Definição de pronto** de cada fase: testes verdes, lint e typecheck limpos, documentação da fase atualizada, relatório entregue.

# 15. PLANO DE EXECUÇÃO EM FASES

**Fase 0: Descoberta e sondagem (sem código de produto)**
1. Leia `seed/` inteiro: README, scripts e os três HTMLs.
2. Escreva `docs/paridade.md` com o checklist completo de funcionalidades dos HTMLs.
3. Sonde cada fonte da seção 7 a partir da sua máquina. Confirme campos, padrão do COTAHIST diário e URLs das listas de depositárias. Grave fixtures.
4. Prepare `probe.yml` para eu rodar no GitHub e testar o bloqueio de IP (seção 9.4).
5. Relatório: fontes OK ou com problema, divergências em relação a este prompt, riscos e perguntas.

**Fase 1: Esqueleto e CI.** Monorepo, `uv`, `pnpm`, Makefile, `AGENTS.md`, `ci.yml`, Dependabot, ADR 0001 (Git como armazenamento) e ADR 0002 (site estático).

**Fase 2: ETL de ações.** Core (`http`, `cache`, `io`, `quality`, `diff`), fontes B3 Listadas, FCA e cadastro CVM, `instituicoes.yaml`, dataset `acoes`, `seed-import`, testes golden.

**Fase 3: ETL de BDRs.** COTAHIST (diário, mensal e anual, com reconciliação), Banco B3, Bradesco, Itaú, overrides, dataset `bdrs`, testes golden.

**Fase 4: Front-end com paridade.** Layout, componentes de gráfico, `/`, `/acoes`, `/acoes/tabela`, `/bdrs`. Checklist de paridade 100% marcado. Antes de seguir, mostre capturas de tela de 1440 px e 390 px.

**Fase 5: Páginas novas.** Detalhes de companhia e de BDR, `/instituicoes`, `/novidades` + feed Atom, `/status`, `/sobre`, downloads.

**Fase 6: Automação e deploy.**
- Workflows diário, semanal, mensal e keepalive; Issues de qualidade.
- `vercel.json` com `ignoreCommand`.
- Guia em `docs/operacao.md` com os passos que **eu** executo: criar o repositório, conectar na Vercel, habilitar Actions.
- Uma semana simulada com `workflow_dispatch`.

**Fase 7: Endurecimento.** Lighthouse, acessibilidade, testes de borda (fonte fora do ar, queda de contagem, ZIP corrompido, feriado), documentação final, exemplo de escalabilidade (volume mensal de ações).

# 16. REGRAS DE TRABALHO PARA VOCÊ (AGENTE)

- Antes de decidir algo ambíguo e caro de desfazer, **pergunte**. Para o resto, escolha o padrão razoável e registre em `docs/decisoes/`.
- Nunca invente endpoint, campo, CNPJ ou cor de marca. Confirme na fonte ou pergunte.
- Faça commits pequenos e descritivos (Conventional Commits). Não faça push sem eu pedir.
- Não apague nem reescreva `seed/`, `data/history/` ou `data/events/` (este último é append-only).
- Antes de dizer que algo está pronto, rode os testes e a build e mostre a saída resumida.
- Se uma fonte estiver indisponível durante o desenvolvimento, use as fixtures e siga em frente. Avise no relatório.
- Mantenha o `AGENTS.md` atualizado com os comandos reais do projeto.

# 17. ENTREGÁVEIS FINAIS

1. Repositório completo, conforme a seção 6, com testes passando no CI.
2. Site publicado em `https://<projeto>.vercel.app` com as rotas da seção 11.
3. Atualização automática diária, semanal e mensal funcionando, com Issues de qualidade e feed de eventos.
4. Documentação: README, arquitetura, fontes, operação (runbook), como adicionar dataset, paridade e ADRs.
5. Um relatório final com:
   - consumo estimado de minutos do Actions por mês;
   - tamanho dos dados;
   - riscos conhecidos, como scrapers frágeis e possíveis mudanças na API da B3;
   - próximos passos sugeridos.
