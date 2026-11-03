# Fase 8, Etapa 0: verificação prévia

Executada em 2026-11-03. Sem código de produto. Base: 25 arquivos `COTAHIST_M` (2024-10 a 2026-10), os 17 ZIPs do FCA (2010 a 2026), `data/public/` do commit `e34037d` e o layout oficial `SeriesHistoricas_Layout.pdf`.

Fixtures novas, com dados reais (`etl/tests/fixtures/`):
- `b3_cotahist/COTAHIST_M102026_etapa80_extrato.txt`: 73 registros de out/2026, um de cada combinação `CODBDI`/`TPMERC`/espécie, mais PETR3, PETR4, PETR4F, NVDC34 e tickers de pouca negociação.
- `cvm_fca/fca_cia_aberta_valor_mobiliario_2026_extrato.csv`: 20 linhas de 7 companhias (duas linhas por ticker, debênture, unit, segmento vazio).
- `cvm_fca/fca_cia_aberta_valor_mobiliario_serie_extrato.csv`: Banco do Brasil e Energisa de 2010 a 2026 (mostra a quebra de 2017 para 2018).

## Resultado em uma tabela

| item | situação | efeito |
|---|---|---|
| 1. Ações no COTAHIST | ⚠️ `TPMERC` confirmado; `CODBDI` não serve de filtro | filtrar por `TPMERC` + cadastro + espécie |
| 2. BDRs no fracionário | ❌ não existe | indicador descartado ([ADR 0005](decisoes/0005-bdr-sem-fracionario.md)) |
| 3. Pregões por mês | ✅ confirmado | definição aprovada; há um defeito no campo `pregoes` atual |
| 4. FCA, valores mobiliários | ⚠️ campos confirmados; segmento antes de 2018 não é confiável | linha do tempo começa em 2018 |
| 5. Empréstimo de ativos | ❌ termos vedam a coleta automatizada | 8.11 parado ([ADR 0006](decisoes/0006-emprestimo-de-ativos-nao-seguir.md)) |
| 6. Snapshots | ⚠️ só 1, e não é a posição do fim do mês | rótulo de data em 8.6 precisa mudar |
| extra | ❗ `TOTNEG` parece estourar em 99.999 | afeta `negocios` e `ticket_medio` |

## 1. Ações no COTAHIST

**Confirmado no layout oficial:** `CODBDI` 02 = lote padrão, 96 = mercado fracionário; `TPMERC` 010 = vista, 020 = fracionário. Todo registro com sufixo `F` está em 96/020.

```
012026100102ALUP11      010ALUPAR      UNT     N2   ...   (lote padrão, unit)
```

**Difere do esperado: `CODBDI` 02 e 96 não bastam nem como filtro nem como garantia.**

| combinação de `CODBDI` em 010/020 | tickers |
|---|---|
| 02 e 96 | 374 |
| 22 e 96 (bônus privados) | 15 |
| 08 e 96 (recuperação judicial) | 13 |
| 02, 07 e 96 (recuperação extrajudicial) | 12 |
| só 96 | 11 |
| 02, 08 e 96 | 9 |
| só 02 | 4 |
| 07 e 96 | 2 |
| 10 e 96 (direitos e recibos) | 2 |
| 14 e 96 | 1 |

- Dos 506 tickers de `acoes.json`, **443 aparecem** e todos têm ao menos um registro 02/010 ou 96/020.
- Filtrar por `CODBDI` perderia ações reais em recuperação: R$ 14,6 bi em `CODBDI` 08 e R$ 6,4 bi em 07, em 25 meses.
- `CODBDI` 02 também contém o que não é ação: **`IBOV11`** (espécie `IBO`), com R$ 52,3 bi em out/2026.
- **O cadastro tem instrumentos que não são ações.** Por espécie, nos registros dos tickers do cadastro: ON 259.946, PN 62.133, PNA 11.519, UNT 9.625, PNB 5.423, **BNS 3.951**, PNC 505, **TPR 289**, **DIR 58**.

**Proposta:** filtro de 8.1 = `TPMERC` 010/020 + ticker do cadastro + espécie em lista permitida (`ON`, `PN`, `PNA`, `PNB`, `PNC`, `PND`, `UNT`), em `config/indicadores.yaml`.

