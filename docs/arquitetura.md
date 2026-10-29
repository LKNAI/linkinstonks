# Arquitetura

```
 Fontes B3 / CVM / bancos
        │  HTTP (httpx, retry, circuit breaker)
        ▼
 etl/ (Python 3.12, uv)  fetch → cache bruto → parse → normalize → validate → diff
        │  commit só se houver diferença, pelo GitHub Actions
        ▼
 data/public/*.json   ◄── contrato (JSON Schema em schemas/)
        │  push na main
        ▼
 web/ (Next.js, export estático) ──► Vercel CDN ──► navegador (filtros, gráficos, CSV)
```

## Decisões
- [ADR 0001: Git como armazenamento](decisoes/0001-git-como-armazenamento.md)
- [ADR 0002: Site estático](decisoes/0002-site-estatico.md)
- [Decisões da Fase 0](decisoes/0000-decisoes-fase-0.md)

## Contrato entre as partes
`etl/` e `web/` só se falam por `data/public/` (JSON validado por JSON Schema). O `zod` do front e o schema não podem divergir (teste de equivalência, Fase 2/4).

## Estado atual (Fase 1)
- `etl/`: CLI `painel-etl` com `probe` funcional; `run`, `backfill`, `validate`, `report` e `seed-import` respondem "não implementado" (código de saída 3). Os pacotes `core/`, `sources/`, `datasets/`, `normalize/` estão vazios por enquanto.
- `web/`: casca com capa, rodapé obrigatório, formatação pt-BR e tokens de cor; sem dados ainda.
- CI: lint, tipos, testes e build do ETL e do web, e2e no build estático, e trava contra alteração de `seed/`.

Documentos de operação (`operacao.md`) e de escalabilidade (`adicionar-dataset.md`) entram nas Fases 6 e 7.
