---
name: design-painel-b3
description: Sistema de design e revisão visual do Painel B3 (dashboards de escrituradores e BDRs). Use em qualquer trabalho de interface do projeto: tipografia, cores, espaçamento, gráficos, tabelas, efeitos e auditoria de design.
---

# Design do Painel B3

Você atua como líder de design de produto de dados e engenheiro(a) de front-end sênior. O produto é um painel público de **dados de mercado de capitais**: escrituradores de ações e BDRs da B3. Quem usa são analistas, profissionais de RI, custodiantes, bancos e investidores. São pessoas que comparam números, filtram muito e precisam confiar na origem de cada dado.

"Profissional", aqui, significa: **hierarquia clara, tipografia disciplinada, cor com função e acabamento consistente.** Não significa mais efeitos.

Esta skill complementa a skill `frontend-design`, que cuida da direção estética e de evitar o visual genérico. Quando houver conflito, as regras específicas daqui vencem, porque são deste produto.

## Fontes da verdade no repositório

Leia antes de mexer em qualquer tela:

- `web/styles/tokens.css`: todos os tokens. Se o arquivo não existir, crie-o a partir da seção "Valores de partida".
- `config/instituicoes.yaml`: cores de marca das instituições. É a única fonte dessas cores.
- `docs/design-system.md`: decisões registradas.
- `docs/paridade.md`: o que os dashboards do seed já fazem.
- `seed/html/*.html`: a referência visual original.
- A rota `/design` (catálogo interno, fora do sitemap): mostra tokens, tipografia, cores e componentes com todos os estados.

Regra: **nenhum valor literal de cor, tamanho de fonte, espaçamento, raio ou sombra fora de `tokens.css`.** Componentes usam só tokens semânticos (`--text-muted`, `--surface-raised`), nunca hex direto.

## Processo (sempre nesta ordem)

1. **Reconhecer.** Tire capturas da tela atual em 1440, 1024 e 390 px (Playwright) e liste o que existe.
2. **Propor.** Antes de escrever código, produza uma proposta compacta:
   - tokens que mudam;
   - tipografia;
   - wireframe ASCII da tela no desktop e no celular;
   - de 3 a 5 princípios.
3. **Autocrítica.** Compare a proposta com o que você faria para "um dashboard qualquer". Revise o que soar padrão (ver "Vícios proibidos") e diga o que mudou e por quê.
4. **Aprovação.** Mostre a proposta e espere aprovação quando a mudança for de direção: paleta, família tipográfica, layout de uma tela inteira. Ajustes dentro do sistema não precisam de aprovação.
5. **Construir.** A ordem é tokens → componentes base → telas. Faça um tema por commit.
6. **Verificar.** Repita as capturas, compare antes e depois e rode a lista de verificação do final desta skill.

## Valores de partida

São um ponto de partida, não um dogma. Ajuste pelo processo acima e registre a decisão em `docs/design-system.md`.

### Tipografia

- **Uma família principal** para interface e números, com algarismos tabulares (`tnum`), Latin Extended (ã, ç, é), pesos variáveis e licença aberta. Lista curta para avaliar: Plus Jakarta Sans (a atual), IBM Plex Sans, Source Sans 3, Public Sans, Figtree. Teste cada uma numa tabela real com 20 linhas de valores em R$ antes de escolher.
- **Segunda família só se tiver papel claro e for bem diferente**, por exemplo nos títulos de página. Monoespaçada só para tickers, se ajudar a leitura (alinhamento de códigos); nunca para rótulos genéricos.
- Carregue com `next/font`, com subset `latin` + `latin-ext` e `display: swap`.
- **Escala** (base de 14 px para interface densa e 16 px para texto corrido; razão de cerca de 1,2):

  | token | tamanho / entrelinha | uso |
  |---|---|---|
  | `--fs-xs` | 12 / 16 | eixo de gráfico, nota de rodapé |
  | `--fs-sm` | 13 / 18 | célula de tabela, legenda, chip |
  | `--fs-md` | 14 / 20 | texto de interface padrão |
  | `--fs-lg` | 16 / 24 | texto corrido (`/sobre`) |
  | `--fs-xl` | 20 / 28 | título de seção |
  | `--fs-2xl` | 24 / 32 | título de página |
  | `--fs-kpi` | 32–40 / 1,1 | número de KPI |

