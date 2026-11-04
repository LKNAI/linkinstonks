# Fase 8, Onda B: proposta de design

Aprovada pelo dono em 2026-11-03 e implementada, com três decisões: só o histograma, sem donut de faixas (decisão 1); variação em 12 colunas (decisão 2); arquivo resumido para as telas de lista, que substitui `acoes_volume.json` (decisão 3). A direção "Livro-razão" (`docs/design-system.md`) continua: mesma paleta-base, mesma tipografia, sem tema escuro.

Maquetes com dados reais, descartáveis: [1440 px](capturas/fase8-onda-b/maquete-1440.png) e [390 px](capturas/fase8-onda-b/maquete-390.png). A fonte da maquete não é a do site.

## O que os dados mostram

| achado | efeito no desenho |
|---|---|
| O ticket médio dos BDRs vai de R$ 36 a R$ 567 mil, e o p90 é 39 vezes o p10 | histograma em escala logarítmica |
| Por construção, as faixas de ticket dão 25%, 50% e 25% dos BDRs elegíveis | um donut de faixas não informa nada (decisão 1) |
| A variação contra a média só existe nos 12 meses mais recentes | o modo variação mostra só 12 colunas (decisão 2) |
| Presença média em 6 meses: Nível 1 99%, Nível 2 100%, Novo Mercado 99%, Tradicional 79% | barras de média ficariam iguais: mostrar a composição por categoria |
| Os 50 maiores BDRs somam 92% do volume; o top 25, 85% | o padrão de 50 linhas conta quase toda a história |
| `acoes_liquidez.json` tem 530 KB em gzip | não pode ser baixado em `/acoes` (decisão 3) |

## Princípios

1. **Um só ponto memorável: o mapa de calor como livro-razão.** Cada BDR é uma linha de um extrato, com o ticker à esquerda, o total à direita e um fio separando os anos. Todo o resto usa componentes que já existem.
2. **Somar, não empilhar.** `/acoes` já tem 3 donuts e cerca de 4.900 px. A liquidez entra na seção "Volume negociado", sem criar um segundo ranking nem outra fileira de KPIs.
3. **O critério é o dado.** A frase "Negociou em 21 de 127 pregões" aparece antes do rótulo da categoria. Sem vermelho, verde ou ícone de alerta para pouca negociação.
4. **Incerteza à vista, sem alarme.** Número suspeito leva "≈" e nota com link; data aproximada leva "aprox."; estimativa diz que é estimativa.
5. **Toda cor tem uma alternativa.** Tooltip, teclado, "ver como tabela" e, nas células vazias, um símbolo além da cor.

## Tokens novos

Sem mudança de tipografia, espaçamento, raio ou destaque.

| token | valor | uso |
|---|---|---|
| `--seq-1` a `--seq-7` | `#f3e6f4` `#dfc1e2` `#c79acb` `#ab6eb1` `#8c4592` `#6d1d72` `#4a1050` | intensidade, um só matiz (ameixa) |
| `--div-frio-3` a `-1` | `#0b5563` `#3f8f9b` `#7fc8d4` | abaixo da média |
| `--div-neutro` | `#e9edf4` | perto de ×1 |
| `--div-quente-1` a `-3` | `#f2ac76` `#c46c30` `#8f3e0c` | acima da média |
| `--celula-vazia` | superfície, borda fina e ponto | sem negócios (forma, não só cor) |

**Por que não vermelho e verde:** subir ou cair de volume não é bom nem ruim, e essas cores são reservadas a status. Azul-petróleo e terracota são quente e frio sem julgamento.

**Categorias:** reaproveitam a rampa `--cat-1..3` para presença alta, média e baixa e para ticket alto, intermediário e baixo. `--cat-alt-*` fica para sem negócios, sem cotação e listagem recente; `--cat-none`, para dados insuficientes.

