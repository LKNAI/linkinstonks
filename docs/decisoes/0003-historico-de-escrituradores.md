# ADR 0003: regras do histórico de escrituradores (FCA)

- Status: aceito (2026-10-29)
- Contexto: fases 0 e 2

## Contexto
O texto original do prompt (seção 7.2) descrevia "atual = escriturador do documento mais recente" e resolvia a instituição pelo CNPJ. Um protótipo fiel a isso acertou só 93,4% do escriturador atual contra `seed/raw/cvm/fca.txt`, abaixo da meta de 99%. A regra do seed não está documentada (o arquivo já vem consolidado), então foi reconstruída empiricamente sobre os 17 anos do FCA (2010-2026).

## Decisão
Implementada em `etl/src/painel_etl/datasets/escrituradores.py`:

1. Por companhia e `Data_Referencia`, só a **maior `Versao`** (feito em `sources/cvm_fca.parse_zip`).
2. A instituição é resolvida pelo **nome** (padrões regex em `config/instituicoes.yaml`); o **CNPJ** entra como reforço, pela raiz de 8 dígitos. Em conflito, o nome vence (o FCA traz "Itaú Corretora" com o CNPJ do Itaú Unibanco, e filiais do BTG com CNPJs distintos).
3. Um documento pode ter **várias linhas** (o escriturador antigo com `Data_Fim_Atuacao` e o novo). **Atual** = linha do documento mais recente **sem data de fim**; na falta, a de maior início.
4. **Início do atual** = último `Data_Inicio_Atuacao` informado. Sem data: `inicio_aproximado = true` e início = 1º ano em que a instituição aparece (`AAAA-01-01`).
5. **Anterior** = a outra instituição vista mais recentemente (maior último ano; desempate pela data de fim). Seu **início** é a primeira data informada, o **fim** a última data de fim informada, e `anterior_ultimo_ano` o último ano em que consta.
6. `n_escrituradores` = instituições distintas no histórico.
7. "Própria empresa": literal `EMPRESA` da B3, CNPJ de mesma raiz da companhia, ou nome que coincide com o da companhia.
8. Nome que não casa com nenhum padrão: `nao-mapeado`, mostrado com o nome original e listado no relatório de qualidade. Nunca falha em silêncio.

## Resultado
Sobre as 427 companhias com FCA no seed: atual 100%, anterior 100%, início do atual 99,8%, nº de escrituradores 99,3%.

## Limitações conhecidas
- Em 1 caso o seed usa a data de início mais antiga em vez da mais recente para o atual, e em 3 conta um escriturador a mais. Não foi possível inferir a regra; ficam como divergência justificada em `docs/paridade.md`.
- Os padrões de nome dependem das grafias que existem hoje. Uma grafia nova que não case com nada aparece como `nao-mapeado` até alguém incluí-la no YAML.
- A data `1900-10-12` (Banco do Brasil) é uma data sentinela do FCA e é mantida como veio.
