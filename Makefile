# Atalhos do projeto. Requer: uv, pnpm, Node >= 20.19. No Windows sem `make`, rode os comandos de cada alvo à mão.
.PHONY: setup etl test lint web build probe check

setup:
	cd etl && uv sync
	cd web && pnpm install

etl: ## roda o ETL (Fase 2+; hoje sai com código 3)
	cd etl && uv run painel-etl run

lint:
	cd etl && uv run ruff check . && uv run ruff format --check . && uv run mypy
	cd web && pnpm lint && pnpm typecheck && pnpm format:check

test:
	cd etl && uv run pytest
	cd web && pnpm test

web: ## servidor de desenvolvimento
	cd web && pnpm dev

build: ## build estático em web/out
	cd web && pnpm build

probe: ## sonda as fontes e regrava os fixtures (usa a rede)
	cd etl && uv run painel-etl probe

check: lint test build ## tudo que o CI roda, menos o Playwright