**Validação (`dataviz`):**
- **Rampa:** monótona, com passos visíveis e matiz único. O passo mais claro fica abaixo de 2:1 de propósito, permitido em escala sequencial e compensado por tooltip e tabela.
- **Divergente:** nos pares de cores, separação para daltonismo de ΔE 11,8 (alvo ≥ 8) e visão normal de ΔE 15,7 (piso 15). Essa é a parte da ferramenta que se aplica: ela é feita para paletas categóricas, e as regras de luminosidade e saturação reprovam os tons mais claros e mais escuros que uma escala divergente precisa ter. Os tons abaixo de 3:1 contam com tooltip e tabela.

## Telas

Os valores nos esboços são ilustrativos; os números reais estão nas maquetes.

### `/bdrs/mapa` (nova, com prévia de 25 linhas em `/bdrs`)

```
Mapa de calor do volume
Filtros: [Tipo] [Depositária] [Categoria] [Faixa de ticket]              linhas: 25 [50] 100 todos
Cor: (•) Intensidade relativa  ( ) Variação contra a média     Ordem: [Volume total v]
Legenda: menor ▒▒▒▒▒▒▒ pico do próprio BDR    · sem negócios                  [Ver como tabela]

                 |2024     |2025                            |2026                 Volume
                 |nov dez  |jan fev mar ... nov dez         |jan ... set out         24m
TSLA34 Tesla     |▓▓▓ ███  |███ ▓▓▓ ▒▒▒ ... ███ ███         |▓▓▓ ... ▓▓▓ ▓▓▓    R$ 54,7 bi
JBSS32 Jbs N.V.  | ·   ·   | ·   ·   ·  ... ▓▓▓ ▒▒▒         |▒▒▒ ... ▓▓▓ ▓▓▓    R$ 44,2 bi
```

- **Interação:** tooltip com ticker, nome, mês, volume, negócios e valor da escala. Setas navegam entre células. Clicar no ticker abre o BDR em nova aba, como os demais registros. Clicar num mês define o mês do ranking em `/bdrs`.
- **Ordem:** volume total, tendência (6 meses ÷ 6 anteriores), alfabética ou mês do pico.
- **Desempenho:** um único SVG, com um `<path>` por cor em vez de 2.400 elementos; alvo de menos de 100 ms para 100 × 24. "Todos" (1.151 linhas) usa virtualização.
- **Acessibilidade:** a grade é um único elemento focável; as setas movem um contorno e uma região `aria-live` lê a célula.

Celular (390 px): 12 meses por padrão, opção de 24, primeira coluna fixa só com o ticker, rolagem dentro do bloco. Filtros no sheet que já existe.

```
Mapa de calor do volume
[Filtros (2)]  [Intensidade v]
menor ▒▒▒▒▒ pico   · sem negócios
        |2025   |2026
        |nov dez|jan fev mar →
TSLA34  |▓▓▓ ███|▓▓▓ ▒▒▒ ▓▓▓ →
```

### `/bdrs`: ticket médio

```
+--------------------------------------------+ +---------------------------+
| Ticket médio em out/26          [como tabela]| | Prévia do mapa (25 linhas)|
| Estimativa baseada no tamanho médio dos    | | Abrir o mapa completo     |
| negócios; não identifica investidores.     | |                           |
| Metodologia                                | |                           |
|     1º quartil      3º quartil             | |                           |
|        |   ▄██▄       |                    | |                           |
|     ▂▄▆|████████▆▄▂   |                    | |                           |
|  R$ 100    R$ 1 mil   R$ 10 mil  R$ 100 mil| |                           |
| 574 BDRs no cálculo; 577 com menos de 30   | |                           |
+--------------------------------------------+ +---------------------------+
```

Em `/bdrs/[ticker]`: colunas de ticket médio por mês, um eixo só, faixa atual e o mesmo aviso. Meses suspeitos em tom mais claro, com "≈" no tooltip e na tabela.

### `/acoes`: seção "Negociação" (substitui "Volume negociado")