- **Pesos:** só 400, 500, 600 e 700. Títulos em 600, KPIs em 600 ou 700, rótulos em 500.
- **Espaçamento entre letras:** −0,01 a −0,02 em a partir de 24 px; 0 no restante. Sem caixa alta espaçada.
- `font-variant-numeric: tabular-nums` em tabelas, KPIs, eixos e tooltips. Números alinhados à direita nas tabelas.
- Texto corrido com até 72 caracteres por linha.

### Espaçamento e layout

- Grade de 4 px: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.
- Container de até 1440 px. Gutter de 16 px no celular, 24 px no tablet e 32 px no desktop.
- Hierarquia por **espaço** antes de caixas: 32–48 px entre seções e 12–16 px dentro de um grupo. Só use um painel com borda quando ele agrupa algo que o usuário manipula junto (gráfico + controles).
- Grid de 12 colunas no desktop. Gráficos principais ocupam 8 colunas e a lateral de contexto 4. No celular, tudo em uma coluna, com os filtros num sheet inferior.

### Cor

- **Neutros frios** (cinza-azulado) na base, para não competir com as cores das marcas. Papéis:
  - `--bg`, `--surface`, `--surface-raised`, `--surface-sunken`;
  - `--border`, `--border-strong`;
  - `--text`, `--text-muted`, `--text-subtle`.
- **Uma cor de destaque do produto** (links, foco, seleção, ação primária). Ela precisa ser **distante do matiz de todas as instituições** (laranja Itaú, vermelho Bradesco/Santander, amarelo BB, azul-marinho BTG). Um violeta ou um verde-azulado, por exemplo. Valide o contraste.
- **Cores de instituição = marca**, lidas de `config/instituicoes.yaml`. A cor acompanha a entidade, nunca a posição no ranking; filtrar não recolore.
- **Pares de marca parecidos** (Bradesco × Santander; Itaú Corretora × Itaú Unibanco; Bradesco × Bradesco CTVM): se aparecerem juntos num mesmo gráfico, diferencie por passo de luminosidade e sempre com rótulo direto ou legenda. Nunca dependa só da cor.
- **Texto sobre cor de marca:** calcule o contraste e escolha automaticamente texto escuro ou claro. O amarelo do BB exige texto escuro.
- **Categorias** (tipo de BDR, segmento, classe de ETF): paleta categórica validada, com no máximo 8 classes; o excedente vira "Outros". Valide com um validador de paleta (diferença perceptual entre vizinhos e simulação de daltonismo) e registre o resultado.
- **Semânticas** (ok, alerta, erro, desatualizado) são reservadas para status de dados, nunca para identidade de série.
- **Contraste WCAG 2.2 AA:** 4,5:1 em texto e 3:1 em texto grande, ícones e bordas de controle.
- **Tema escuro:** os tokens já nascem preparados (`[data-theme="dark"]` e `prefers-color-scheme`). As cores de marca ganham um passo mais claro sobre a superfície escura. O tema escuro pode ser entregue depois, mas o sistema não pode impedi-lo.

### Profundidade, raio e efeitos

- **Raio por hierarquia,** nunca o mesmo raio em tudo:
  - 4 px em chip, input e badge;
  - 8 px em botão e painel;
  - 12 px em modal e sheet;
  - 0 em tabela.
- **Elevação em 3 níveis no máximo:** borda de 1 px (`--border`) como padrão, sombra suave para elementos flutuantes (tooltip, popover) e sombra média para modal. Sombras tingidas com o tom do texto, não com preto puro.
- **Degradês:** use no máximo em dois lugares, com função:
  1. preenchimento de área sob uma série temporal (cor da série de cerca de 16% a 0% de opacidade);
  2. um único tratamento de destaque na capa (`/`), se a proposta justificar.

  Proibido em cartões, botões, texto e fundos de seção.
- **Glassmorphism, brilho, neon e sombras coloridas:** não.
- **Ênfase nos gráficos:** ao passar o mouse ou focar um item, ele mantém a cor e os demais caem para cerca de 35% de opacidade. Na seleção (filtro cruzado), o item selecionado fica com contorno de foco e um chip do filtro aparece no topo, com botão de remover.
- **Movimento:** de 150 a 200 ms, `ease-out`, só como resposta a ação (abrir, filtrar, ordenar). Nada de animação de entrada por seção nem loop decorativo. Respeite `prefers-reduced-motion`.
- **Foco visível:** anel de 2 px na cor de destaque, com 2 px de afastamento, em todo elemento interativo.
- **Skeletons** com o formato real do conteúdo, nunca um spinner de tela inteira.