### Tickers que nunca aparecem em 24 meses (2024-11 a 2026-10): 63

**Códigos com final 11, 12, 15, 98 ou 99 (15):** AXIA98, AXIA99, BBAS11, BBAS12, CPLE99, CYRE99, ENGI12, GFSA15, TOKY12, RENT99, AUAU99, LUPA12, VAMO99, VIVR11, RBNS11.

**Demais (48):** QVQP3, AESO3, APTI3, BBML3, BETP3, BOBR3, BRQB3, CEEB6, COCE6, COMR3, CRTE3, CRTE5, CTCA3, DTCY4, EQMA5B, EQMA6B, BAUH3, VSPT3, VSPT4, OPGM3, SALT3, SALT5, SALT6, HBTS3, HBTS6, HMOB3, IGSN3, INNC3, CATA3, CATA4, IVPR3B, IVPR4B, KLAS3, LLBI3, LMED3, LTEL3B, LTLA3B, ODER3, PPAR3, PTCA3, PRMN3B, PRPT3, QUSW3, RSUL3, OPSE3, OPTS3, NEMO3, LUXM3.

### Universo de companhias (567)

| situação | companhias | categoria em 8.2 |
|---|---|---|
| sem nenhum ticker (212 são `BN`) | 223 | **nenhuma: falta categoria** |
| com ticker, sem registro em 24 meses | 30 | `sem_cotacao_no_periodo` |
| com registro em 24 meses, nenhum nos 3 últimos | 5 (Aliperti, Granja Faria, Minasmáquina, Rossi, Santanense) | `sem_negocios` |
| demais | 309 | categorias de presença ou `listagem_recente` |

### Reconciliação com o "total do mercado"

**O arquivo não traz um total:** o trailer `99` só conta registros. O total é uma soma nossa. Em out/2026, `TPMERC` 010 + 020:

| parte | R$ milhões |
|---|---|
| ações (cadastro, vista) | 882.293 |
| ações (cadastro, fracionário) | 3.341 |
| ações fora do cadastro | 4 |
| `CODBDI` 14 | 85.470 |
| `IBOV11` | 52.256 |
| BDRs | 47.350 |
| `CODBDI` 12 (FII) | 12.159 |
| demais | 299 |
| **total** | **1.083.172** |

Conferência com o publicado: `acoes_volume/2026-10` = R$ 885.636.681.638, contra R$ 885.638.069.122 nesta conta (diferença de R$ 1,39 mi, 0,0002%). `bdr_volume/2026-10` = R$ 47.349.728.650, contra R$ 47.349.728.647.

**Proposta de teste:** soma das partes = total, por construção, e diferença entre os dois filtros de ações ≤ 0,01%.

## 2. BDRs no fracionário

Zero registros em 25 meses. Detalhes e decisão no [ADR 0005](decisoes/0005-bdr-sem-fracionario.md).

## 3. Pregões por mês

Confirmado. Definição: **pregões do mês = datas distintas do arquivo `M` inteiro.**

- Um registro por data, ticker e mercado: **nenhuma duplicata** em 010/020 nos 25 arquivos.
- **Nenhum registro com `TOTNEG` = 0** nos 25 arquivos: sem negócio, não há registro. Isso significa que "ticker ausente" e "sem negócios" são o mesmo sinal (ver proposta em 8.2).
- Arquivo `D` e `M` são iguais: os 17.616 registros de `COTAHIST_D28102026` são idênticos, byte a byte, aos de 28/10 no `M102026`.
- Sem dia atípico: o menor dia tem mais de 8.000 registros em todos os meses.
- Em out/2026, 695 de 8.023 combinações de ticker e dia (8,7%) só tiveram negócio no fracionário. Pela regra de 8.1, contam como dia com negócio.

| mês | pregões | mês | pregões | mês | pregões |
|---|---|---|---|---|---|
| 2024-11 | 19 | 2025-07 | 23 | 2026-03 | 22 |
| 2024-12 | 19 | 2025-08 | 21 | 2026-04 | 20 |
| 2025-01 | 22 | 2025-09 | 22 | 2026-05 | 20 |
| 2025-02 | 20 | 2025-10 | 23 | 2026-06 | 21 |
| 2025-03 | 19 | 2025-11 | 19 | 2026-07 | 23 |
| 2025-04 | 20 | 2025-12 | 20 | 2026-08 | 21 |
| 2025-05 | 21 | 2026-01 | 21 | 2026-09 | 21 |
| 2025-06 | 20 | 2026-02 | 18 | 2026-10 | 21 |

