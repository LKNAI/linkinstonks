# Auditoria de design e direções (Etapas 1 a 4)

Estado: aguardando a escolha da direção (A ou B). Nada de código do site foi alterado.
Branch: `design/sistema-visual`. Capturas de antes: `docs/capturas/design/antes/` (11 rotas × 1440, 1024 e 390 px, 33 arquivos).

## 1. Resumo executivo

- O site funciona bem e tem boa base de acessibilidade (axe no CI, contrastes de texto já ajustados, `prefers-reduced-motion`, página de status). O que falta é **sistema**: só a cor tem tokens; tamanho, espaço, raio e sombra estão soltos.
- Números do inventário: 76 cores hex distintas (150 usos), 19 tamanhos de fonte (com meios-pixels como 10,5 e 12,5), 17 raios, 73 combinações de espaçamento. Quase tudo está em `dashboard.css` (1.671 linhas, 53 hex e 438 `px`).
- **Achado principal:** as cores de categoria colidem com as cores de banco. O verde de ETF (`#1BAF7A`) fica a ΔE 3,0 do verde da Oliveira Trust, e o azul de "Renda variável" a 3,9 do Mercantil. O validador de paleta aprova cada conjunto sozinho, mas não compara com as marcas.
- O destaque atual (`#6250D6`) fica a ΔE 7,6 do violeta da Vórtx e repete a cor de DRN. O degradê da capa termina em `#EC7000`, que é o laranja do Itaú Corretora.
- Com 20 cores de marca ocupando o círculo cromático, **não existe um conjunto categórico vibrante e seguro** (testei por busca). Daí as duas direções: **A** tira a cor das categorias (rampa de ameixa), **B** mantém cores de categoria e reduz as colisões.
- Passam do corte de ΔE 20 em relação a todas as marcas: olivas, marrons e verdes escuros (sem vibração; os verdes ainda ficam perto do verde "ok" de status, que é reservado) e, entre as cores vibrantes, só ameixa `#6D1D72` (20,2) e magenta `#CB0B98` (20,6).
- **Recomendação: A.** Resolve as colisões pela estrutura (cor saturada = instituição), tem o destaque mais legível (contraste 10,15) e usa uma família com algarismos tabulares por padrão.
- Bug concreto no celular: os KPIs de `/acoes/tabela` em 390 px viram cartões minúsculos com rótulos cortados ("e…", "c…").

## 2. Etapa 1: reconhecimento

### Capturas
Todas as rotas em 1440, 1024 e 390 px, página inteira, sem rolagem horizontal da página em nenhuma delas (medido em cada captura). Nomes no formato `rota-largura.png`. Para detalhes: `acoes/9512` (Petrobras) e `bdrs/AAPL34`.

### Inventário de valores (app, components, lib)

| categoria | valores distintos | usos | observação |
|---|---|---|---|
| cor hex | 76 | 150 | 53 em `dashboard.css`; `#6250d6` aparece 11 vezes |
| `rgba()` | 14 | 14 | inclui brilho verde e sombra preta |
| tamanho de fonte | 19 | 74 | de 9,5 a 30 px; 12,5 px é o mais usado (16×) |
| raio | 17 | 50 | de 3 a 14 px, mais 999 e 50% |
| sombra | 6 | 8 | só 1 usa token |
| transição | 11 | 11 | de 0,12 s a 0,45 s |
| espaçamento (padding, margin, gap) | 73 | 157 | muitos valores fora da grade de 4 px (3, 5, 6, 7, 10, 14, 18) |
| peso de fonte | 4 | 56 | 800 usado 8 vezes (fora de 400–700) |
| espaçamento entre letras | 6 | 13 | 0,06 a 0,08 em caixa alta |

Já existe: 12 variáveis de cor em `globals.css`, `tabular-nums` em 14 regras, `position: sticky` no filtro e nas tabelas, `prefers-reduced-motion`.

### Estimativa de migração para tokens
- `dashboard.css` (1.671 linhas): 53 hex, 14 `rgba()` e 438 `px` literais. Em ordem de risco: cores, tamanhos de fonte (74 declarações), raios (50), espaçamentos (157 declarações), sombras e transições (19). Estimativa: um tema por commit, cerca de 6 commits só nesta fase.
- `globals.css`: 12 variáveis de cor para renomear para nomes de função (`--text-muted`, `--surface-raised`) e 2 fontes.
- Componentes `.tsx`: `TabelaAcoes.tsx` tem 5 hex; o restante dos literais de cor está em `lib/colors.ts` (gerado do YAML) e `lib/palette.ts`.
- Risco principal: os e2e e o axe dependem de classes e textos; as mudanças devem manter classes ou ajustar só seletores.

