# ADR 0006: empréstimo de ativos (8.11): não seguir

**Status:** aceita (Etapa 8.0, 2026-11-03). Pode ser reaberta se a B3 autorizar por escrito.

## Contexto
A especificação da Fase 8 condicionou o item 8.11 a seis critérios, todos obrigatórios: se um falhar, escreve-se um ADR "não seguir" e o item para.

## Arquivos encontrados
Os glossários da B3 indicam os arquivos na página do Boletim Diário, seção Clearing, que incorpora a aplicação `https://arquivos.b3.com.br/bdi/tabelas?lang=pt-BR`. Os links do comunicado CE 033/2019 (`.../emprestimo-de-ativos/renda-variavel/posicoes-em-aberto/`) hoje levam à página de erro da B3.

| arquivo | colunas (glossário) | granularidade | publicação |
|---|---|---|---|
| Empréstimos de Ativos - Posição em Aberto-DD-MM-AAAA | Data, Ticker, ISIN, Empresa ou Fundo, Tipo, Mercado, Saldo em quantidade do ativo, Preço Médio, Saldo em R$ | ticker, dia e mercado | CSV, na abertura do dia, com dados de D-1 |
| Empréstimos de Ativos - Empréstimos Registrados-DD-MM-AAAA | Data, Ticker, ISIN, Empresa ou Fundo, Mercado, Número de Contratos, Quantidade de Ativos, Valor em R$, Taxas mínima, média e máxima de doador e de tomador | ticker, dia e mercado | CSV, na abertura do dia, com dados de D-1 |

- **Histórico:** o CE 033/2019 fala em "10 dias de histórico". A página "Pesquisa por pregão" oferece arquivos retroativos; a profundidade atual não foi medida.
- **Geração:** segundo o glossário, o arquivo "terá seu conteúdo em relação ao filtro aplicado na consulta em tela", ou seja, sai da consulta na tela, não de uma URL fixa publicada.
- **Campos e cobertura:** vêm dos glossários (versões de 05/09/2023 e 22/02/2024). **Nenhum arquivo real foi baixado**, pelo motivo abaixo.

## Critérios
| critério | resultado | evidência |
|---|---|---|
| público e gratuito | ✅ | notícia da B3 de 14/11/2019: "sem custo" |
| legível por máquina | ✅ | CSV com cabeçalho (glossários) |
| por ticker | ✅ | coluna Ticker (glossários) |
| atualização ao menos diária | ✅ | "disponibilizado diariamente" (glossários) |
| cobre ações e BDRs | ⚠️ não confirmado | o serviço admite ações e BDRs, mas não há arquivo lido que prove a cobertura |
| termos não proíbem publicar derivados | ❌ **reprovado** | ver abaixo |
| download automático funciona no GitHub Actions | não testado de propósito | testar seria justamente a coleta vedada |

## O impedimento
As páginas "Boletim diário do mercado" e "Pesquisa por pregão", únicas portas de entrada dos arquivos, trazem, conforme lido em 2026-11-03:

> "Os dados e informações disponibilizados nesta página são de propriedade exclusiva da B3 e destinam-se estritamente à consulta informativa, conforme Termos e Condições de Uso. Para manutenção da segurança do site e integridade dos dados e informações disponibilizados, é expressamente vedada a coleta automatizada, inclusive por meio de ferramentas de inteligência artificial, para quaisquer finalidades, comerciais ou não, próprias ou de terceiros."

O item 8.11-B depende de uma coleta diária automática, sem a qual a série própria não existe. O texto a proíbe, inclusive para uso não comercial. O ETL não contorna bloqueios e não ignora avisos de uso.

## Decisão
**Não seguir.** Sem coleta, sem fixture de dados, sem scraper, sem bloco na interface, sem seção no relatório mensal. O relatório mensal (8.7) omite o item "empréstimo de ativos", como a especificação já prevê para o caso de o item não estar ativo.

## Como reabrir
Autorização por escrito da B3 para coleta automatizada e publicação de agregados. Contato informado no comunicado CE 019/2023: Coordenadoria de Operações de Dados, `dataservices@b3.com.br`. Com a autorização, refazer o teste de viabilidade com um arquivo real e registrar o texto recebido neste ADR.

## Registro do que foi acessado
Para esta avaliação foram lidas as páginas HTML, os glossários e os comunicados. Houve um único `GET` na raiz de `arquivos.b3.com.br`, feito antes de encontrar o aviso, que devolveu a casca da aplicação (2 KB). A aplicação `/bdi/tabelas` e os arquivos de dados não foram acessados.

Não é parecer jurídico.
