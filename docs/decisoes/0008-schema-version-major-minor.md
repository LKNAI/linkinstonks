# ADR 0008: `schema_version` em `MAJOR.MINOR`

**Status:** aceita (dono, 2026-11-03)

## Contexto
A Fase 8 pede subir o minor do `schema_version` a cada campo novo e o major a cada mudança incompatível. Até aqui o campo era o inteiro `1`, com `const` no JSON Schema e `z.literal(1)` no zod, o que não permite minor e faria qualquer aumento derrubar o site.

## Decisão
- `schema_version` passa a ser texto `MAJOR.MINOR`. Cada schema aceita o padrão `^1\.[0-9]+$`, e o zod também. Campo novo sobe só o minor sem quebrar o site; subir o major falha de propósito até o site ser adaptado.
- Os arquivos que já existiam passam a `"1.1"`; os criados na Fase 8 (`acoes_liquidez`, `acoes_historico_segmentos`) começam em `"1.0"`.
- As partições antigas de `data/history/bdr_volume/` continuam com o inteiro `1`, porque não são contrato público e `data/history/` não é reescrito sem necessidade. As novas de `data/history/acoes_liquidez/` usam `"1.0"`.
- `atualizar_meta` regrava a versão, de modo que um `meta.json` antigo é migrado na primeira execução.

## Teste de contrato
`etl/tests/unit/test_contrato_schemas.py` compara os campos de todos os schemas com a linha de base `etl/tests/contratos/campos_v1.json`. Campo novo passa. Campo removido faz o teste falhar até o major subir. Para regravar a linha de base, depois de subir o major:

```bash
cd etl && uv run python -m tests.unit.test_contrato_schemas
```

## Consequências
A troca de inteiro para texto é, em si, uma mudança incompatível, aceita sem subir o major porque não há consumidor externo: a API pública saiu do escopo ([ADR 0007](0007-api-publica-fora-do-escopo.md)) e o site é publicado junto com os dados.