## 3. Etapa 2: auditoria (12 dimensões, nota de 0 a 3)

| # | dimensão | nota | evidência |
|---|---|---|---|
| 1 | tokens e consistência | 1 | só cor tem token (`globals.css`); 19 tamanhos, 17 raios e 73 espaçamentos soltos em `dashboard.css` |
| 2 | hierarquia e layout | 1 | capa e painéis em cartões idênticos, mesma sombra e raio (`home-1440`, `bdrs-1440`, `acoes-1440`); seis KPIs do mesmo peso |
| 3 | tipografia | 1 | meios-pixels (10,5; 11,5; 12,5; 13,5; 14,5), peso 800, rótulos de tabela em caixa alta com 0,06em; Jakarta é larga e dígitos só ficam tabulares com `tnum` ligado |
| 4 | cor e contraste | 1 | colisões categoria × marca (seção 5); destaque a ΔE 7,6 da Vórtx; gradiente da capa termina na cor do Itaú; texto sobre o azul do Mercantil por pouco abaixo de 4,5 (4,497) |
| 5 | gráficos | 2 | SVG próprio, donut com total no centro, barras ordenadas, "Ver como tabela" em todos; legenda clicável e tamanho dos rótulos de eixo ainda não verificados |
| 6 | tabelas | 2 | cabeçalho fixo, ordenação com seta, números à direita, ponto de cor; linhas de cerca de 57 px na tabela de ações e ticker em chip (`acoes-1440`) |
| 7 | estados | 1 | 10 ocorrências de `:focus-visible`; skeleton genérico (`.skeleton` em `Pagina.tsx`, 2 blocos fixos) em vez do formato real |
| 8 | responsividade em 390 px | 1 | sem rolagem horizontal, mas KPIs com rótulo cortado em `/acoes/tabela` e filtros em 4 selects empilhados (`acoes-tabela-390`); só 2 breakpoints (640 e 1180) |
| 9 | acessibilidade | 2 | axe no CI, contrastes de texto ajustados em `globals.css`, reduced-motion presente; falta auditar foco e rótulos dos gráficos tela a tela |
| 10 | movimento e efeitos | 1 | brilho radial branco e glow verde (`rgba(125,255,200,.25)`) no selo da capa; sombra preta; barras animando 0,4–0,45 s |
| 11 | microcopy em pt-BR | 2 | claro e específico; inconsistência "Capa" (menu) × "Início" (breadcrumb); rótulos de KPI com prefixo ("Ações · Empresas no filtro") |
| 12 | confiança | 2 | rodapé com data em todas as páginas, página de status, selos "B3 e CVM concordam", bloco "Fonte do volume"; os KPIs da capa não mostram fonte própria |

Total: 17 de 36.

### Problemas por severidade

| severidade | problema | esforço |
|---|---|---|
| crítica | categorias de ETF e segmento confundíveis com cores de banco (ΔE 3,0 e 3,9) | médio |
| alta | destaque a ΔE 7,6 de uma marca e igual à cor de DRN | baixo |
| alta | sem tokens de tamanho, espaço, raio e sombra: impede qualquer ajuste consistente | alto |
| alta | gradiente da capa usa a cor do Itaú e sugere uma instituição que não é | baixo |
| média | KPIs cortados em 390 px; filtros sem sheet inferior | médio |
| média | 19 tamanhos de fonte e rótulos em caixa alta espaçada | médio |
| média | skeleton sem o formato real do conteúdo | baixo |
| média | brilhos e sombra preta (glow verde, radial branco) | baixo |
| baixa | "Capa" × "Início"; prefixos nos rótulos de KPI | baixo |
| baixa | linhas da tabela de ações com 57 px (meta: 40 px, compacta 32 px) | médio |

### Ondas
1. Correções críticas: paleta das categorias e destaque.
2. Fundação: `tokens.css`, escala tipográfica, componentes base e `/design`.
3. Telas: `/bdrs`, `/acoes`, `/acoes/tabela`, `/`, detalhes, `/instituicoes`, `/novidades`, `/status`, `/sobre`.
4. Polimento: estados, skeleton, microcopy, sheet de filtros no celular.

## 4. Tipografia: amostras e recomendação

Amostras com dados reais (os 20 BDRs de maior volume em 24 meses, KPI e título), em `docs/capturas/design/tipografia/`. Medição objetiva: largura de `1111111,11` × `0000000,00` com e sem `tabular-nums`.

