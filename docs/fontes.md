# Fontes de dados

Resultado da sondagem da Fase 0, feita em **29/10/2026** a partir de uma máquina residencial (Windows, IP do Brasil). Reproduzível com `python etl/probe/probe.py`. Fixtures em `etl/tests/fixtures/<fonte>/` (ver `NOTAS.md` lá). **Ainda não testado a partir de IPs do GitHub**: rodar `probe.yml` (seção 9.4 do prompt).

Todas as chamadas usam `User-Agent: painel-b3-probe/0.1 (projeto de dados abertos, uso nao comercial)`.

Resumo: ✅ funciona como o prompt descreve · ⚠️ funciona com diferença · ❌ não funciona.

| fonte | situação |
|---|---|
| B3 Empresas Listadas | ⚠️ funciona; 4 diferenças em relação ao prompt |
| CVM FCA (escriturador) | ⚠️ funciona; regra do "atual" precisa de ajuste |
| CVM cadastro (CAD) | ✅ |
| B3 COTAHIST (M, A, D) | ✅ padrão diário confirmado |
| Banco B3 (finservices) | ⚠️ URLs diferentes das sugeridas; ✅ dados idênticos ao seed |
| Bradesco Custódia | ⚠️ URL do prompt dá 404; existe API pública, mas só com nome da empresa |
| Itaú Securities Services | ❌ 403 (Akamai) para cliente não-navegador |

---

## 1. B3 · Empresas Listadas

- Base: `https://sistemaswebb3-listados.b3.com.br/listedCompaniesProxy/CompanyCall/{Metodo}/{base64(JSON)}`. Sem autenticação. Resposta `application/json; charset=utf-8` (UTF-8 válido).
- Todos os métodos responderam 200 com o `User-Agent` acima.

### GetInitialCompanies
- Parâmetros: `language`, `pageNumber`, `pageSize`. Com `pageSize=120`: **3.549 registros, 30 páginas**.
- Campos: `codeCVM, issuingCompany, companyName, tradingName, cnpj, marketIndicator, typeBDR, dateListing, status, segment, segmentEng, type, market`.
- `cnpj` vem **sem zeros à esquerda** em alguns registros (`"8773135000100"`) e como `"0"` nos ETFs. Normalizar com `zfill(14)`.
- Distribuição de `type` (29/10): `1`=568, `4`=327, `7`=2.635, `6`=11, `2`=7, `99`=1.
  - ⚠️ **Diferença:** `type=4` mistura 321 DRE **e** 6 BDRs patrocinados (DR1); `type=2` são 7 patrocinados (DR1/DR2/DR3). O prompt diz "2 e 4 = BDR; 7 = balcão", mas existem também `6` (carga inicial/MB) e `99`. **A chave confiável para BDR é `typeBDR`** (`DRE`, `DR1`, `DR2`, `DR3`), não `type`.
- As 568 companhias `type=1` coincidem exatamente com o seed (codeCVM, pregão, emissor e setor: 0 diferenças).
- **Segmento de listagem** (NM, N1, N2…) não tem campo próprio: o seed o deriva de `marketIndicator`: `18→NM`, `17→N2`, `16→N1`, `32→MP`, `1→B`, `7→SO`, `8→BN`. Detalhe vazio (`{}`) → `?` ("Sem dados"). A tabela de mapeamento precisa ir para `sources.yaml`.
  - Exceção observada: **HELBOR (20877)** está `NM` no seed, mas a API de 29/10 devolve `marketIndicator=1` (Tradicional). Mudança real nos 6 dias entre a coleta do seed e hoje, ou correção manual no seed: **a confirmar**.
  - `EUROFARMA (26700)` tem `marketIndicator=1` na lista, mas detalhe vazio; o seed a classifica como `?`. Regra do seed: detalhe vazio ⇒ segmento `?`.

