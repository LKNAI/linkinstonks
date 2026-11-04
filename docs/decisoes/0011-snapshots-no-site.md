# ADR 0011: posição de meses passados e retenção de snapshots

**Status:** aceita (Fase 8, item 8.6, 2026-11-03)

## Contexto
O item 8.6 pede ver as telas como estavam em um mês passado. Só existe um snapshot real, 2026-09, e ele não é a foto do fim do mês: foi gravado em 29/10/2026 (`docs/fase8-etapa0.md`). O de 2026-10 sai na rotina de 05/11/2026.

## Decisão
- **Pasta:** `data/snapshots_site/AAAA-MM/{acoes,bdrs}.json`, em colunas + linhas, sem repetir os nomes dos campos: foi o que coube no orçamento (831 KB no formato comum, em 2026-09). A build copia para `/data/snapshots/` e gera `index.json`.
- **Retenção e orçamento:** últimos 36 meses e até 600 KB por mês, em `config/indicadores.yaml`. A build falha acima disso. Os mais antigos ficam no repositório, fora da build.
- **Mês real:** o que tem `data/history/snapshots/AAAA-MM/`. A tela diz "posição coletada em dd/mm/aaaa", com a data real de `datas_coleta.json`, em vez de "posição de 31/10/2026", que seria incorreta.
- **Ações reconstituídas:** escriturador vigente no último dia do mês, pelo histórico da CVM. Cada arquivo traz `reconstituido: true`, e a tela mostra "[reconstituída]".
- **BDRs reconstituídos:** volume das partições do COTAHIST, com depositária e tipo do primeiro snapshot. A série começa onde as partições começam.
- **Seção "Negociação" de `/acoes` e "Padrão de negociação" de `/bdrs`:** não aparecem no mês passado. Liquidez, negócios por mês e faixas de ticket não entram no snapshot, e os filtros que dependem deles são ignorados.
- **Janela de BDRs:** até 24 meses, limitada pelas partições, que começam em out/2024. As telas dizem quantos meses mostram, e a comparação 12 × 12 só aparece com 24 meses.

## Limitações
- A reconstituição de ações só tem companhias do cadastro atual com escriturador no FCA. Quem saiu da bolsa não aparece, e as 138 companhias sem histórico na CVM também não. Por isso "+N companhias desde então" mede a diferença entre os dois conjuntos, não o número de novas listagens da época.
- Setor, segmento, nome e tickers de um mês reconstituído são os de hoje.
- Em um mês real, a classe do ticker e `inicio_aproximado` vêm do cadastro atual, porque não estão no CSV guardado.

## Consequências
O repositório cresce até 600 KB por mês, mais a carga inicial dos 35 meses gerados agora. Os snapshots carregam só o que as telas mostram e não são anunciados como arquivos para baixar. Os Termos da B3 estão no [ADR 0009](0009-termos-de-uso-da-b3.md).
