# Como adicionar um dataset

Adicionar um dataset novo (FIIs, ETFs nacionais, debêntures, volume de ações...) exige **cinco peças**, e nada além delas: módulos de fonte (se a fonte for nova), um módulo em `datasets/`, um schema, uma rota no `web/` e uma entrada na configuração. Este guia segue o exemplo que prova o desenho: o **volume mensal de ações** (`acoes_volume`), feito sobre o COTAHIST que o dataset `bdrs` já baixa. O custo marginal de fonte foi zero.

## Antes de começar: o dado já existe em alguma fonte que o projeto usa?
- **Sim** (como o volume de ações, que está nos mesmos arquivos COTAHIST dos BDRs): não crie fonte nova. Declare um recorte da fonte existente (passo 1).
- **Não**: crie `etl/src/painel_etl/sources/<fonte>.py` com `fetch` + `parse`, fixtures **reais** em `etl/tests/fixtures/<fonte>/` e uma seção em `docs/fontes.md` (URL confirmada por sondagem, formato, armadilhas). Nunca invente endpoint, campo ou CNPJ.

## Os cinco passos
Cada passo diz o que foi feito no `acoes_volume`.

### 1. Fonte
O COTAHIST é um arquivo por pregão (e por mês) com todos os papéis. O recorte virou uma `Categoria` em `sources/b3_cotahist.py`:

```python
ACAO = Categoria("acao", "b3_cotahist_acoes", "acoes_volume", "cotahist_acoes", is_acao_ticker)
#               nome    chave em meta.fontes    pasta das partições  estado          filtro (CODNEG, ESPECI)
```

`BDR` já era uma categoria; `processar_diario`, `processar_mensal` e `agregar` recebem `cat=`. O filtro novo (`normalize/tickers.py: is_acao_ticker`) foi validado contra o arquivo real de 28/10/2026 e tem fixture real (`COTAHIST_D28102026_acoes_extrato.txt`, 56 registros que incluem o que deve ficar de fora: ETF/FII, bonificação, direito, outros mercados).

### 2. Módulo em `datasets/`
`etl/src/painel_etl/datasets/acoes_volume.py`, com a mesma forma dos outros: `construir(...)`, `validar(...)`, `csv_cabecalho/csv_linhas`. Ele soma o volume dos tickers de cada companhia (cadastro vindo de `acoes.json`) e **não descarta o que não casa**: vai para `nao_atribuido`, e companhias mais não atribuído reproduzem o total dos arquivos da B3.

A função `run_<dataset>` entra em `pipeline.py` (`run_acoes_volume`) e é registrada em três lugares: o dicionário de `run()`, `DATASETS` em `cli.py` e `ARQUIVOS` (os arquivos que `painel-etl validate` confere). Quem usa partições históricas precisa de um `backfill`: `painel-etl backfill cotahist --from 2024-10 --categoria acao`.

Regras que todo dataset cumpre (a revisão confere):
- saída determinística (chaves ordenadas, sem timestamp dentro dos dados), via `core/io`;
- portão de qualidade (`core/quality`): queda de contagem, obrigatórios, únicos, não negativos;
- reprovou no portão: **não publica** e o dado anterior fica intacto; a Issue de qualidade abre sozinha;
- rastreabilidade: se há número que o leitor pode querer conferir, ele aponta para a fonte oficial (`fontes_volume` + `pagina_fonte`).

### 3. Schema
`schemas/<dataset>.schema.json` (JSON Schema 2020-12). O `painel-etl validate` e o CI rodam contra ele. No site, o espelho em zod (`web/lib/schemas.ts`) é verificado contra o JSON Schema por `tests/unit/contrato.test.ts`, então os dois não divergem.

### 4. Rota no `web/`
Páginas de dados estáticas leem o JSON **em tempo de build** (`lib/servidor.ts`), sem custo de JS no cliente. No exemplo: `app/acoes/volume/page.tsx` e o gráfico no detalhe da companhia. Os componentes são os genéricos, configurados por props (`GraficoVolume`, `FonteVolume`, `Cartao`, `Lista`, `Migalhas`): o gráfico de volume dos BDRs virou `GraficoVolume` e serviu aos três usos sem alterar o desenho. Lembre-se de: link no menu (`SiteChrome`), `app/sitemap.ts`, a lista de downloads em `/sobre`, e a rota nas suítes `rotas.spec.ts` e `acessibilidade.spec.ts`.

### 5. Entrada na configuração
Uma seção em `config/sources.yaml` (documentação viva da fonte e do dataset; o código não a lê) e as linhas de `docs/fontes.md`. Se o dataset depende de uma fonte com checagem de atraso, inclua a chave dela em `FONTES_DIARIAS` ou `FONTES_SEMANAIS` (`web/lib/stale.ts`) para a faixa de aviso e o `/status` a reconhecerem. Inclua também o nome do dataset nas opções de `workflow_dispatch` de `etl-daily.yml` e `etl-weekly.yml`.

## Checklist de pronto
- [ ] fixtures reais da fonte (nunca inventadas) e testes de filtro/parse;
- [ ] testes do dataset: caso feliz, queda de contagem, duplicado/negativo, idempotência;
- [ ] `painel-etl validate` ok, `ruff`, `mypy --strict`, `pytest` verdes;
- [ ] schema + contrato zod × JSON Schema;
- [ ] página com os estados carregando/vazio/erro (se for dinâmica), título, descrição e rodapé;
- [ ] e2e e axe passando; `pnpm budget` dentro de 200 KB gzip por rota;
- [ ] `docs/fontes.md`, `AGENTS.md` (se houver comando novo) e este guia atualizados.

## Custo do exemplo (medido)

| item | valor |
|---|---|
| fonte nova | nenhuma (mesmos arquivos COTAHIST dos BDRs) |
| dados publicados | `acoes_volume.json` 132 KB + CSV 56 KB (limite: 15 MB em `data/public/`) |
| histórico | 24 partições mensais, ~2 MB (cerca de 80 KB por mês, ~1 MB por ano) |
| carga inicial | 24 arquivos mensais da B3 (~10 MB cada), uma vez |
| execução diária | mais um arquivo diário da B3 (~0,6 MB) por pregão |
| código novo | 1 módulo de dataset, 1 filtro, 1 função de pipeline, 1 schema, 1 página |
