# ADR 0010: busca global sem biblioteca

**Status:** aceita (Fase 8, item 8.8, 2026-11-03)

## Contexto
A especificação aceita implementação própria ou biblioteca de até 10 KB em gzip. `/acoes` está perto do limite de 200 KB de JS. O índice tem cerca de 1.700 itens.

## Decisão
Implementação própria em `web/lib/busca.ts`, com níveis fixos: código exato, prefixo de código, início de palavra do nome, trecho do nome e aproximação por distância de edição. A ordem dos níveis é a pedida na especificação, o que uma biblioteca de pontuação genérica não garante sem ajustes. A distância só é calculada para consultas com 4 caracteres ou mais, com limite de 1 ou 2 edições.

O índice sai de `web/scripts/gen-busca.mjs`, na build, e a build falha acima de 150 KB em gzip. O diálogo e o índice só são baixados na primeira abertura.

## Consequências
Não há dependência nova. A busca não tem radicalização nem sinônimos além dos `aliases` de `config/instituicoes.yaml`.