### GetDetail
- ⚠️ **A resposta é JSON dentro de uma string** (dupla codificação): o corpo é `"{\"issuingCompany\":...}"`. É preciso `json.loads` duas vezes. O mesmo vale para `GetCategoryBDRETF`; `GetInitialCompanies` e `GetCompaniesBDR` vêm com codificação simples. Tratar de forma genérica: se o primeiro `loads` devolver `str`, decodificar de novo.
- Campos úteis: `institutionCommon`/`institutionPreferred` (escriturador ON/PN, **texto cru** como `"EMPRESA"`, `"BRADESCO"`, `"ITAUBANCO - ACOES"`), `industryClassification` (`"Setor / Subsetor / Segmento"`), `otherCodes[{code,isin}]`, `code`, `market`, `lastDate`, `typeBDR`.
- Detalhe vazio devolve a string `"{}"` (4 bytes, já com a dupla codificação). Os 8 emissores que o seed marca como segmento `?` continuam com detalhe vazio hoje (`ASABRANCAH, CHINA THREE, CIASECURIT, EUROFARMA, IFIN PARTICI, MANAUS TRANS, RODOVIAS DO, SBF COM PROD`). Os demais ~560 `GetDetail` não foram chamados na Fase 0, então não se sabe se há outros casos.
- ⚠️ **ETFs (DRE) também trazem depositária**: `institutionPreferred` nos 321 ETFs = `"BANCO B3 S.A."` (308), `"BRADESCO"` (8), vazio (5). Nos 275 em comum com o seed, **100% de concordância** com a depositária que o seed obteve por finservices/Bradesco. O prompt dizia que a API só informa depositária de patrocinados.
- Patrocinados (`typeBDR` DR1–DR3): 13 hoje. Depositária: `BRADESCO`, `BANCO B3 S.A.`, `ITAUBANCO - ACOES`. O 13º, **PPLA11** (units), é excluído pelo seed.
- Custo da revisita completa: 568 chamadas × ~0,5 s ≈ 5 min por semana.

### GetCompaniesBDR
- Parâmetros: `language, pageNumber, pageSize, codeCategoryBVMF=-1, company=""`. **321 registros**, 3 páginas de 120.
- ⚠️ **Traz a categoria do ETF** (`codeCategoryBVMF`, `describleCategoryBVMF`: Renda Variável 250, Renda Fixa 50, Commodities 21). Nos 280 ETFs em comum com o seed há **100% de concordância**. O seed usava um mapa fixo por prefixo de ticker (`CAT_LINE` em `seed/etl/bdrs/build.py`), que não é necessário.
- Diferenças de universo: 41 ETFs da API não estão no seed (não negociaram em 24 meses) e 11 do seed não estão na API (cancelados/ticker antigo). O universo de BDRs do site é o do COTAHIST, não o da API.
- `typeBDR` aqui é sempre `DRE`.

### GetCategoryBDRETF
- `[{"id":28,"describle":"Renda Fixa"},{"id":29,"describle":"Renda Variável"},{"id":30,"describle":"Commodities"},{"id":43,"describle":"Moeda"}]`. Nenhum ETF usa `43` hoje.
- Rótulos da API (`Renda Variável`, `Commodities`) diferem dos do seed (`Renda variável`, `Commodities / cripto`). Decidir o rótulo de exibição.

---

## 2. CVM · FCA (escriturador)

- `https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/FCA/DADOS/fca_cia_aberta_{AAAA}.zip`: existe de **2010 a 2026**; 2009 e 2027 dão 404. ~340–400 KB cada. `HEAD` devolve `ETag` e `Last-Modified` (2026: `Last-Modified: 25/10/2026`).
- Arquivo `fca_cia_aberta_escriturador_{AAAA}.csv`: `;`, **ISO-8859-1** (UTF-8 falha), cabeçalho: `CNPJ_Companhia;Data_Referencia;Versao;ID_Documento;Nome_Empresarial;Escriturador;CNPJ_Escriturador;Tipo_Endereco;Logradouro;…;Data_Inicio_Atuacao;Data_Fim_Atuacao`. Confirmados os 7 campos do prompt.
- 2026: 530 linhas, 466 companhias. `Data_Referencia` = `AAAA-01-01` (um por companhia/ano).
- ⚠️ **Achados que mudam a regra 7.2** (validados em protótipo, ver relatório):
  1. **Um documento pode ter mais de uma linha** (o escriturador antigo com `Data_Fim_Atuacao` e o novo). 61 de 466 documentos (13%) em 2026. O "atual" deve ser a linha **sem `Data_Fim_Atuacao`** (ou de maior `Data_Inicio_Atuacao`), não "o escriturador do documento mais recente". Sem isso, o protótipo acertou só 93,4% do escriturador atual contra o seed.
  2. **O CNPJ nem sempre é consistente com o nome.** Em 2026: "Itaú Corretora…" aparece com 3 CNPJs (`61.194.353/0001-64` ×272, `60.701.190/0001-04` ×5, `60.746.948/0001-12` ×1); "Banco Bradesco…" com 3; "Itaú Unibanco" com 2. O `60.701.190/0001-04` é o do Itaú Unibanco. O seed resolve por **nome**. A ordem "CNPJ → alias" do prompt (seção 12) produziria resultados diferentes do seed nesses casos.
  3. **BTG** aparece com CNPJs de filial (`30.306.294/0001-45` e `/0002-26`) além do `59.281.253/0001-23`: comparar pela **raiz do CNPJ (8 dígitos)** e/ou aliases.
  4. Nomes do mesmo escriturador variam (`Itaú Corretora de Valores S.A.`, `S/A`, `ITAU CORRETORA DE VALORES S.A.`, `Itau…`): normalizar (sem acento, minúsculo, sem pontuação).
  5. `Data_Inicio_Atuacao` vazia em 10 de 530 linhas (→ `inicio_aproximado`). Há datas sentinela como `1900-10-12` (Banco do Brasil) que precisam de tratamento.