| família | origem | dígitos tabulares com `tnum` | tabulares mesmo sem `tnum` | leitura em 13 px na amostra |
|---|---|---|---|---|
| Plus Jakarta Sans | atual | sim | **não** (72,1 × 137,5) | larga, tom amigável |
| IBM Plex Sans | skill | sim | **sim** | nítida, `1` e `l` distintos, tom técnico |
| Source Sans 3 | skill | sim | **sim** | compacta, parece menor no mesmo tamanho |
| Figtree | skill | sim | **não** (78,5 × 119,5) | geométrica e redonda |
| Hanken Grotesk | sugestão | sim | **sim** | neutra e moderna, um pouco mais estreita |

Acentuação (ã, ç, é, õ, í, ú, â, ê, ô, à) renderizou corretamente nas cinco com o subset `latin`; `latin-ext` não é necessário.

**Recomendação:** IBM Plex Sans para a direção A (com IBM Plex Mono só nos tickers e CNPJ, se a mono for mantida) e Hanken Grotesk para a B. A escolha pesa a favor das duas por tabulares por padrão: se alguma regra de CSS esquecer o `tnum`, os números continuam alinhados.

### Escala (as duas direções)

| token | tamanho / entrelinha | peso | uso |
|---|---|---|---|
| `--fs-xs` | 12 / 16 | 400–500 | eixo de gráfico, nota de rodapé |
| `--fs-sm` | 13 / 18 | 400–500 | célula, legenda, chip, cabeçalho de tabela |
| `--fs-md` | 14 / 20 | 400–500 | texto de interface |
| `--fs-lg` | 16 / 24 | 400 | texto corrido (`/sobre`) |
| `--fs-xl` | 20 / 28 | 600 | título de seção |
| `--fs-2xl` | 24 / 32 | 600 | título de página |
| `--fs-kpi` | 36 / 40 | 600–700 | KPI principal |

Pesos: 400, 500, 600 e 700. Espaçamento entre letras: −0,015em a partir de 24 px, 0 no restante, sem caixa alta espaçada. Texto corrido com até 72 caracteres por linha.

## 5. Cores: validações

### 5.1 Colisões atuais: categoria × marca (ΔE2000; abaixo de 12 confunde lado a lado)

| categoria atual | marca mais próxima | ΔE |
|---|---|---|
| ETF (`#1BAF7A`) e segmento B | Oliveira Trust `#00A86B` | **3,0** |
| Renda variável `#2A78D6` | Mercantil `#2F80ED` | **3,9** |
| DRN `#6250D6` | Vórtx `#7B2FF7` | 7,6 |
| Patrocinado e segmento SO `#EDA100` | Itaú Unibanco `#F7A04B` | 8,9 |
| Segmento NM `#4A3AA7` | BTG `#0B3D91` | 9,3 |
| Renda fixa e segmento MP `#E87BA4` | Bradesco CTVM `#E8607A` | 9,6 |

O validador do `dataviz` aprova a paleta atual de tipo de BDR (CVD pior caso ΔE 9,1; contraste 2,82 e 2,17 sobre branco exigem rótulo visível). Ele não compara com as marcas.

### 5.2 Cor de destaque: distância às 21 cores de instituição (ΔE2000, critério ≥ 20)

| destaque | hex | menor ΔE | marca mais próxima | 2ª mais próxima | contraste sobre branco |
|---|---|---|---|---|---|
| atual | `#6250D6` | 7,6 | Vórtx | Própria empresa (13,7) | 5,77 |
| **A: ameixa** | `#6D1D72` | **20,2** | Vórtx | Banco do Nordeste (20,2) | 10,15 |
| **B: magenta** | `#CB0B98` | **20,6** | Bradesco CTVM | Vórtx (20,7) | 5,20 |

Busca por força bruta (matiz, saturação e luminosidade) com contraste ≥ 4,5: os maiores ΔE são olivas e marrons escuros (até 34,5), sem vibração. Excluí também os verdes, que ficam perto do verde "ok" de status (reservado). Nas demais famílias de matiz (magenta, ameixa, azul, vermelho), só ameixa (20,2) e magenta (20,6) passam de 20; o azul chega a 10,7 e o vermelho a 13,9.

### 5.3 Cores de marca: contraste e texto automático

Fonte: `config/instituicoes.yaml`, sem alteração. O texto sobre a cor é escolhido entre tinta `#16192B` e branco, o que der mais contraste. Calculado no build por `gen-colors.mjs`.

