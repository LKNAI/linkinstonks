# Fixtures (Fase 0)

Respostas **reais** gravadas por `python etl/probe/probe.py` em 29/10/2026. Não editar à mão; regravar com o probe.

| pasta | arquivo | observação |
|---|---|---|
| `b3_listed/` | `GetInitialCompanies_p1.json` | página 1 de 30 (120 de 3.549 registros) |
| | `GetDetail_*.json` | corpo cru, **dupla codificação** (JSON dentro de string). `EUROFARMA_vazio` = `"{}"` |
| | `GetCompaniesBDR_p1.json` | página 1 de 3 (120 de 321) |
| | `GetCategoryBDRETF.json` | completo |
| `cvm_fca/` | `fca_cia_aberta_escriturador_2026.csv` | completo, ISO-8859-1, 530 linhas. Contém documentos com mais de uma linha de escriturador e conflitos nome × CNPJ |
| `cvm_cad/` | `cad_cia_aberta_head40.csv` | **extrato**: cabeçalho + 40 linhas (completo tem 2.678) |
| `b3_cotahist/` | `COTAHIST_D28102026_bdr_extrato.txt` | **extrato**: header (`00`) + os 601 registros de BDR do dia + trailer (`99`). O trailer mantém a contagem do arquivo original (17.616), não a do extrato |
| `b3_finservices/` | `programas_drn_tabela.html`, `programas_etf_tabela.html` | **extrato**: só o elemento `<table>` (761 e 309 programas) |
| `bradesco/` | `*.json` | modelos de página AEM e consulta GraphQL persistida (44 itens) |
| `itau/` | `bdr_resposta.html` | resposta **403 Access Denied** (documenta o bloqueio) |

Observação: o repositório ainda não é Git; antes do primeiro commit, avaliar o tamanho (≈ 2,8 MB, dos quais 2,3 MB são as tabelas do finservices).