- Protótipo ingênuo (maior versão por `Data_Referencia`, linha final do último documento) contra `seed/raw/cvm/fca.txt`: 427 companhias do seed, todas presentes em 805 CNPJs; escriturador atual concorda em 399 (93,4%), início em 410 (96%), existência de anterior em 411 (96%). A meta do prompt é ≥ 99%.

## 3. CVM · cadastro de companhias abertas

- `https://dados.cvm.gov.br/dados/CIA_ABERTA/CAD/DADOS/cad_cia_aberta.csv`: 1,5 MB, `;`, ISO-8859-1, 2.678 linhas (`CANCELADA` 1.916, `ATIVO` 754, `SUSPENSO(A) - DECISÃO ADM` 8). Campos: `CNPJ_CIA, DENOM_SOCIAL, DENOM_COMERC, DT_REG, DT_CANCEL, SIT, CD_CVM, SETOR_ATIV, TP_MERC, CATEG_REG, …`. `HEAD` com `ETag` e `Last-Modified`. Fixture é extrato (40 linhas).

## 4. B3 · COTAHIST

- Base: `https://bvmf.bmfbovespa.com.br/InstDados/SerHist/`.
- ✅ **Padrão diário confirmado:** `COTAHIST_D{DD}{MM}{AAAA}.ZIP` (ex.: `COTAHIST_D28102026.ZIP`, 617 KB zip, 4,3 MB texto). Mensal `COTAHIST_M{MM}{AAAA}.ZIP` (set/2026: 10 MB zip, **90 MB** descompactado → streaming obrigatório). Anual `COTAHIST_A{AAAA}.ZIP` (≈ 89 MB zip).
- `HEAD` funciona e dá `Content-Length`/`Last-Modified` sem baixar. 404 em fim de semana, em feriado e **antes da publicação do dia**. O arquivo de 28/10 saiu às 23:34 UTC (20:34 BRT): o cron das 01:23 UTC (22:23 BRT) tem folga de ~1h50.
- Layout confirmado: 245 colunas por registro, `\r\n`, ISO-8859-1; `00` header, `01` cotação, `99` trailer (com contagem de registros). Posições do prompt conferem.
- Filtro de BDR: o regex `^[A-Z0-9]{4}3[1-59]F?$` e o filtro do seed (`ESPECI` começando com `DR`) dão **o mesmo conjunto** (966 tickers em set/2026). `TPMERC` só `010`/`020`; existem também `012/013` (leilão), `021`, `030` (termo), `070/080` (opções), que o filtro exclui. `ESPECI` pode vir como `DRN ED`, `DRE ED`, `DRN EB` (sufixos): usar o primeiro token.
- **Paridade antecipada:** agregando `COTAHIST_M092026` com essas regras, o volume de set/2026 reproduz o seed em **966 de 966 tickers**; total R$ 33.968.128 mil contra R$ 33.968.112 mil (diferença de R$ 16 mil por arredondamento por ticker).
- Fixture: `COTAHIST_D28102026_bdr_extrato.txt` (header + 601 registros de BDR + trailer; o trailer **não** bate com a contagem do extrato).

## 5. Banco B3 (finservices) · depositárias

- Site Liferay. As páginas `…/bdr-nao-patrocinado` e `…/bdr-de-etf` **não** trazem a lista; ela está nas subpáginas:
  - DRN: `https://finservices.b3.com.br/bdr-nao-patrocinado/programas`
  - ETF: `https://finservices.b3.com.br/bdr-de-etf/programa` (singular; `/programas` devolve a página-mãe)
  - `/bdr-patrocinado/programas` → 404.
