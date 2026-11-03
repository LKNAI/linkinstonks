# Metodologia dos indicadores

Definição, fórmula, parâmetros e limitações de cada indicador da Fase 8. Os parâmetros ficam em [`config/indicadores.yaml`](../config/indicadores.yaml). O texto descreve o dado e não julga a ação nem o BDR. Não é recomendação de investimento.

## Fontes

| dado | fonte | observação |
|---|---|---|
| negociação | B3, COTAHIST (`TPMERC` 010 vista e 020 fracionário) | um registro por pregão, ticker e mercado |
| listagem e segmento | CVM, FCA, arquivo de valores mobiliários | uma referência por ano, a partir de 2018 |

## Liquidez das ações

**Quais registros entram.** Mercado à vista e fracionário de ações e units, identificados pela espécie do papel (`ON`, `PN`, `PNA`, `PNB`, `PNC`, `PND`, `UNT`). Ficam de fora opções, termo, FIIs, ETFs, BDRs, bônus de subscrição, direitos e recibos. O código `CODBDI` não é usado como filtro: ele deixaria de fora ações de empresas em recuperação judicial e incluiria o `IBOV11`.

**Por ticker e por mês:**

| métrica | fórmula |
|---|---|
| `volume` | soma de `VOLTOT` ÷ 100, em R$ |
| `volume_fracionario` | parte do volume com `TPMERC` 020 |
| `negocios` | soma de `TOTNEG` (ver limitação abaixo) |
| `quantidade` | soma de `QUATOT` |
| `ticket_medio` | `volume` ÷ `negocios`; vazio em mês sem negócios |
| `dias_com_negocio` | datas distintas com negócio, no lote padrão ou no fracionário |
| `pregoes_mes` | datas distintas do arquivo do mês, considerando todo o mercado |
| `presenca` | `dias_com_negocio` ÷ `pregoes_mes` |
| `volume_medio_diario` | `volume` ÷ `pregoes_mes` |

**Por companhia e por mês:** soma os tickers da companhia. Os dias com negócio e a presença são os do ticker mais negociado naquele mês.

**Janelas de 3, 6 e 12 meses:** somas no período. A presença da janela é o total de dias com negócio dividido pelo total de pregões, e não a média das presenças mensais.

**Tickers antigos.** Quando uma companhia troca de código, a série continua: o FCA liga o código antigo ao CNPJ da companhia. Códigos que o FCA não resolve podem ser incluídos à mão em `config/overrides/tickers_historicos.csv`, sempre com fonte. O que não se resolve fica em `nao_atribuido` e não entra em nenhuma companhia.

### Limitações

- **Número de negócios.** `TOTNEG` tem 5 dígitos no layout da B3 e parece perder o que passa de 99.999. Em 11/02/2026 a PETR4 aparece com 39 negócios e R$ 2,13 bi. Isso é uma inferência a partir dos dados, sem confirmação da B3. Por isso:
  - os números são publicados como vieram, sem correção;
  - o mês com pregão suspeito leva um aviso de que negócios podem estar subestimados e o ticket médio, superestimado;
  - volume, quantidade e presença não são afetados.
- **Como o pregão suspeito é identificado.** `esperado = QUATOT ÷ tamanho típico do negócio`, em que o tamanho típico é a mediana de `QUATOT ÷ TOTNEG` nos demais pregões do mês. O pregão é suspeito quando `esperado` está mais perto de `TOTNEG + 100.000` do que de `TOTNEG`, desde que `esperado` chegue a 60.000 e o papel tenha mediana de ao menos 10.000 negócios por pregão no mês, com pelo menos 5 pregões. Negócios em bloco também podem acionar o aviso. Só existe para meses fechados.
- **Fracionário na presença.** Um dia só com negócio no fracionário conta como dia com negócio. Em out/2026, isso ocorreu em 8,7% das combinações de ticker e dia.
- **Listagem recente na janela.** Uma companhia listada há 4 meses é medida contra os 6 meses inteiros, e sua presença fica menor do que a do período em que já estava listada.
- **Sem registro significa sem negócio.** O COTAHIST não traz linha para o papel que não negociou.

## Categorias de negociação

Aplicadas à companhia, nesta ordem de precedência:

| categoria | regra | exemplo de critério |
|---|---|---|
| `sem_ticker` | a B3 não informa código de negociação | "A B3 não informa código de negociação." |
| `listagem_recente` | listada há menos de 3 meses | "Listada em 15/09/2026, há menos de 3 meses." |
| `sem_cotacao_no_periodo` | nenhum registro nos últimos 24 meses | "Sem registro no COTAHIST nos últimos 24 meses." |
| `sem_negocios` | tem registro em 24 meses, nenhum nos 3 últimos meses fechados | "Nenhum negócio nos últimos 3 meses fechados; último pregão em 20/08/2025." |
| `presenca_baixa` | presença abaixo de 25% em 6 meses | "Negociou em 21 de 127 pregões nos últimos 6 meses." |
| `presenca_media` | de 25% a 75% | |
| `presenca_alta` | acima de 75% | |

**Data de listagem.** Vem do FCA. Na falta dela, usa a data da lista da B3, marcada como incerta porque o significado desse campo não está documentado. A data 20/07/1977, repetida em 27 tickers, também é marcada como incerta, por parecer um valor padrão.

**Eventos em `/novidades`:** `entrou_sem_negocios`, `saiu_sem_negocios`, `entrou_presenca_baixa` e `saiu_presenca_baixa`. A primeira classificação de uma companhia não gera evento.

## Faixas de ticket médio dos BDRs (estimativa)

> Estimativa baseada no tamanho médio dos negócios; não identifica investidores.

BDRs não têm mercado fracionário: não há nenhum registro em 25 meses ([ADR 0005](decisoes/0005-bdr-sem-fracionario.md)). O indicador usa só o ticket médio e não afirma nada sobre quem negocia.

1. A cada mês, entram no cálculo os BDRs com ao menos 30 negócios.
2. Calculam-se o 1º e o 3º quartis do ticket médio entre eles (`ticket_quartis`).
3. Cada BDR recebe uma faixa:

| faixa | regra |
|---|---|
| `ticket_baixo` | ticket médio até o 1º quartil |
| `intermediario` | acima do 1º e até o 3º quartil |
| `ticket_alto` | acima do 3º quartil |
| `dados_insuficientes` | menos de 30 negócios no mês |

O resumo em `bdrs.json` traz a faixa do último mês fechado e o ticket médio dos últimos 12 meses.

**Limitações.** O ticket médio depende do preço do BDR, e o número de negócios tem a limitação descrita acima, que hoje aparece em 6 BDRs. Uma faixa descreve a posição do BDR em relação aos demais naquele mês, e não uma característica fixa.

## Mapa de calor

- **Intensidade relativa:** volume do mês ÷ maior volume mensal do próprio BDR em 24 meses, em 7 tons. Mês sem negócio tem marca própria, diferente do tom mais claro.
- **Variação contra a média:** volume do mês ÷ média dos 12 meses anteriores, em escala logarítmica de ×0,25 a ×4, com ×1 no centro. Só existe nos 12 meses mais recentes, os que têm 12 meses de referência nos dados publicados.
- **Tendência:** média dos últimos 6 meses ÷ média dos 6 anteriores.

## Listagem e segmento segundo a CVM

- **Regra de versão:** só a maior `Versao` de cada `Data_Referencia`.
- **Linha do tempo de segmento:** começa na referência de 2018 e usa só linhas ativas, em bolsa e com ticker. A data é a da primeira referência em que o segmento aparece e, por isso, sempre traz `data_aproximada: true`: pode estar até um ano atrasada. O primeiro trecho marca o início da série, não a entrada da companhia no segmento.
- **Antes de 2018 não se usa.** De 2010 a 2017 o arquivo não tem ticker, nem os valores "Básico" e "Novo Mercado", e concorda com a B3 em no máximo 2,6% dos casos. Os pares de 2017 para 2018 sugerem rótulos deslocados: é uma hipótese, e nada é corrigido.
- **Divergência entre B3 e CVM.** Vira só um selo informativo. Nenhuma fonte corrige a outra. Segmentos sem equivalente nas duas fontes não são comparados.

## Mudanças de contrato

- [ADR 0008](decisoes/0008-schema-version-major-minor.md): `schema_version` em `MAJOR.MINOR`.
- `acoes_liquidez` substitui as partições de `acoes_volume`, que seguem no repositório sem atualização.
- `acoes_liquidez_resumo.json` substitui `acoes_volume.json` nas telas de lista; `acoes_liquidez.json` traz as séries mensais completas.
