# Decisões tomadas ao fim da Fase 0 (2026-10-29)

| # | Tema | Decisão | Consequência |
|---|---|---|---|
| 1 | Resolução do escriturador | Comparar pela **raiz do CNPJ** (8 dígitos); se CNPJ e nome divergirem, **o nome vence** | Reproduz o seed. Ajustar a ordem da seção 12 do prompt em `normalize/instituicoes.py` |
| 2 | Itaú (HTTP 403) | **Só curadoria manual** em `config/overrides/depositarias.csv`; sem tentativa de contornar o bloqueio | Os 11 programas do mapa `ITAU` do seed viram overrides com fonte e data |
| 3 | HELBOR (HBOR3) | **Mudança real** de segmento; a API é a verdade | Sem override. Registrar em `docs/paridade.md` como divergência justificada |
| 4 | Categoria dos ETFs | Rótulos **da API** (Renda Variável, Renda Fixa, Commodities, Moeda) | Sem mapa próprio; `CAT_LINE` do seed é descartado |
| 5 | Repositório | **Público** | Minutos do Actions gratuitos; Vercel Hobby segue exigindo uso não comercial |
| 6 | Nome do projeto | **linkinstonks**: repositório `LKNAI/linkinstonks` e projeto Vercel `linkinstonks` (`linkinstonks.vercel.app`). Livres na checagem de 2026-10-29 (a confirmação final do subdomínio é ao criar o projeto). `painel-b3` e `radar-b3` já estão ocupados no `vercel.app`. | O repositório local ainda se chama P5 e os pacotes internos seguem `painel-etl`/`web`; o nome público aparece no README e na criação do repositório (Fase 6). O título do site continua "Painel B3" até haver outra decisão. |