- Paginação no servidor: `?delta=N&start=P` (o menu oferece 4–60). **`delta=1000` devolve tudo numa só requisição** (DRN 1,8 MB; ETF 0,8 MB).
- Tabela `Empresa | Código de Negociação | Ações`. Marca de investidor qualificado: `*` no fim do nome (só ETFs: 10).
- **Dados idênticos ao seed:** DRN 761/761 tickers, ETF 309/309 tickers, 10/10 asteriscos. A página exibe "de 791 resultados" para DRN, mas a tabela tem 761.
- Fixtures são **apenas a `<table>`** (o HTML completo tem 1,8 MB de Liferay).
- Fragilidade: depende de HTML Liferay (classes `table-bdr__result-*`). O gate de −20% do prompt se aplica.

## 6. Bradesco Custódia

- ⚠️ A URL do prompt (`custodia.bradesco/bradescocustodia/`) dá **404**. O site foi refeito em AEM + React (SPA, sem HTML útil).
- Dados públicos, sem autenticação:
  - Modelo de página: `https://custodia.bradesco/content/custodia/pt.model.json` (menu; lista as páginas), `…/pt/bdr-de-etf.model.json`.
  - **BDR de ETF**: o modelo contém uma tabela HTML com **8 tickers** (`ANGV39, BUZZ39, EMLC39, GDXB39, HYEM39, MOTB39, PFXF39, SLXB39`), os mesmos 8 que o `GetDetail` marca como `BRADESCO`.
  - **BDR de ações não patrocinadas**: consulta persistida do AEM, usada pelo próprio site:
    `https://custodia.bradesco/graphql/execute.json/banco-bradesco/custodia-get-bdr-by-path;path=/content/dam/banco-bradesco/custodia/conteudos/pt/arquivo/brazilian-depositary-receipt` → 44 itens (40 descritivos operacionais + 4 documentos genéricos).
  - ⚠️ **Só nome da empresa, sem ticker** (`link_title`: "ACCENTURE PLC", "AMEX", "BERKSHIRE", "HEWLETT PACKARD"…). O casamento nome→ticker é frágil: 30 de 44 nomes casam com o mapa curado do seed; ficam de fora "AMEX", "DUPONT DE DEMOURS", "HEWLETT PACKARD" (≠ HP Inc), além de nomes que não constam no mapa do seed (Heineken, Tesco, London Stock Exchange, Thomson Reuters, Barrick, Standard Chartered; podem ser programas sem negociação nos últimos 24 meses). **Recomendação:** usar a lista como detector de mudança (programa novo/removido gera alerta) e manter a atribuição de ticker em `config/overrides/depositarias.csv`.
- O site é consumido por JS do próprio Bradesco; o endpoint não é documentado e pode mudar sem aviso.

## 7. Itaú Securities Services

- Página: `https://www.itau.com.br/investmentservices/escrituracao/bdr` (a do prompt, `itau.com.br/securities-services/`, também retorna 403).
- ❌ **HTTP 403 "Access Denied"** (Akamai) para um cliente com `User-Agent` identificado. Reproduzido em duas URLs. **Não** foi tentado contornar com cabeçalhos de navegador (ver relatório).
- Conteúdo, segundo busca web: a página é institucional e remete a uma seção separada de "BDRs de programas não patrocinados"; não foi possível confirmar que haja lista de tickers.
- Implicação: o mapa `ITAU` do seed (11 programas) passa a ser **curadoria manual** em `overrides/depositarias.csv` até haver uma fonte acessível. São 11 programas no mapa `ITAU` do seed; o prompt (seção 14) cita 15 BDRs de depositária Itaú no seed, o restante vindo dos patrocinados da API B3.

---

## Quebra de contrato a monitorar

| fonte | o que pode quebrar | proteção |
|---|---|---|
| B3 Listadas | dupla codificação do `GetDetail`; mapa de `marketIndicator`; `typeBDR` | testes com fixtures; alerta de valor de `marketIndicator` desconhecido |
| FCA | colunas, encoding, múltiplas linhas por documento | schema das colunas + testes dos casos acima |
| COTAHIST | layout posicional; atraso da publicação | trailer `99`, largura 245, retry em 404 de dia útil |
| finservices | HTML Liferay | queda > 20% de itens bloqueia a publicação |
| Bradesco | API AEM não documentada | idem + fallback para overrides |
| Itaú | bloqueio anti-bot | só overrides manuais |

---

## Notas de implementação (Fases 2 e 3)

