# Painel B3

Site público, em português, com dois painéis:

- **Ações:** escriturador atual de cada companhia listada na B3, desde quando, quem era antes e onde B3 e CVM divergem.
- **BDRs:** depositária de cada BDR, tipo de programa e volume financeiro mensal.

Os dados vêm de fontes públicas da **B3** e da **CVM** e se atualizam sozinhos pelo GitHub Actions. Custo zero: site estático na Vercel, ETL no GitHub Actions, dados versionados neste repositório. Uso não comercial. Não é recomendação de investimento.

> **Estado:** Fase 1 concluída (esqueleto e CI). Ainda não há dados nem painéis; veja o plano em `PROMPT_PAINEL_B3.md` e as decisões em `docs/`.

## Como rodar
Requisitos: [uv](https://docs.astral.sh/uv/), [pnpm](https://pnpm.io/) e Node 20.19+.

```bash
make setup        # instala ETL (uv) e web (pnpm)
make test         # testes do ETL e do web
make lint         # ruff, mypy, eslint, tsc, prettier
make web          # servidor de desenvolvimento
make build        # build estático em web/out
make probe        # sonda as fontes e regrava os fixtures (usa a rede)
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
