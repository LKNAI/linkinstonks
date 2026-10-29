# AGENTS.md

Guia para agentes (e pessoas) neste repositório. `CLAUDE.md` aponta para este arquivo. Mantenha-o atualizado com os comandos reais.

## O que é
Painel B3: site estático (Next.js, Vercel) que mostra escrituradores de ações e depositárias de BDRs, alimentado por um ETL em Python que roda no GitHub Actions a partir de fontes públicas da B3 e da CVM. Especificação completa: `PROMPT_PAINEL_B3.md`. Estado e decisões: `docs/`.

## Regras que não se negociam
- **`seed/` é somente leitura.** Nunca editar nem apagar (o CI falha em PR que a altere). Também não reescrever `data/history/`; `data/events/` é append-only.
- **Custo zero, sem segredos.** Só site estático (`output: 'export'`), sem Serverless Functions. O único token é o `GITHUB_TOKEN` do Actions.
- **Dados nunca inventados.** Fonte falhou: manter o último dado bom e registrar. Nada de endpoint, campo, CNPJ ou cor de marca "de cabeça": confirmar na fonte (`docs/fontes.md`) ou perguntar.
- **Saídas determinísticas:** chaves ordenadas, `ensure_ascii=False`, sem timestamp dentro dos dados (só em `meta`), `\n` no fim. Uma execução sem mudança na fonte não gera commit.
- **O CI nunca acessa a rede.** `etl/tests/conftest.py` bloqueia sockets; use fixtures (`etl/tests/fixtures`) e `respx`.
- **Idioma:** interface e documentação em pt-BR; código, variáveis e commits podem ser em inglês (Conventional Commits).
- **Não fazer push** sem o dono pedir.

## Estrutura
```
etl/   Python 3.12 (uv). Pacote painel_etl: cli, core/, sources/, datasets/, normalize/, probe.py
web/   Next.js 16 + TypeScript strict + Tailwind 4 (pnpm). Export estático em web/out
data/  public/ (contrato com o site) · history/ · events/ · state/
config/  instituicoes.yaml · sources.yaml · overrides/*.csv
schemas/ JSON Schema de cada arquivo de data/public
docs/  arquitetura, fontes, paridade, decisoes/ (ADRs)
```

## Comandos
| o quê | comando |
|---|---|
| instalar tudo | `make setup` (ou `cd etl && uv sync`; `cd web && pnpm install`) |
| testes ETL | `cd etl && uv run pytest` |
| lint/tipos ETL | `cd etl && uv run ruff check . && uv run ruff format --check . && uv run mypy` |
| testes web | `cd web && pnpm test` |
| lint/tipos web | `cd web && pnpm lint && pnpm typecheck && pnpm format:check` |
| build estático | `cd web && pnpm build` (roda `prebuild`: copia `data/public` → `web/public/data`) |
| e2e | `cd web && pnpm test:e2e` (precisa do build; `pnpm exec playwright install chromium` na 1ª vez) |
| sondar fontes | `cd etl && uv run painel-etl probe [fonte]` (usa a rede; regrava fixtures) |
| tudo do CI | `make check` |

Sem `make` (Windows): rode os comandos da tabela.

## Convenções
- **ETL:** `ruff` (linha 120), `mypy --strict`, `pydantic` v2 nos modelos. Um módulo por fonte em `sources/` (`fetch` + `parse`); datasets em `datasets/`. Novo dataset = módulo + schema + rota + entrada em `sources.yaml` (`docs/adicionar-dataset.md`, Fase 7).
- **Web:** Prettier (linha 110), ESLint do Next. Números `Intl.NumberFormat('pt-BR')`, datas `dd/mm/aaaa`, fuso `America/Sao_Paulo` (`web/lib/format.ts`). Componentes de gráfico/tabela genéricos, sem lógica de domínio.
- **Next.js 16:** a versão tem diferenças em relação ao que se conhece; a documentação oficial vem no pacote em `web/node_modules/next/dist/docs/` (ver `web/AGENTS.md`). `headers`/`redirects`/`rewrites` do Next **não** funcionam com `output: 'export'`; cabeçalhos ficam no `vercel.json`.
- **GitHub Actions:** actions de terceiros fixadas por **SHA** (com a versão em comentário). Resolver o SHA com `gh api`, nunca de memória.
- **Node:** o projeto roda no Node 20.19+ (máquina do dono) e o CI usa Node 22. Por isso `vitest` e `jsdom` estão numa major anterior (ver `dependabot.yml`).

## Armadilhas já conhecidas (detalhes em `docs/fontes.md`)
- `GetDetail` e `GetCategoryBDRETF` da B3 devolvem **JSON dentro de string**: decodificar duas vezes.
- FCA e CAD da CVM e o COTAHIST são **ISO-8859-1**; COTAHIST usa `\r\n` e 245 colunas.
- No FCA, um documento pode ter **mais de uma linha** de escriturador; o "atual" é o sem `Data_Fim_Atuacao`. CNPJ e nome nem sempre concordam: comparar pela raiz do CNPJ e, em conflito, vale o nome (`docs/decisoes/0000-decisoes-fase-0.md`).
- Itaú bloqueia clientes não-navegador (403): sem scraper; curadoria manual em `config/overrides/depositarias.csv`. **Não** tentar contornar o bloqueio.
- A chave confiável de BDR na API da B3 é `typeBDR`, não `type`.

## Fases
0 descoberta ✅ · 1 esqueleto e CI ✅ · 2 ETL de ações · 3 ETL de BDRs · 4 front com paridade · 5 páginas novas · 6 automação e deploy · 7 endurecimento. Cada fase termina com relatório; só avançar com autorização do dono.