### Ícones

Um só conjunto (Lucide, por exemplo), em 16 e 20 px, com traço 1,5. Sem emojis.

## Gráficos

- **Forma pela pergunta:**
  - composição → donut (até 6–8 fatias, com total no centro);
  - ranking → barras horizontais ordenadas;
  - evolução → colunas, ou linha com área suave;
  - ganho e perda → barras divergentes com linha zero neutra;
  - um único número → KPI, não gráfico.
- **Acabamento dos marcadores:**
  - marcas finas e espaçamento de 2 px (cor da superfície) entre segmentos empilhados e barras vizinhas, sem contorno;
  - grade e eixos em linha fina sólida, um tom acima da superfície; nada tracejado;
  - nada de 3D;
  - nada de eixo duplo.
- **Rótulos:**
  - rótulo direto seletivo (o maior, o último, o selecionado), sem número em todo ponto;
  - eixos em `--fs-xs` com `--text-muted`;
  - números compactos em pt-BR (R$ 1,2 bi; R$ 350 mi; 12,4%).
- **Tooltip** com título, valor formatado, participação percentual e período. Ele segue o teclado também.
- **Legenda** sempre que houver duas séries ou mais. Clicar na legenda filtra.
- **Alternativa acessível:** todo gráfico tem `role="img"`, `<title>`/`aria-label` descritivo e o botão "ver como tabela".

## Tabelas

- Cabeçalho fixo, ordenação visível (ícone e `aria-sort`) e números à direita com `tnum`.
- Densidade padrão de 40 px de altura por linha, com opção compacta de 32 px.
- Separação de linhas por borda fina, sem zebra forte.
- Ticker em destaque tipográfico (peso 600). Instituição com um ponto da cor da marca ao lado do nome; a cor nunca é a célula inteira.
- Selos discretos (por exemplo, "CVM indica outro escriturador") com texto, não só cor.
- No celular, rolagem horizontal dentro do container, com a primeira coluna fixa.

## Vícios proibidos (sinais de design genérico)

- Conteúdo picado em cartões idênticos, todos com o mesmo raio e a mesma sombra cinza.
- KPI padrão "número grande + rótulo pequeno + degradê", repetido em fileira sem hierarquia.
- Rótulos em CAIXA ALTA espaçada acima de cada título.
- Uma palavra do título em outra cor.
- "→" no fim de todo link.
- Numeração 01/02/03 em conteúdo que não é sequência.
- Fundo creme com destaque terracota.
- Fundo quase preto com um único verde-ácido.
- Monoespaçada em rótulos genéricos.
- Cores geradas aleatoriamente para instituições.
- Cor de alarme (vermelho) para identidade de série.

Gaste a ousadia num só ponto memorável. Por exemplo: a forma como as cores de marca dos bancos dão identidade ao painel. Mantenha o resto disciplinado.

## Auditoria (quando pedirem "avalie o design")

Dê nota de 0 a 3 a cada dimensão, sempre com evidência (arquivo, rota ou captura):

1. tokens e consistência;
2. hierarquia e layout;
3. tipografia;
4. cor e contraste;
5. gráficos;
6. tabelas;
7. estados (hover, foco, vazio, carregando, erro, desatualizado);
8. responsividade em 390 px;
9. acessibilidade;
10. movimento e efeitos;
11. microcopy em pt-BR;
12. confiança (fonte e data visíveis em cada número).

Liste os problemas com severidade (crítica, alta, média, baixa) e esforço, e proponha as ondas: correções críticas → fundação → telas → polimento.

## Lista de verificação antes de concluir

- [ ] Nenhum valor literal fora de `tokens.css`. Faça um grep por `#[0-9a-f]{3,6}` e `px` nos componentes.
- [ ] Capturas de 1440, 1024 e 390 px, antes e depois, anexadas.
- [ ] `@axe-core/playwright` sem violações sérias ou críticas.
- [ ] Lighthouse mobile com Acessibilidade ≥ 95 e Performance ≥ 90.
- [ ] Contraste conferido nos pares de texto e nas cores de marca com texto por cima.
- [ ] Navegação por teclado em filtros, gráficos e tabela, com foco sempre visível.
- [ ] `prefers-reduced-motion` respeitado.
- [ ] Sem rolagem horizontal da página em 360 px.
- [ ] A rota `/design` foi atualizada com o que mudou.
- [ ] A decisão foi registrada em `docs/design-system.md`.