**Defeito encontrado:** `processar_mensal` (`etl/src/painel_etl/sources/b3_cotahist.py:229`) monta `pregoes` só com o primeiro e o último pregão de cada ticker. `acoes_volume/2026-10.json` registra 20 pregões, e o arquivo tem 21. Sem efeito hoje no site, mas o campo não pode alimentar `pregoes_mes`. A correção entra na Onda A.

## 4. FCA, valores mobiliários

Cabeçalho real, **idêntico nos 17 anos**, `;`, ISO-8859-1:

```
CNPJ_Companhia;Data_Referencia;Versao;ID_Documento;Nome_Empresarial;Valor_Mobiliario;Sigla_Classe_Acao_Preferencial;Classe_Acao_Preferencial;Codigo_Negociacao;Composicao_BDR_Unit;Mercado;Sigla_Entidade_Administradora;Entidade_Administradora;Data_Inicio_Negociacao;Data_Fim_Negociacao;Segmento;Data_Inicio_Listagem;Data_Fim_Listagem
```

Os 13 campos esperados existem. Há 5 a mais: `ID_Documento`, `Nome_Empresarial`, `Sigla_Classe_Acao_Preferencial`, `Composicao_BDR_Unit`, `Sigla_Entidade_Administradora`.

Cobertura de 2026:
- 342 das 344 companhias com ticker têm documento; 418 dos 506 tickers casam por `Codigo_Negociacao`.
- 9 tickers têm mais de uma linha, em geral com `Data_Fim_Negociacao` na antiga: é preciso usar a linha sem data de fim.
- `Codigo_Negociacao` tem lixo (`00`, `0000`, `B1003`).
- 27 tickers têm `Data_Inicio_Listagem` = 1977-07-20, o que parece uma data padrão, não a listagem real. Não publicar como "listada desde" sem marcar.
- Segmento B3 × CVM: 317 iguais, 15 diferentes, 12 sem histórico. Os 15 viram selo informativo.

### Segmento antes da referência de 2018 não é utilizável

Há uma só referência por ano (`AAAA-01-01`). Portanto, toda data de mudança é aproximada em até um ano. O problema maior é a quebra de 2017 para 2018:

| referência | concordância com o segmento atual da B3 | ações/units na bolsa com ticker |
|---|---|---|
| 2010 a 2017 | 0,5% a 2,6% | 0 |
| 2018 | 76,2% | 392 de 456 |
| 2019 | 84,2% | 447 de 478 |
| 2026 | 95,7% | 464 de 484 |

- De 2010 a 2017 não existe nem "Básico" nem "Novo Mercado" no arquivo.
- Mudanças de segmento por ano: 1 a 8 de 2011 a 2017, **192 em 2018**, 27 em 2019, 2 a 10 depois.
- De 2017 para 2018, os pares repetem um padrão: Nível 1 → Novo Mercado (114), Nível 2 → Básico (101), Bovespa Mais → Nível 1 (27), Bovespa Mais N2 → Nível 2 (13). O padrão sugere rótulos deslocados antes de 2018. É uma hipótese, e não vamos corrigir por conta própria.

**Proposta:** linha do tempo de segmento só a partir da referência de 2018, que serve de ponto inicial e não gera evento. Sempre com `data_aproximada: true`. Sem isso, o site publicaria cerca de 190 mudanças de segmento falsas.

### Download
Só `fca_2026.zip` está no cache local, e `data/history/fca/` guarda apenas o escriturador. A carga de 2018 a 2025 exige **um único download** (8 ZIPs, cerca de 3,3 MB) para gravar uma partição própria. A rotina diária não baixa nada de novo. O FCA é publicado sob a licença ODbL, segundo a página do conjunto de dados na CVM.

## 5. Empréstimo de ativos

**Não seguir.** Os termos das páginas de acesso vedam a coleta automatizada. Avaliação completa no [ADR 0006](decisoes/0006-emprestimo-de-ativos-nao-seguir.md).