| instituição | cor | marca sobre branco (meta 3) | texto | contraste do texto |
|---|---|---|---|---|
| itau-corretora | `#EC7000` | 3,05 | escuro | 5,70 |
| itau-unibanco | `#F7A04B` | 2,08 ⚠ | escuro | 8,35 |
| bradesco-ctvm | `#E8607A` | 3,29 | escuro | 5,29 |
| banco-bradesco | `#CC092F` | 5,76 | claro | 5,76 |
| btg-pactual | `#0B3D91` | 10,04 | claro | 10,04 |
| banco-do-brasil | `#F2C200` | 1,68 ⚠ | escuro | 10,34 |
| banco-santander | `#FF3B30` | 3,55 | escuro | 4,90 |
| banco-opportunity | `#334155` | 10,35 | claro | 10,35 |
| brb-dtvm | `#0EA5E9` | 2,77 ⚠ | escuro | 6,27 |
| id-ctvm | `#14B8A6` | 2,49 ⚠ | escuro | 6,98 |
| banco-mercantil-do-brasil | `#2F80ED` | 3,87 | escuro | **4,497 ⚠** |
| banco-do-nordeste | `#8E1B3A` | 8,87 | claro | 8,87 |
| oslo-capital-dtvm | `#94A3B8` | 2,56 ⚠ | escuro | 6,78 |
| oliveira-trust | `#00A86B` | 3,08 | escuro | 5,64 |
| vortx-dtvm | `#7B2FF7` | 5,85 | claro | 5,85 |
| banrisul | `#00579C` | 7,39 | claro | 7,39 |
| banco-safra | `#B8962E` | 2,82 ⚠ | escuro | 6,16 |
| banco-b3 | `#0B7FA6` | 4,56 | claro | 4,56 |
| propria-empresa | `#5B6B82` | 5,43 | claro | 5,43 |
| nao-informado | `#D3D2DE` | 1,50 ⚠ | escuro | 11,62 |
| nao-identificado | `#B9B8C7` | 1,95 ⚠ | escuro | 8,89 |

Leitura: as marcas com ⚠ na coluna "sobre branco" (contraste de marca abaixo de 3:1) **nunca** podem ser a única pista: valem o ponto com o nome ao lado, o rótulo direto e a legenda, como a skill já manda. O Mercantil com texto escuro fica a 0,003 do mínimo; se for usado como preenchimento com texto, o texto vira branco com 3,87 (só vale para texto grande) ou o texto não vai sobre a cor.

### 5.4 Pares de marca parecidos: daltonismo (Machado 2009, severidade 1,0; ΔE2000)

| par | normal | protan | deutan | tritan |
|---|---|---|---|---|
| Bradesco × Santander (`#CC092F` / `#FF3B30`) | 15,1 | 13,9 | 14,1 | **8,0** |
| Itaú Corretora × Itaú Unibanco (`#EC7000` / `#F7A04B`) | 12,3 | 12,5 | **9,0** | 11,4 |
| Bradesco × Bradesco CTVM (`#CC092F` / `#E8607A`) | 18,7 | 21,6 | 16,9 | 16,3 |

Variante derivada em código (a cor base do YAML não muda), aplicada só quando os dois do par aparecem no mesmo gráfico, com meta de ΔE normal ≥ 15 e pior daltonismo ≥ 10:

| par | membro ajustado | base | variante | ΔE normal | pior daltonismo |
|---|---|---|---|---|---|
| Bradesco × Santander | Santander | `#FF3B30` | `#FF493E` | 16,0 | 10,2 |
| Itaú Corretora × Itaú Unibanco | Itaú Unibanco | `#F7A04B` | `#F8AB5F` | 15,1 | 11,2 |
| Bradesco × Bradesco CTVM | nenhum | | | 18,7 | 16,3 |

As variantes são passos pequenos. Mesmo com elas, o rótulo direto continua obrigatório.

### 5.5 Contraste dos tokens de cada direção (WCAG 2.2 AA)

Todos os pares abaixo passam: texto ≥ 4,5, bordas de controle ≥ 3.

| par | A | B |
|---|---|---|
| texto sobre superfície | 17,34 | 17,63 |
| texto atenuado | 7,60 (6,96 no fundo) | 8,03 (7,42 no sunken) |
| texto discreto | 5,87 (5,38 no fundo) | 6,02 (5,56 no sunken) |
| destaque como link | 10,15 (9,30 no fundo) | 5,20 (4,80 no sunken) |
| texto branco sobre destaque | 10,15 | 5,20 |
| borda de controle `#8993A8` | 3,09 | 3,09 |
| ok `#0A7A50`, erro `#C62A28`, alerta `#8A5B00` sobre `#FFF6E0` | 5,37; 5,58; 5,45 | os mesmos |

