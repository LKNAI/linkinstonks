# ADR 0005: BDRs não têm mercado fracionário

**Status:** aceita (Etapa 8.0, 2026-11-03).

## Contexto
A Fase 8 (item 8.3) previa participação do fracionário no volume e nos negócios de cada BDR, e guardar vista e fracionário em separado nas partições. A própria especificação condicionou isso à Etapa 8.0: sem mercado fracionário relevante, o indicador é descartado.

## O que os dados mostram
Varredura dos 25 arquivos `COTAHIST_M` de 2024-10 a 2026-10, com o filtro de BDR em uso (`^[A-Z0-9]{4}3[1-59]F?$`, `TPMERC` 010/020):

| medida | vista (010) | fracionário (020) |
|---|---|---|
| registros | 268.966 | 0 |
| volume | R$ 585,6 bi | R$ 0 |
| negócios | 105,1 mi | 0 |

- Nenhum ticker com sufixo `F` entre os 1.152 BDRs. `CODBDI` encontrados: 34, 35 e 36, nunca 96.
- Conferência independente do regex, em out/2026: `TPMERC` 020 com `ESPECI` iniciando em `DR` = 0 registros; `TPMERC` 010 com `ESPECI` iniciando em `DR` = 12.492.
- **Lote padrão:** o COTAHIST não tem campo de lote. O máximo divisor comum de `QUATOT` dos registros à vista dá 1 em 1.136 dos 1.152 BDRs; os 16 restantes têm poucos negócios. Nas ações, o mesmo cálculo dá 100 em 422 de 431 tickers. A conclusão de lote unitário é uma inferência a partir dos dados, não uma informação lida de um cadastro da B3.

## Decisão
1. `participacao_fracionario_volume` e `participacao_fracionario_negocios` **não existem** para BDRs.
2. `ticket_medio_lote_padrao` é descartado: com um único mercado, seria igual a `ticket_medio`.
3. A migração das partições de `data/history/bdr_volume/` para separar vista e fracionário **não será feita**. Não há o que separar, e `data/history/` não é reescrito sem necessidade.
4. Em `/bdrs`, a dispersão ticket × fracionário dá lugar ao histograma de ticket médio, como a especificação já previa.
5. **Decisão do dono (2026-11-03):** o perfil mostra só as faixas "ticket baixo", "intermediário", "ticket alto" e "dados insuficientes". Os rótulos de predominância de pessoas físicas ou institucional não existem.

## Consequências
- O parser mantém o `F?` no regex: não custa nada e detecta o surgimento de um fracionário de BDR. A rotina mensal deve **avisar** se aparecer algum registro.
- A documentação (`docs/fontes.md`, "somar o ticker com `F`") descreve um caso que hoje não ocorre em BDRs. O texto continua correto, pois a soma é de zero.