## 6. Snapshots

| mês | arquivo | compactado | descompactado | linhas |
|---|---|---|---|---|
| 2026-09 | `acoes.csv.gz` | 25.762 B | 83.562 B | 569 |
| 2026-09 | `bdrs.csv.gz` | 75.087 B | 228.064 B | 1.153 |

Pontos para 8.6:
- **É o único.** O de 2026-10 sai com o workflow de 05/11/2026. O mês de 2026-09 não tem `acoes_volume.csv.gz`, que o código atual já grava.
- **Não é a foto do fim do mês.** Foi gravado em 29/10/2026 (commit `04a83bc`), e 601 BDRs têm `ultimo_pregao` = 2026-10-28. Pela regra atual, o snapshot de um mês é a posição do dia em que a rotina roda (dia 5 do mês seguinte). A faixa "posição de 31/10/2026" seria incorreta.
- **Proposta:** gravar a data real de coleta no snapshot e exibir "posição coletada em dd/mm/aaaa".

## Achado extra: `TOTNEG` parece estourar em 5 dígitos

O campo tem formato `N(05)` no layout oficial, ou seja, no máximo 99.999. O maior valor nos 25 meses é 99.965. Há dias em que o número de negócios é incompatível com o financeiro:

| data | ticker | `TOTNEG` | volume | ticket resultante |
|---|---|---|---|---|
| 11/02/2026 | PETR4 | 39 | R$ 2,13 bi | R$ 54,6 mi |
| 26/10/2026 | VALE3 | 491 | R$ 6,02 bi | R$ 12,3 mi |
| 29/11/2024 | HAPV3 | 736 | R$ 533 mi | R$ 724 mil |
| 14/11/2024 | BBAS3 | 1.477 | R$ 2,04 bi | R$ 1,4 mi |

A leitura mais provável é que o valor real passou de 100 mil e só os 5 últimos dígitos foram gravados. **É uma inferência:** não há documento da B3 que confirme.

Medição com heurística (compara `QUATOT` ÷ tamanho típico do negócio nos 10 pregões vizinhos com `TOTNEG` e `TOTNEG` + 100 mil): **até 329 combinações de ticker e dia, em 69 códigos**. É um teto: o método também acusa dias com negócios em bloco. Em out/2026 são 91, concentrados em 26/10.

| código | dias suspeitos | aumento máximo em negócios, em 25 meses |
|---|---|---|
| BOVA11 | 55 | 21,5% |
| PETR4 | 23 | 9,1% |
| BBAS3 | 17 | 8,9% |
| JBSS32 (BDR) | 7 | 10,3% |
| INBR32 (BDR) | 7 | 4,3% |
| ROXO34 (BDR) | 4 | 3,7% |

**O que é afetado:** `negocios`, `ticket_medio` e o `negocios_24m` já publicado, sempre nos papéis mais líquidos. **O que não é afetado:** volume, quantidade e presença.

## O que difere da especificação

| especificação | realidade | proposta |
|---|---|---|
| filtro por `CODBDI` 02 e 96 | perde recuperação judicial e inclui `IBOV11` | `TPMERC` + cadastro + espécie |
| `/acoes/tabela` ganha colunas | a rota virou redirecionamento para `/acoes/` (`web/vercel.json`) | colunas na tabela de `/acoes` |
| "sobe a versão minor do `schema_version`" | é o inteiro `1` (`const` no schema, `z.literal(1)` no zod) | migrar para texto `MAJOR.MINOR` (decisão do dono) |
| `sem_negocios` × `sem_cotacao_no_periodo` | no COTAHIST os dois são ausência de registro | abaixo |
| "listada há menos de 3 meses (data de 8.5)" | o FCA é anual: as datas de listagem mais novas são de jan/2026 | FCA, depois `dateListing` da B3 |
| partições de liquidez por ano | as atuais são mensais; um arquivo anual seria reescrito todo dia | manter `AAAA-MM.json` |
| partições de BDR separadas em vista e fracionário | não há fracionário | não migrar |
| lista de `acoes.json` como universo histórico | ignora tickers antigos (abaixo) | mapear pelo FCA |
| "total do mercado à vista do arquivo" | o arquivo não tem total | soma por partes |
| snapshot com data de fim de mês | é a posição do dia da coleta | exibir a data real |

