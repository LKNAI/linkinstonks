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
- [ADR 0003: histórico de escrituradores](decisoes/0003-historico-de-escrituradores.md)

## Contrato entre as partes
`etl/` e `web/` só se falam por `data/public/` (JSON validado por JSON Schema). O `zod` do front e o schema não podem divergir (teste de equivalência, Fase 2/4).

## Estado atual (Fase 3)
- `etl/`: CLI `painel-etl` completa (`run`, `backfill`, `probe`, `validate`, `report`, `seed-import`). `core/` (http com retry e disjuntor, io atômico, qualidade, diff, schema, estado), `sources/` (B3 Listadas, FCA, CAD, COTAHIST, finservices, Bradesco), `datasets/` (`acoes`, `bdrs`, histórico de escrituradores) e `normalize/` (CNPJ, tickers, instituições). Testes unitários, de integração com `respx` e golden contra o seed.
- `data/`: `public/` (contrato), `history/fca` e `history/bdr_volume` (partições), `state/`, `events/`.
- Pendente nas fases seguintes: workflows agendados e `vercel.json` (Fase 6), rodízio de `GetDetail` em produção, feed Atom (Fase 5).
- `web/`: casca com capa, rodapé obrigatório, formatação pt-BR e tokens de cor; sem dados ainda.
- CI: lint, tipos, testes e build do ETL e do web, e2e no build estático, e trava contra alteração de `seed/`.

Documentos de operação (`operacao.md`) e de escalabilidade (`adicionar-dataset.md`) entram nas Fases 6 e 7.