### 5.6 Categorias de cada direção

**A: rampa ameixa para o que não é instituição.** Validador `--ordinal`: luminosidade monótona, passos de ΔL ≥ 0,06, extremo claro com contraste 3,16, matiz único (todos PASS).

| papel | hex |
|---|---|
| passo 1 (mais escuro) | `#5A265E` |
| passo 2 | `#99419F` |
| passo 3 | `#C175C7` |
| "sem dados" e "sem categoria" | neutro `#C9CFDB` (nunca ameixa) |

Uso: tipo de BDR (3 classes), segmentos NM > N2 > N1 (ordenados por nível de governança) e classes de ETF. Limite desta abordagem: validei 3 passos. Quatro classes de ETF exigem um 4º passo, que preciso validar na implementação; se não passar, a 4ª classe usa o neutro com rótulo.

**B: categorias com cor, afastadas das marcas.** Conjunto testado no validador categórico (todos PASS, exceto aviso de contraste do verde sobre branco, que exige rótulo visível):

| papel | hex | menor ΔE a uma marca | marca mais próxima |
|---|---|---|---|
| categoria 1 | `#2DA2B4` | 14,2 | Banco B3 `#0B7FA6` |
| categoria 2 | `#A5560E` | 16,7 | Itaú Corretora `#EC7000` |
| categoria 3 | `#7FA800` | 19,1 | Safra `#B8962E` |
| categoria 4 | `#6B5BD2` | **9,8** | Vórtx `#7B2FF7` |

Pior caso cai de ΔE 3,0 (hoje) para 9,8, mas **não** fica acima de 12. A colisão residual com a Vórtx só afeta gráficos em que as duas apareçam juntas.

## 6. Direção A: "Livro-razão"

Ideia: o site é um instrumento de leitura de números. Tudo que é cor saturada é uma instituição; o resto é tinta, ameixa e cinza-azulado.

### Paleta

| token | hex | papel |
|---|---|---|
| `--bg` | `#F3F5F9` | fundo da página |
| `--surface` | `#FFFFFF` | painéis e tabelas |
| `--surface-sunken` | `#E9EDF4` | cabeçalho de tabela, campos |
| `--border` | `#DCE1EB` | filete padrão |
| `--border-strong` | `#8993A8` | borda de controle (3,09) |
| `--text` | `#141A2A` | texto |
| `--text-muted` | `#4A5469` | texto atenuado |
| `--text-subtle` | `#5B6578` | rótulos e notas |
| `--accent` | `#6D1D72` | links, foco, seleção, ação principal |
| `--accent-hover` | `#561659` | hover e ativo |
| `--accent-soft` | `#F4E9F5` | fundo de seleção |
| `--ok`, `--warn`, `--error`, `--stale` | `#0A7A50`, `#8A5B00`, `#C62A28`, `#5B6578` | só status de dados |
| categorias | ver 5.6 | rampa ameixa |
| instituições | `config/instituicoes.yaml` | única fonte |

### Tipografia
IBM Plex Sans (400, 500, 600, 700) com `tabular-nums` em tabelas, KPIs, eixos e tooltips. IBM Plex Mono só em tickers e CNPJ. Escala da seção 4.

### Espaço, raio, elevação, efeitos
- Grade de 4 px (4, 8, 12, 16, 20, 24, 32, 40, 48, 64). Container 1440 px; gutter 16/24/32 px. Entre seções 40 px; dentro de um grupo 12 a 16 px.
- Raio: 4 px em chip, input e badge; 8 px em botão e painel; 12 px em sheet e modal; 0 em tabela.
- Elevação: borda de 1 px (padrão); sombra suave em tooltip e popover; sombra média em modal. Sombras tingidas com a tinta do texto, não com preto.
- Estados: hover escurece a superfície 1 passo; foco com anel de 2 px ameixa e 2 px de afastamento; ativo usa `--accent-hover`; desabilitado a 45% com cursor padrão.
- Ênfase em gráficos: item em hover mantém a cor e os demais caem para 35%. Seleção com contorno de foco e chip removível no topo.
- Transições de 150 ms (ease-out), só em resposta a ação.
- Skeleton com o formato real: linha de KPI, barras de ranking, linhas de tabela.
- **Degradê:** só o de área sob série temporal (cor da série de 16% a 0%). **Nenhum na capa**: a função da capa é informar, e o gradiente atual evoca o Itaú.