### Tickers antigos somem da série da companhia

O cadastro só tem os tickers atuais. Em nov/2024, **R$ 50,3 bi (13% do volume de ações do mês), em 56 tickers, ficam sem companhia**: ELET3, EMBR3, JBSS3, BRFS3, CPLE6... Em out/2026 são R$ 4 mi. A AXIA Energia, por exemplo, teria a série cortada no ponto em que ELET3 deixou de negociar.

**Proposta:** atribuir pelo FCA de 2018 em diante, que liga código a CNPJ, sem fonte nova. Isso resolve 31 dos 56 tickers (R$ 35,3 bi, 70% do valor). O restante (JBSS3, NTCO3, CRFB3, PETZ3...) vai para `config/overrides/tickers_historicos.csv`, sempre com fonte, ou fica em `nao_atribuido`.

## Decisões do dono (2026-11-03)

1. **8.10 fora do escopo** ([ADR 0007](decisoes/0007-api-publica-fora-do-escopo.md)). A primeira decisão foi publicar só dados da CVM; depois o dono retirou o item inteiro. A Onda C passa a ser 8.8 → 8.9 → 8.7 → 8.6.
2. **Perfil de BDR só com faixas de ticket:** "ticket baixo", "intermediário", "ticket alto" e "dados insuficientes". Sem rótulo de tipo de investidor.
3. **Negócios e ticket como vieram, com selo.** O número da fonte não é alterado; o mês suspeito recebe aviso e link para a metodologia. O limite fica em `config/indicadores.yaml`.
4. **`schema_version` vira texto `MAJOR.MINOR`** (`"1.1"`) em todos os arquivos, com ADR.
5. **Onda A autorizada** com todas as propostas abaixo e as da tabela de diferenças: partições mensais, segmento a partir de 2018 e tickers antigos atribuídos pelo FCA, com um único download dos ZIPs de 2018 a 2025.

## Decisões propostas e aprovadas

1. **Precedência em 8.2:** `listagem_recente` > `sem_cotacao_no_periodo` (nenhum registro em 24 meses) > `sem_negocios` (teve registro em 24 meses, nenhum nos 3 últimos fechados) > presença de 6 meses.
2. **Categoria nova `sem_ticker`** para as 223 companhias sem código de negociação.
3. **`acoes_liquidez` absorve `acoes_volume`:** mesma origem e mesmo volume. O arquivo antigo fica até a 8.10 definir a API.
4. **Uma leitura por arquivo:** `processar_diario` e `processar_mensal` passam a alimentar todas as categorias numa só passada, cumprindo "proibido baixar duas vezes" (resolve o custo aceito no ADR 0004).
5. **`/acoes/liquidez`** segue como rota própria, como pedido, sem desfazer a unificação de `/acoes`.

## Riscos fora do escopo da etapa

**Termos de uso da B3.** Os Termos do site dizem que os dados são para "uso exclusivamente pessoal" e que, sobre a difusão de dados de mercado, "é vedada a distribuição, redistribuição, [...] publicação [...] ou fornecimento de bases de dados e produtos a terceiros" sem consentimento. A página de séries históricas, de onde vem o COTAHIST, **não** traz o aviso de coleta automatizada, e o CE 033/2019 cita essas séries como parte da divulgação prevista na regulamentação. Mesmo assim, o texto geral alcança o site atual e pesa mais sobre a 8.10, que publica uma API aberta com CORS. Não é parecer jurídico. A 8.10 saiu do escopo; a questão sobre o site atual continua em aberto.

## Limites desta verificação

- O teste a partir do GitHub Actions não foi feito para o empréstimo de ativos, de propósito. Para as demais fontes, nada mudou.
- O estouro de `TOTNEG` é inferência, e a contagem de dias é um teto.
- O lote unitário de BDR foi inferido de `QUATOT`, não lido de um cadastro.
- Os 16 ZIPs de FCA usados na verificação ficaram fora do repositório. O `COTAHIST_M102026.ZIP` foi baixado para `.cache/raw/`, que o Git ignora.
- Nenhum teste automatizado foi criado nem rodado, e nada foi commitado.