| tema | como ficou |
|---|---|
| Tickers de ações | `otherCodes[].code` do `GetDetail`, sem códigos com hífen (debêntures, como `PETR-DEB62`), em ordenação natural (`SANB3`, `SANB4`, `SANB11`). |
| Segmento | `marketIndicator` da lista da B3 (tabela em `config/sources.yaml`); detalhe vazio => `?`. Guardado também em `indicador_mercado`. |
| `GetDetail` em produção | Diário: companhias novas, alteradas na lista e o rodízio de 1/7 (`codigo_cvm % 7 == dia % 7`). Semanal (`--weekly`): todas. Quem não foi revisitado herda os dados da publicação anterior. |
| FCA | O ano corrente é verificado por `HEAD`/ETag; só o que mudou é baixado. Cada ano vira `data/history/fca/AAAA.csv.gz` (maior versão de cada documento, só as colunas necessárias, ~15 KB por ano). As regras estão no ADR 0003. |
| COTAHIST | Backfill pelos arquivos mensais `M` (os anuais `A` não foram usados: 89 MB cada, sem ganho em relação aos 12 mensais). Diário acumula na partição do mês; o mensal oficial a substitui e mede a diferença (alerta se > 0,5%). Um 404 em dia útil espera 3 dias antes de virar "sem pregão". |
| Volume | Em R$ inteiros (soma em centavos, arredondada por ticker e mês). `downloads/bdrs.csv` segue em R$ mil, como o seed. |
| Mês corrente | `volume_mes_parcial` por BDR e `mes_parcial` no cabeçalho; os 24 meses de `volume_mensal` são sempre meses fechados. |
| Depositária | API B3 (patrocinados **e ETFs**) > Banco B3 (finservices) > `config/overrides/depositarias.csv` > "Não identificado". O Bradesco só serve de detector de mudança (avisos no `run --weekly`). |
| finservices | `selectolax` (backend `lexbor`). Queda de mais de 20% nos itens mantém a lista anterior e avisa. |
| `meta.json` | Só guarda dados estáveis por fonte (status, contagem, último sucesso). Contadores por execução ficam de fora para que um dia sem mudança não gere commit; sem mudança, é regravado a cada 3 dias (batimento) para o site distinguir "sem novidade" de "fonte parada". |

## Rastreabilidade do volume (Fase 7)
Cada volume mensal de BDR publicado aponta para o arquivo oficial da B3 de onde foi obtido. O ETL grava em `data/public/bdrs.json`:
- `fontes_volume`: mês (`AAAA-MM`) → `{tipo, arquivos}`. `tipo: "mensal"` é o `COTAHIST_MMAAAA.ZIP` oficial (um arquivo); `tipo: "diario"` é o mês corrente, somado a partir dos `COTAHIST_DDMMAAAA.ZIP` já processados (um arquivo por pregão, em ordem). A origem vem da partição em `data/history/bdr_volume/` (`fonte` e `pregoes`), então o link sempre corresponde ao que foi de fato somado.
- `pagina_fonte`: página oficial de séries históricas da B3 (`https://www.b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/market-data/historico/mercado-a-vista/series-historicas/`), verificada em 2026-10-29 (HTTP 200, "Séries Históricas | B3").

No site, a barra do gráfico (`/bdrs/{ticker}`) e a célula do volume mensal na tabela (`/bdrs`) são links para o arquivo do mês; no mês parcial, que soma vários arquivos, o link vai à página oficial e os arquivos diários ficam listados no bloco "Fonte do volume e como conferir". Como reproduzir o número: no arquivo, somar `VOLTOT` (colunas 171 a 188, 2 casas implícitas) das linhas cujo `CODNEG` (colunas 13 a 24) é o ticker ou o ticker com `F`, com `TPMERC` (colunas 25 a 27) `010` ou `020`.

## COTAHIST de ações (Fase 7)
Os mesmos arquivos `COTAHIST_*` servem ao dataset `acoes_volume` (volume mensal das ações por companhia). Filtro: `TPMERC` `010`/`020`; `CODNEG` com 4 caracteres + final 3 a 8, com `B` opcional (séries, como `MRSA3B`) e `F` no fracionário; units (final 11) só com `ESPECI` iniciando em `UNT`, porque ETFs e FIIs também terminam em 11. Ficam de fora ETF/FII (`CI`), bonificação (`BNS`), direito (`DIR`), opções, termo e BDRs. Em 28/10/2026: 702 registros de 367 tickers de ações. Detalhes em `docs/decisoes/0004-cotahist-por-categoria.md`. A rastreabilidade do volume (seção anterior) vale também para ações.