### Princípios
1. Cor saturada significa instituição. Nada mais usa cor saturada.
2. Hierarquia por espaço e tipografia antes de caixas: o painel com borda só existe quando agrupa gráfico e controle.
3. Todo número alinhado e tabular, com fonte e data ao alcance.
4. Um indicador principal por tela, os demais em segundo plano.
5. Movimento só como resposta.

### Ponto memorável
**A régua de marcas:** uma faixa de 4 px no topo de cada página mostra, com dado real e cores de banco, quem escritura as ações (em `/acoes` e `/`) ou quem é depositária dos BDRs (em `/bdrs`). É plana, sem degradê, e substitui o fundo roxo-laranja da capa.

### Wireframes

`/` no desktop (1440):
```
┌────────────────────────────────────────────────────────────────────────────┐
│ [logo] linkinstonks   Ações  Tabela  Volume  BDRs  Instituições  Novidades │ 48px
├────────────────────────────────────────────────────────────────────────────┤
│██████████████ Itaú ██████ BTG ████ Bradesco ██ ▒ ░░  (régua de marcas, 4px)│
│                                                                            │
│ Escrituradores de ações e depositárias de BDRs         Dados de 29/10/2026 │
│ Quem escritura cada ação listada na B3 e qual banco é depositário          │
│ de cada BDR, com histórico de trocas e volume mensal.                      │
│                                                                            │
│ 568         427            39,3%         1.152       R$ 538 bi    61,5%    │
│ empresas    com histórico  trocaram      BDRs        em 24 meses  Banco B3 │
│ (36px)      (24px, separados por filete de 1px, sem cartões)               │
│                                                                            │
│ Começar por                  │ Fontes e atualização    │ Últimas mudanças  │
│  Ações: escrituradores       │ B3 · BDRs (API)  29/10  │ Nenhuma mudança   │
│  Tabela completa de ações    │ B3 · COTAHIST    29/10  │ registrada ainda  │
│  BDRs: depositárias, volume  │ ...                     │                   │
└────────────────────────────────────────────────────────────────────────────┘
```

`/` no celular (390):
```
┌──────────────────────────┐
│ [logo]            [menu] │
│▓▓▓▓▓▓▓▓ ▓▓▓▓ ▓▓ ▒ ░ (4px)│
│ Escrituradores de ações  │
│ e depositárias de BDRs   │
│ Dados de 29/10/2026      │
│ 568  empresas            │
│ ─────────────────────    │
│ 427  com histórico       │
│ 39,3%  trocaram          │
│ 1.152  BDRs   (lista de  │
│ R$ 538 bi  indicadores,  │
│ 61,5%  Banco B3  1 col.) │
│ Começar por ...          │
└──────────────────────────┘
```

`/bdrs` no desktop (1440):
```
┌────────────────────────────────────────────────────────────────────────────┐
│ [nav]                                                                      │
│██████████████ Banco B3 61,5% ███████ Bradesco ████ Itaú ▒ (régua)         │
│ BDRs na B3: quem emite e quanto negocia                    Out/24 a set/26 │
│ 1.152 BDRs │ R$ 538 bi │ R$ 34 bi set/26 │ ▲ 55% │ 61,5% B3 │ TSLA34     │
│ [Buscar ticker, empresa, ETF, ISIN ou depositária…] (Todas|Negociadas|Sem) │
│ ┌──────────────────────────────────────────────┐ ┌───────────────────────┐ │
│ │ Volume financeiro mensal      [Ver como tabela]│ │ Volume por depositária│ │
│ │ colunas empilhadas, 3 passos de ameixa         │ │ donut + total no centro│ │
│ └──────────────────────────────────────────────┘ └───────────────────────┘ │
│  Ranking por volume (barras na cor da depositária)   Concentração do volume│
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ Todos os BDRs (cabeçalho fixo, 40px por linha, números à direita)      │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```

`/bdrs` no celular (390):
```
┌──────────────────────────┐
│ [logo]            [menu] │
│▓▓▓▓▓▓▓▓▓ ▓▓▓ ▓▓ ▒ (régua)│
│ BDRs na B3               │
│ 1.152 BDRs               │
│ R$ 538 bi em 24 meses    │
│ [Buscar…]   [Filtros ▾]  │  filtros abrem num sheet inferior
│ Volume mensal            │
│ [colunas]  Ver como tabela│
│ Volume por depositária   │
│ [donut] legenda embaixo  │
│ Ranking (barras)         │
│ Tabela: 1ª coluna fixa,  │
│ rolagem horizontal só    │
│ dentro do container      │
└──────────────────────────┘
```

