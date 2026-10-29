# linkinstonks

Painel B3: escrituradores de ações e depositárias de BDRs. Repositório previsto: `LKNAI/linkinstonks`; site previsto: `linkinstonks.vercel.app`.

Site público, em português, com dois painéis:

- **Ações:** escriturador atual de cada companhia listada na B3, desde quando, quem era antes e onde B3 e CVM divergem.
- **BDRs:** depositária de cada BDR, tipo de programa e volume financeiro mensal.

Os dados vêm de fontes públicas da **B3** e da **CVM** e se atualizam sozinhos pelo GitHub Actions. Custo zero: site estático na Vercel, ETL no GitHub Actions, dados versionados neste repositório. Uso não comercial. Não é recomendação de investimento.

> **Estado:** Fases 0 a 5 concluídas (a 5 aguarda revisão). O ETL de ações e de BDRs funciona contra as fontes vivas e reproduz o protótipo (`seed/`), e o site tem os painéis com paridade com o seed, a página de cada companhia e de cada BDR, instituições, novidades (com feed Atom), status e sobre. Faltam a automação e o deploy (Fase 6). Plano em `PROMPT_PAINEL_B3.md`, decisões em `docs/`.

## Como rodar
Requisitos: [uv](https://docs.astral.sh/uv/), [pnpm](https://pnpm.io/) e Node 20.19+.

```bash
make setup        # instala ETL (uv) e web (pnpm)
make test         # testes do ETL e do web
make lint         # ruff, mypy, eslint, tsc, prettier
make web          # servidor de desenvolvimento
make build        # build estático em web/out
make probe        # sonda as fontes e regrava os fixtures (usa a rede)

cd etl
uv run painel-etl run --weekly      # busca, normaliza, valida e publica em data/public (usa a rede)
uv run painel-etl validate          # confere data/public contra os JSON Schemas
```

Sem `make` (Windows), veja a tabela de comandos em [`AGENTS.md`](AGENTS.md).

## Estrutura
| pasta | conteúdo |
|---|---|
| `etl/` | ETL em Python (`painel-etl`) |
| `web/` | site Next.js (export estático) |
| `data/` | dados publicados, histórico, eventos e estado do ETL |
| `config/` | instituições, fontes e correções manuais |
| `schemas/` | JSON Schema dos arquivos publicados |
| `docs/` | arquitetura, fontes, paridade com o protótipo e decisões (ADRs) |
| `seed/` | protótipo e dados iniciais — **somente leitura** |

## Documentação
[Arquitetura](docs/arquitetura.md) · [Fontes de dados](docs/fontes.md) · [Paridade com o protótipo](docs/paridade.md) · [Decisões](docs/decisoes/)

## Fontes e atribuição
Dados públicos da [B3](https://www.b3.com.br) e da [CVM](https://dados.cvm.gov.br). Este projeto não é afiliado a nenhuma das duas.
