# ADR 0002: Site estático (`output: 'export'`) na Vercel

- Status: aceito (2026-10-29)
- Contexto: fases 0 e 1

## Contexto
O plano Hobby da Vercel é gratuito para uso não comercial, mas funções serverless, Edge Config, KV, Postgres e Blob entram em cotas e podem pedir cartão. Os dados são públicos, pequenos e atualizados de forma agendada, e toda a interação (filtros cruzados, ordenação, busca, CSV) pode ser feita no navegador.

## Decisão
O front-end é um **export estático** do Next.js (`output: 'export'`, App Router, TypeScript `strict`):

- sem Serverless Functions, sem rotas de API, sem ISR, sem `cookies()`, sem Server Actions;
- os JSON de `data/public/` são copiados para `web/public/data/` no `prebuild` e carregados pelo navegador só na rota que os usa, validados com `zod`;
- imagens sem otimização do servidor (`images.unoptimized`);
- `trailingSlash: true`, para que cada rota vire `rota/index.html`;
- cabeçalhos de segurança (CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) e cache (`/data/*` com `max-age=300, stale-while-revalidate`) no **`vercel.json`**, porque `headers`, `redirects` e `rewrites` do Next não funcionam com export estático (confirmado na documentação do Next 16 que vem no pacote).

Páginas de detalhe (`/acoes/[codigoCvm]`, `/bdrs/[ticker]`) usam `generateStaticParams` (~1.700 páginas). Se a build passar de 3 minutos, trocar por uma página única com parâmetro de busca e registrar novo ADR.

## Consequências
- (+) Custo zero, sem servidor para manter nem segredo para vazar; CDN da Vercel serve tudo.
- (+) O que os testes e2e exercitam (`web/out`) é exatamente o que vai para produção.
- (−) Sem dados do servidor em tempo de requisição: a atualização acontece a cada deploy, disparado pelo commit de dados do ETL.
- (−) `cacheComponents` e `partialPrefetching` (ligados pelo scaffold do Next 16) ficam desligados: exigem runtime Node e não servem a um site estático.
- (−) O `prebuild` lê `../data/public`, fora da pasta `web`. Na Vercel, manter ligada a opção "Include source files outside of the Root Directory in the Build Step" (padrão em projetos novos). Se não for possível, mover a cópia para a raiz do repositório.
- (−) Fontes (`next/font/google`) são baixadas **na build** (e ficam self-hosted no export); a build precisa de rede.

- (−) **Pré-busca de rotas (Fase 4):** o Next 16 gera os arquivos de pré-busca do export em pastas (`acoes/__next.acoes/__PAGE__.txt`), mas o cliente os pede com pontos (`acoes/__next.acoes.__PAGE__.txt`), o que dá 404 em um servidor estático simples, com ou sem `trailingSlash`. Os links do menu usam `prefetch={false}` e a navegação por clique foi testada (e2e). **A confirmar na Vercel (Fase 6)**; se necessário, um `rewrites` no `vercel.json` resolve.

- (−) **Tempo de build (Fase 5):** as páginas de detalhe somam 1.733 páginas estáticas (568 companhias + 1.152 BDRs + as demais). Medido em 29/10/2026 na máquina local: 71 s para gerar as páginas e 134 s de `pnpm build` completo, abaixo do limite de 3 minutos deste ADR, então a estratégia de `generateStaticParams` se mantém. Se passar de 3 minutos, trocar por uma página única com parâmetro de busca. Saída: ~110 MB em `web/out`.
- `SITE_URL` (padrão `https://linkinstonks.vercel.app`) define o domínio usado no sitemap, no `robots.txt` e no feed Atom; sobrescreva ao publicar em outro endereço.

## Alternativas descartadas
- **SSR/ISR com funções serverless:** sai do custo zero e cria dependência de cotas.
- **API em Edge Config/KV para os dados:** exige serviço pago/cadastro de cartão.
- **SPA pura (Vite):** perderia a geração estática por rota e o SEO por página.