## 7. Direção B: "Abertura de pregão"

Ideia: um painel editorial e arejado, sem caixas. Número grande, dado desenhado e muito espaço; as cores continuam sendo dos bancos, mas as categorias também têm cor.

### Paleta

| token | hex | papel |
|---|---|---|
| `--bg` | `#FFFFFF` | fundo da página |
| `--surface-sunken` | `#F4F6FA` | faixas de seção, campos |
| `--border` | `#E1E5EE` | filete |
| `--border-strong` | `#8993A8` | borda de controle (3,09) |
| `--text` | `#12182B` | texto |
| `--text-muted` | `#46506A` | atenuado |
| `--text-subtle` | `#59637A` | rótulos |
| `--accent` | `#CB0B98` | links, foco, seleção, ação principal |
| `--accent-hover` | `#A8087E` | hover e ativo |
| `--accent-soft` | `#FCE8F6` | fundo de seleção |
| status | `#0A7A50`, `#8A5B00`, `#C62A28`, `#59637A` | só dados |
| categorias | ver 5.6 | 4 cores validadas |

### Tipografia
Hanken Grotesk (400, 500, 600, 700), `tabular-nums` nos números. Sem monoespaçada: tickers em peso 600 com a mesma família. Escala da seção 4.

### Espaço, raio, elevação, efeitos
- Grade de 4 px; seções separadas por 48 a 64 px e um filete de 1 px; sem cartões. Container 1440 px.
- Raio: 4 px em chip, input e badge; 8 px em botão; 12 px em sheet e modal; 0 em tabela e painéis (painéis não existem, só faixas).
- Elevação: só filete, mais sombra em tooltip e modal.
- Estados e ênfase em gráficos como em A (foco magenta de 2 px).
- Transições de 150 ms; skeleton no formato real.
- **Degradê:** só o de área sob série. Nenhum na capa.

### Princípios
1. Menos caixas, mais espaço: o conteúdo é o desenho.
2. Um número grande por tela e uma faixa de dados que o explica.
3. A cor de destaque é rara: só em ações e foco.
4. Categorias têm cor, mas sempre com rótulo direto.
5. Tabelas largas e respiradas, com o ponto de cor da instituição.

### Ponto memorável
**A faixa de composição na capa:** uma barra de largura total, na escala real, em cores de banco, com rótulos diretos (Itaú 51,2%, BTG 20,6%, Bradesco 20,1%…). Ela é o herói da capa no lugar do fundo roxo-laranja.

### Wireframes

`/` no desktop (1440):
```
┌────────────────────────────────────────────────────────────────────────────┐
│ [logo] linkinstonks    Ações  Tabela  Volume  BDRs  Instituições  Sobre    │
│                                                                            │
│ 568 empresas, 1.152 BDRs                                                   │
│ (número de 36px, sem cartão)           Dados de 29/10/2026                 │
│ Quem escritura cada ação listada na B3 e qual banco é depositário…         │
│                                                                            │
│ Itaú 51,2% ████████████████│ BTG 20,6% ████│ Bradesco 20,1% ████│▒ ░       │
│ (faixa de composição, 24px de altura, escala real, rótulos diretos)        │
│                                                                            │
│ ─────────────────────────────────────────────────────────────────────────  │
│ 427 com histórico   39,3% trocaram   R$ 538 bi em 24 meses   61,5% Banco B3│
│                                                                            │
│ Painéis                       Fontes e atualização        Últimas mudanças │
└────────────────────────────────────────────────────────────────────────────┘
```

`/` no celular (390):
```
┌──────────────────────────┐
│ [logo]            [menu] │
│ 568 empresas             │
│ 1.152 BDRs               │
│ Dados de 29/10/2026      │
│ ██████ ███ ██ ▒ (faixa)  │
│ Itaú 51,2% · BTG 20,6%   │
│ ──────────────────────   │
│ 427  com histórico       │
│ 39,3%  trocaram          │
│ R$ 538 bi  24 meses      │
└──────────────────────────┘
```

