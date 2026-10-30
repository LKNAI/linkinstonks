# Design system (direção A, "Livro-razão")

Decisões do dono em 2026-10-29. Auditoria, validações de paleta e a direção B (descartada) estão em `docs/design-auditoria.md`.
O catálogo vivo é a rota `/design` (noindex, fora do sitemap); a fonte dos valores é `web/styles/tokens.css`.

## Decisões

| tema | decisão |
|---|---|
| destaque | ameixa `--accent` (#6D1D72), ΔE2000 ≥ 20 de todas as marcas; só tema claro (sem dark) |
| tipografia | IBM Plex Sans; Plex Mono só em tickers e CNPJ; escala `--fs-xs…kpi` (12/13/14/16/20/24/36); pesos 400/500/600/700; sem caixa alta espaçada |
| categorias | rampa ameixa `--cat-1..3` (tipo de BDR, segmento NM>N2>N1, classe de ETF), `--cat-none` para "sem dados" e neutros `--cat-alt-1..4` para o que não cabe na rampa (MP, B, SO, BN e a classe Moeda). A rampa foi validada com 3 passos; os neutros dependem de rótulo visível |
| marcas | vêm de `config/instituicoes.yaml`; `gen-colors.mjs` gera `lib/colors.ts` e `coresDoConjunto()`, que aplica a variante de Santander (#FF493E) e de Itaú Unibanco (#F8AB5F) só quando o par confuso (Bradesco; Itaú Corretora) aparece no mesmo gráfico |
| texto sobre cor | `textoSobre()` escolhe branco, grafite ou preto, o primeiro com contraste ≥ 4,5:1 (o azul do Mercantil só passa com preto); teste cobre todas as marcas |
| raio | 4 px em chip, selo, input e barra; 8 px em botão, painel e tooltip; 12 px reservado a modal e sheet; 0 em tabela; `--radius-round` só para pontos e interruptor |
| elevação | borda por padrão; sombra só em elemento flutuante (`--shadow-float`) e modal (`--shadow-modal`) |
| movimento | `--dur` 150 ms, `--ease` ease-out, só como resposta a ação; `prefers-reduced-motion` desliga |
| espaço | grade de 4 px (`--space-*`); hairlines de 1–2 px e a geometria de eixos de gráfico ficam em px |
| degradê | nenhum na capa nem nos cartões; o único permitido é a área sob série temporal |
| logo | cor chapada em `--accent`, sem degradê |

## Regras de código

- Nenhum literal de cor, tamanho de fonte, espaçamento, raio ou sombra fora de `tokens.css`. Exceções: `lib/colors.ts` (gerado), `lib/palette.ts` (espelha os tokens; `tests/unit/palette.test.ts` compara com `tokens.css`), `@media`, geometria de SVG e hairlines de 1–2 px.
- Cada tema de design vira um commit (`style(web): …`).

## Links

- **Nova aba** (`components/layout/LinkNovaAba.tsx`): registros e fontes (empresa e BDR nas tabelas, "ver na lista" nos detalhes, instituições e as listas já filtradas que elas abrem) e arquivos oficiais da B3. Ícone `ExternalLink` de 14 px e texto `sr-only` "(abre em nova aba)". Cliques em gráficos, chips, filtros e ordenação filtram a própria página; menu, logo, migalhas e botões da Capa ficam na mesma aba.
- **Divisão de seção** (`.sec-h`): título `--fs-xl` e uma linha de apoio dentro da grade de 12 colunas, para separar blocos de uma mesma tela (por exemplo, "Volume negociado" em `/acoes`).

## Estado da implementação

Feito: tokens, fontes e cor; escala tipográfica; raio, espaço e movimento; variantes de pares de marcas; catálogo `/design`; telas `/bdrs` e `/acoes` (esta já com a Tabela e o Volume de ações unidos, filtros em sheet no celular, régua de marcas e links em nova aba).

A fazer, por tela (ordem): `/`, detalhes, `/instituicoes`, `/novidades`, `/status`, `/sobre`. Entram nelas: régua de marcas de 4 px, KPIs sem cartões, layout de 12 colunas e filtros em sheet no celular.
