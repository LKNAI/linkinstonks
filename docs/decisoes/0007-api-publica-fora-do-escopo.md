# ADR 0007: API pública de dados abertos (8.10) fora do escopo

**Status:** aceita (dono, 2026-11-03)

## Contexto
A Fase 8 previa, no item 8.10, URLs versionadas em `/data/v1/`, catálogo, `datapackage.json`, CORS aberto, a rota `/dados` e sustentação da v1 por 6 meses a cada mudança incompatível. Os Termos da B3 falam em "uso exclusivamente pessoal" e vedam a redistribuição sem consentimento. O dono decidiu primeiro limitar o catálogo aos dados da CVM e, em seguida, retirar o item.

## Decisão
A 8.10 sai do escopo. Não haverá `/data/v1/`, catálogo, `datapackage.json`, CORS aberto, rota `/dados` nem os ADRs de versionamento da API e de termos de redistribuição. A Onda C passa a ser 8.8 → 8.9 → 8.7 → 8.6.

## Motivos
- Os dados da CVM já são abertos na origem; o que o projeto acrescenta vem da B3, justamente o que ficaria de fora.
- Separar arquivos só com campos da CVM e sustentar URLs versionadas tem custo contínuo.
- Um catálogo com CORS e exemplos de uso anuncia a redistribuição, o ponto sensível dos Termos.
- Nenhum outro item da Fase 8 depende dela.

## O que permanece
- Os contratos versionados (ADR 0008) e o teste de contrato, que protegem o próprio site.

## Consequências
Esta decisão não resolve a questão dos Termos para o site atual, que publica dados derivados da B3 e CSVs para baixar. Só evita aumentar a exposição. A questão do site atual está no [ADR 0009](0009-termos-de-uso-da-b3.md).