`/bdrs` no desktop (1440):
```
┌────────────────────────────────────────────────────────────────────────────┐
│ [nav]                                                                      │
│ R$ 538 bi em 24 meses                       1.152 BDRs · ▲ 55% em 12 meses │
│ Banco B3 61,5% ████████████████████│ Bradesco 28,2% ██████│ Itaú 10,1% ██ │
│ [Buscar…]  (Todas | Negociadas em set/26 | Sem negócios)                   │
│ ─────────────────────────────────────────────────────────────────────────  │
│ Volume mensal por tipo                         Concentração do volume      │
│ [colunas empilhadas, 4 cores]                  10,1% / 41,2% / 63,6%       │
│ ─────────────────────────────────────────────────────────────────────────  │
│ Ranking por volume (barras na cor da depositária)                          │
│ ─────────────────────────────────────────────────────────────────────────  │
│ Todos os BDRs (tabela larga, 40px por linha, cabeçalho fixo)               │
└────────────────────────────────────────────────────────────────────────────┘
```

`/bdrs` no celular (390):
```
┌──────────────────────────┐
│ R$ 538 bi                │
│ 1.152 BDRs · ▲ 55%       │
│ ████████ ████ ██ (faixa) │
│ [Buscar…]    [Filtros ▾] │
│ Volume mensal [Ver tabela]│
│ Ranking (barras)         │
│ Tabela com 1ª coluna fixa│
└──────────────────────────┘
```

## 8. Etapa 4: autocrítica

### Contra "um dashboard qualquer"
| vício (das duas skills) | A | B |
|---|---|---|
| cartões idênticos, mesma sombra e raio | evita: borda de 1 px, painel só quando agrupa controle | evita: sem cartões |
| KPI "número grande + rótulo + degradê" em fileira | evita: um KPI maior e os demais em segundo plano, sem degradê | evita: um número herói e linha de apoio |
| rótulos em caixa alta espaçada | evita: cabeçalhos de tabela em `--fs-sm` peso 500 | evita |
| uma palavra do título em outra cor | não usa | não usa |
| "→" no fim de links | não usa | não usa |
| numeração 01/02/03 | não usa | não usa |
| fundo creme com terracota; escuro com verde-ácido | não: neutros frios, ameixa | não: branco, magenta |
| cor de alarme para identidade de série | não | não |
| monoespaçada em rótulos genéricos | só tickers e CNPJ | não usa monoespaçada |
| degradê decorativo | nenhum na capa | nenhum na capa |

### O que revisei depois da primeira versão e por quê
1. **Troquei o destaque.** Comecei pensando num violeta ou verde-azulado, como a skill sugere. A medição mostrou que ambos já pertencem a marcas (Vórtx, ID CTVM). Ficaram ameixa e magenta, os únicos vibrantes acima de ΔE 20.
2. **Abandonei "categorias minerais" em B.** A busca gulosa devolveu verde-limão com contraste 1,3 e marrom que reprova o piso de croma. Mantive um conjunto fechado e validado, e disse que o pior caso é ΔE 9,8, não 12.
3. **Tirei o degradê da capa nas duas.** A skill permitia um. O fundo atual termina na cor do Itaú, o que atribui à capa uma identidade que ela não tem.
4. **Restringi a busca do destaque a cores vibrantes.** O critério de ΔE ≥ 20 sozinho elege olivas e marrons escuros, que não servem como cor de ação.
5. **Expliquei o limite de A.** A rampa ameixa foi validada com 3 passos; 4 classes de ETF dependem de um 4º passo ainda não validado.

### Riscos de cada direção
- **A:** menos "colorida" nas categorias. Risco de parecer sóbria demais para quem espera cor; compensado porque as marcas, que são as cores com função, ficam em destaque.
- **B:** magenta chama mais atenção que as marcas vermelhas e rosa (Bradesco, CTVM, Santander); as categorias ainda têm uma colisão residual (ΔE 9,8) e o layout sem caixas muda mais a estrutura de todas as telas.

### Recomendação: A
Resolve a colisão categoria × marca pela regra e não por ajuste fino, tem o melhor contraste de destaque (10,15 contra 5,20) e usa IBM Plex Sans, cujos números são tabulares mesmo sem `tnum`. B é a opção de mais ousadia visual, com mais retrabalho de layout.

## 9. Decisões que dependem de você

1. Direção: A, B ou uma mistura (por exemplo, paleta de A com o layout sem caixas de B).
2. Se escolher A: aceitar que as categorias (tipo de BDR, segmento, classe de ETF) deixem de ter cor própria e usem a rampa ameixa, com o neutro para "sem dados".
3. Se escolher B: aceitar a colisão residual de ΔE 9,8 entre a categoria 4 e a Vórtx.
4. Nenhuma mudança em `config/instituicoes.yaml` foi proposta. As variantes de Santander e Itaú Unibanco são derivadas em código e só valem quando o par aparece junto.
