# Dados dos dashboards B3 (Ações e BDRs)

Posição: ações em 23/10/2026 · BDRs em 28/10/2026 (volumes de out/2024 a set/2026).

## Estrutura

```
data/   → datasets finais, prontos para o app (JSON) e para Excel (CSV ; UTF-8)
  acoes.json / acoes.csv   568 companhias com ações listadas
  bdrs.json  / bdrs.csv    1.143 BDRs (DRN, DRE/ETF, patrocinados)
raw/    → extrações intermediárias, como saíram das fontes
  acoes/data1.txt, data2.txt   B3 GetInitialCompanies + GetDetail
  cvm/fca.txt                  histórico de escrituradores (CVM FCA 2010–2026)
  bdrs/finservices.txt         programas do Banco B3 (DRN e ETF)
  bdrs/cot.txt                 COTAHIST mensal agregado por ticker (24 meses)
etl/    → scripts Python e templates que geraram os HTMLs
html/   → os três HTMLs entregues
```

> Os scripts em `etl/` usam caminhos fixos (`/home/claude/...`) do ambiente onde rodaram. Ajuste os caminhos para `raw/` antes de reexecutar.

## Dicionário: acoes.json (`companies[]`)

| campo | significado |
|---|---|
| p | nome de pregão |
| r | razão social |
| e | código do emissor (raiz do ticker) |
| c | CNPJ |
| v | código CVM |
| m | segmento de listagem (NM, N1, N2, MA, BN…) |
| s | setor |
| b | escriturador segundo a B3 (normalizado) |
| pn | escriturador das PN, quando diferente das ON |
| onr / pnr | nome bruto do escriturador ON / PN na B3 |
| t | tickers `[[ticker, classe]]` |
| f.cur | escriturador atual segundo a CVM (FCA) |
| f.ini | data de início do escriturador atual |
| f.ax | B3 e CVM divergem |
| f.prev / f.pini / f.pfim | escriturador anterior, início e fim |
| f.n | nº de escrituradores registrados no histórico |

## Dicionário: bdrs.json (`bdrs[]`, `meta.months`)

| campo | significado |
|---|---|
| t | ticker |
| n | emissor / ativo |
| k | tipo: DRN (não patrocinado), DRE (ETF), DR1/DR2/DR3 (patrocinado) |
| d | depositária |
| s | fonte que identificou a depositária |
| c | categoria do ETF (Renda Variável, Renda Fixa, Commodities, Moeda) |
| q | 1 = restrito a investidor qualificado |
| i | ISIN |
| f / l | primeiro / último pregão na janela de 24 meses |
| p | último preço (R$) |
| g | nº de negócios em 24 meses |
| v | volume financeiro mensal em R$ mil, alinhado com `meta.months` |

## Fontes

- B3, Empresas Listadas: `sistemaswebb3-listados.b3.com.br/listedCompaniesProxy/CompanyCall/` (GetInitialCompanies, GetDetail, GetCompaniesBDR). Os parâmetros vão em JSON codificado em base64 na URL.
- CVM, Dados Abertos FCA: `dados.cvm.gov.br/dados/CIA_ABERTA/DOC/FCA/DADOS/fca_cia_aberta_AAAA.zip`, arquivo `fca_cia_aberta_escriturador`.
- B3, Séries Históricas: `bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_MmmAAAA.ZIP`.
- Depositárias de BDR não patrocinados: listas do Banco B3 (finservices.b3.com.br), Bradesco Custódia e Itaú Securities Services.