```
Negociação                                     KPIs sem cartão, como no resto do painel
R$ 886 bi em out/26  | ▲ 83% contra set/26 | 284 alta · 17 média · 7 baixa · 5 sem negócios

+-- Volume mensal (já existe) ---------------+ +-- Presença em 6 meses --------+
|                                            | | Donut das 344 companhias com  |
|                                            | | ticker; 223 sem código à parte|
+--------------------------------------------+ +-------------------------------+
+-- Ranking por volume (já existe) ----------+ +-- Presença por segmento ------+
|                                            | | Novo Mercado  ██████████████  |
|                                            | | Tradicional   ██████▒▒▒░░     |
+--------------------------------------------+ +-------------------------------+
```

Clicar numa categoria ou segmento filtra o painel inteiro, como já ocorre com os outros gráficos. A tabela de `/acoes` ganha colunas opcionais: volume 12m, presença 6m, categoria e listada desde.

### `/acoes/liquidez` (nova)

```
Liquidez das ações
Filtros: [Categoria] [Segmento] [Setor] [Escriturador]                  [Exportar CSV]
Empresa     Ticker Categoria     Critério                       Vol.3m Vol.6m Vol.12m Pres.3m Pres.6m Pres.12m Ticket Último pregão
BANPARA     BPAR3  Presença baixa Negociou em 21 de 127 pregões  ...
PETROBRAS   PETR4  Presença alta  Negociou em 127 de 127 pregões ...    ≈ R$ 36 mil
```

Celular: primeira coluna fixa e rolagem no bloco, como nas outras tabelas.

### `/acoes/[codigoCvm]`

```
Volume mensal (24 meses)                            [Ver como tabela]
████ colunas, a mesma escala de hoje
Presença mensal                                     painel separado, mesmo eixo de meses
▁▂▃ colunas de 0 a 100%; nunca eixo duplo

Listagem                                            Listada desde 20/07/1977 (data incerta)
2026  Novo Mercado (aprox.)                         CVM
2021  Escriturador: Itaú Corretora                  CVM
2019  Nível 1 (aprox.)                              CVM
```

A linha do tempo junta segmentos e escrituradores em ordem cronológica, cada item com sua fonte.

### Selo de número suspeito e `/sobre`

- **Selo:** "≈" antes do ticket ou dos negócios, com tooltip: "Os negócios podem estar subestimados e o ticket, superestimado: o campo da B3 tem 5 dígitos. Metodologia." Acima das tabelas, uma nota uma só vez. Sem cor de alerta.
- **`/sobre`:** nova seção "Metodologia" com o conteúdo de `docs/metodologia.md` e âncoras para cada link. Um teste confere que os títulos não divergem.
- **`/design`:** recebe mapa de calor, histograma, selo e linha do tempo, com todos os estados.

## Autocrítica

Comparei com o que eu faria num "dashboard qualquer":

| padrão | o que mudei |
|---|---|
| Nova seção com KPIs, donut e top 15, como pede o item | juntei à seção de volume: já existe ranking de 15 e seria um segundo gráfico igual |
| Donut de faixas de ticket | proponho tirá-lo (decisão 1): mostraria sempre 25%, 50% e 25% |
| Barras de presença média por segmento | composição por categoria: a média é quase igual em tudo, menos no Tradicional |
| Selo colorido de alerta em papel com pouca negociação | texto do critério, sem cor de status: linguagem factual |
| Vermelho e verde na variação | azul-petróleo e terracota |
| Mapa de calor com 24 colunas nos dois modos | 12 colunas na variação, para não hachurar metade da tela |
| Célula "sem negócios" só com cor clara | ponto e borda: não se confunde com o tom mais claro |

**Riscos:**
- O top 50 em 1440 px dá cerca de 1.000 px de altura; o cabeçalho de meses precisa ficar fixo.
- Terracota lembra de longe a cor do Itaú, mas nunca aparece junto das cores de marca no mapa.
- `/bdrs` já está pesada: `bdrs.json` tem 193 KB em gzip. A prévia reutiliza o que já é baixado, mas o desempenho do Lighthouse precisa ser medido de novo.
