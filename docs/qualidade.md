# Qualidade do site (Fase 7)

Metas do prompt (seção 11.4): JS inicial ≤ 200 KB gzip por rota, Lighthouse ≥ 90 nas quatro categorias em mobile, WCAG 2.2 AA. Medido em 2026-10-29 sobre o build estático servido com os cabeçalhos e a compressão da Vercel (`web/scripts/serve.mjs`).

## Resultado
| meta | resultado | status |
|---|---|---|
| JS inicial ≤ 200 KB gzip por rota | maior rota 190 KB (era 239 KB) | atingida; vigiada no CI (`pnpm budget`) |
| WCAG 2.2 AA (axe-core, regras A e AA até 2.2) | 0 violações em 10 rotas e 3 estados interativos | atingida; vigiada no CI (`tests/e2e/acessibilidade.spec.ts`) |
| Lighthouse, Acessibilidade ≥ 90 | 94 a 98 | atingida |
| Lighthouse, Melhores Práticas ≥ 90 | 100 | atingida |
| Lighthouse, SEO ≥ 90 | 100 | atingida |
| Lighthouse, Desempenho ≥ 90 | **58 a 76** | **não atingida** (análise abaixo) |

Lighthouse 13.5.0, mobile (4× de CPU e rede 4G simulados), nesta máquina de desenvolvimento (benchmarkIndex 709 a 892, abaixo da referência do Lighthouse):

| rota | Desempenho | Acessib. | LCP simulado | TBT | CLS |
|---|---|---|---|---|---|
| `/` | 58 | 98 | 4,7 s | 1,25 s | 0 |
| `/acoes/` | 68 | 95 | 3,6 s | 0,93 s | 0 |
| `/acoes/tabela/` | 74 | 98 | 3,6 s | 0,60 s | 0 |
| `/bdrs/` | 60 | 95 | 4,4 s | 1,15 s | 0 |
| `/bdrs/{ticker}` | 74 | 94 | 3,5 s | 0,71 s | 0 |
| `/acoes/{codigo}` | 76 | 98 | 3,5 s | 0,62 s | 0 |
| `/status/` | 65 | 98 | 4,4 s | 0,70 s | 0 |
| `/sobre/` (sem dados) | 71 | 98 | 3,6 s | 0,66 s | 0 |

## Por que o Desempenho não chegou a 90
- **O piso do framework já é ~75 a 82 nesta medição.** `/sobre/`, uma página de texto sem nenhum dado, marca TBT de 420 a 660 ms, por uma tarefa de ~570 ms que só carrega React e o cliente do Next (App Router).
- **Os painéis ficam 10 a 20 pontos acima desse piso**, por montar gráficos e tabelas depois de baixar os JSON (`bdrs.json` tem 640 KB, 140 KB em gzip).
- **O LCP real é bom** (0,8 a 1,1 s, igual ao FCP: o texto de apresentação está no HTML). O LCP de 3,5 a 4,7 s é a estimativa do simulador do Lighthouse, que multiplica por 4 as tarefas longas de JS anteriores à pintura.
- **A máquina distorce para pior.** Verifique contra a produção no PageSpeed Insights (hardware de referência) antes de concluir; não foi possível verificar nesta sessão.

## O que foi feito (com ganho medido)
- `zod` completo → `zod/mini` e carregamento sob demanda dos schemas e da tabela (TanStack): JS inicial de 239 → 190 KB.
- Texto de apresentação persistente entre "carregando" e "pronto" (o mesmo elemento do DOM): LCP de `/acoes/` de 4,3 → 2,1 s em uma das medições; área de carregamento com altura da tela: CLS de 0,1 → 0.
- Dados renderizados em transição (`startTransition`): TBT de `/bdrs/` de 1,8 → 1,3 s.
- Compressão gzip no servidor de teste, como na Vercel (sem ela a medição acusava 627 KB de JSON).

## O que foi tentado e descartado
- Montar o painel em etapas (uma seção por tarefa): não reduziu o TBT, então saiu. Não é o painel que domina o TBT; é o piso do framework.

## Opções para chegar a 90 (decisão do dono)
1. **Pré-renderizar os painéis no build** (os dados já existem na build): HTML com KPIs e gráficos prontos, hidratação mínima. Maior ganho; exige reestruturar os painéis e inflar o HTML.
2. **Reduzir o cliente**: separar páginas estáticas (`/sobre`, `/status`) de ilhas interativas, ou trocar o App Router por HTML estático com scripts só onde há interação. Ganho no piso; é troca de arquitetura.
3. **Reduzir `bdrs.json`**: servir só o necessário para a primeira tela e o resto sob demanda. Ganho moderado.
4. **Aceitar** o patamar atual se a produção, medida no PageSpeed Insights, já estiver ≥ 90.

## Como reproduzir
```bash
cd web && pnpm build && pnpm budget                       # orçamento de JS por rota
pnpm exec playwright test tests/e2e/acessibilidade.spec.ts  # axe, WCAG 2.2 AA
node scripts/serve.mjs 4173 &                              # servidor com os cabeçalhos e o gzip da Vercel
npx lighthouse@13.5.0 http://127.0.0.1:4173/bdrs/ --form-factor=mobile --only-categories=performance,accessibility,best-practices,seo
```

## Correções de acessibilidade desta fase
Cinza de apoio `--ink-3` `#7c7b93` → `#66657f`; `--gain` `#14a06b` → `#0a7a50`; `--loss` `#e0413f` → `#c62a28` (todos ≥ 4,5:1 sobre os fundos do site); texto escuro nos chips de categoria claros (`textoSobre()`); tooltip só com papel `tooltip` quando aberto; `role="group"` nos filtros ativos; alvos de toque ≥ 24 px nos links de fonte. Divergência de cor em relação ao seed (registrada em `docs/paridade.md`): só estes tons de texto; as cores de gráfico e de marca não mudaram.
