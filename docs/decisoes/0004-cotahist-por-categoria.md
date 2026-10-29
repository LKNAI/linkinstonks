# ADR 0004: COTAHIST por categoria

**Status:** aceita (Fase 7, 2026-10-29)

## Contexto
O prompt exige que um dataset novo caiba em cinco peças (fonte, dataset, schema, rota, configuração) e pede o volume mensal de ações como prova (seção 13). O COTAHIST, que já alimenta o volume dos BDRs, traz todos os papéis da B3 nos mesmos arquivos. Até a Fase 6 o código estava fixo em BDR (`is_bdr_ticker`, `data/history/bdr_volume`, estado `cotahist`).

## Decisão
Um recorte do COTAHIST é uma `Categoria` (nome, chave da fonte em `meta.fontes`, pasta de partições, estado e filtro `(CODNEG, ESPECI)`). `BDR` e `ACAO` são duas instâncias; as funções de processamento recebem `cat=` com `BDR` como padrão, então nada do dataset `bdrs` mudou de comportamento. Cada categoria tem a sua pasta de partições (`data/history/<categoria>_volume/`) e o seu estado de pregões processados.

## Consequências
- **Bom:** categoria nova é declarar uma instância e um filtro validado contra o arquivo real; os testes de borda (ZIP corrompido, feriado, fonte fora do ar) valem para todas as categorias, porque passam pelo mesmo caminho.
- **Custo aceito:** cada categoria baixa de novo o arquivo diário (~0,6 MB por pregão) e o mensal (~10 MB), pois o `download` não reaproveita arquivo em disco. Para 2 categorias é irrelevante; com muitas, convém processar todas as categorias numa só leitura de cada arquivo (mudança local em `processar_diario`).
- **Filtro de ações:** `^[A-Z0-9]{4}[3-8]B?F?$`, mais units (`11`) somente com espécie `UNT`, porque ETFs e FIIs também terminam em 11. Fica de fora o que não é ação à vista: bonificação (`BNS`), direito (`DIR`), ETF/FII (`CI`), opções e termo. Validado contra o arquivo de 28/10/2026 (702 registros de 367 tickers de ações).
- **Volume sem dono:** tickers que não casam com nenhuma companhia do cadastro atual (por exemplo, empresas já deslistadas) não são descartados; vão para `nao_atribuido`. No primeiro cálculo foram 6,4% do volume em 24 meses; acima de 10% o ETL avisa.
