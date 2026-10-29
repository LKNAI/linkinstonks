# Operação e deploy

Guia para colocar o linkinstonks no ar e mantê-lo. A Parte 1 são os passos que **você** executa (eu não tenho como criar o repositório nem o projeto na Vercel por você). A Parte 2 é o runbook do dia a dia.

## Parte 1. Passos para publicar

### 1. Criar o repositório (uma vez)
1. No GitHub, crie `LKNAI/linkinstonks` como repositório **público** (Actions gratuito e sem limite prático de minutos). Não marque "Add README".
2. Neste computador, na pasta do projeto:
   ```bash
   git remote add origin https://github.com/LKNAI/linkinstonks.git
   git push -u origin main
   ```
   Antes do primeiro `push`, confira `git status`: a pasta `various/` não está versionada (decida se quer commitá-la).
3. Em **Settings → Actions → General → Workflow permissions**, marque **Read and write permissions**. O ETL precisa de `contents: write` para commitar os dados e de `issues: write` para as Issues de qualidade (cada workflow já pede só isso, por `permissions`).
4. Em **Settings → Actions → General**, confirme que as Actions estão habilitadas. Em **Settings → Features**, confirme que **Issues** está ligado.

### 2. Testar o acesso às fontes a partir do GitHub (Fase 0, item pendente)
**Actions → probe → Run workflow.** O resumo da execução mostra, fonte por fonte, se B3, CVM e bancos aceitam os IPs do GitHub. Se alguma bloquear, aplique o plano B da seção 9.4 do prompt (cabeçalhos honestos e ritmo mais lento; depois runner self-hosted; depois proxy) e registre num ADR. Não use cabeçalhos que se façam passar por navegador contra proteções anti-robô.

### 3. Conectar na Vercel
1. Em vercel.com → **Add New → Project** → importe `LKNAI/linkinstonks`. Plano **Hobby** (uso não comercial).
2. **Project Name:** `linkinstonks`. **Root Directory:** `web`.
3. Ative **"Include source files outside of the Root Directory in the Build Step"**. É necessário: o `prebuild` lê `../data/public`.
4. Framework Preset: Next.js (já vem do `web/vercel.json`, que também define install, build, `outputDirectory: out`, cabeçalhos e o `ignoreCommand`). Não precisa de variável de ambiente; se usar outro domínio, defina `SITE_URL` (sitemap, `robots.txt` e feed).
5. **Deploy.** Se `linkinstonks.vercel.app` não estiver disponível, a Vercel sugere outro nome; nesse caso defina `SITE_URL` com o endereço final.
6. Depois do primeiro deploy, abra `/acoes/` e `/bdrs/` e **verifique o console do navegador**: o Next 16 gera arquivos de pré-busca em pastas e o cliente os pede com pontos (ver ADR 0002). Os links do menu já desligam a pré-busca; se aparecer 404 de `__next.*.txt`, adicione um `rewrites` no `web/vercel.json`.

### 4. Primeira coleta automática e "semana simulada"
Sem esperar o cron, dispare à mão em **Actions**:
1. `etl-weekly` → Run workflow (dataset `all`). Revisita todos os detalhes e atualiza as listas de depositárias. Deve terminar verde.
2. `etl-daily` → Run workflow duas vezes seguidas. A **segunda** execução deve dizer "Sem mudanças em data/: nenhum commit" (prova de idempotência).
3. `etl-daily` com `date` = dias seguintes (um por dia útil de uma semana) para simular o calendário; dias de fim de semana/feriado não geram arquivo de COTAHIST e ficam pendentes por 3 dias (comportamento esperado).
4. `etl-monthly` com `date` = primeiro dia do mês seguinte, para exercitar a reconciliação do COTAHIST e o snapshot em `data/history/snapshots/AAAA-MM/`.
5. Conferir: um commit `data(acoes,bdrs): atualização AAAA-MM-DD [+N eventos]` por mudança real, a Vercel publicando só quando `web/` ou `data/public/` mudaram, e a aba **Issues** sem `data-quality` abertas.

O ensaio local desse ciclo (dados adulterados → eventos → mensagem de commit → Issues) foi feito na Fase 6; o resultado está no relatório da fase.

## Parte 2. Runbook

### Como o dia a dia funciona
| workflow | quando (UTC) | faz |
|---|---|---|
| `etl-daily` | `23 1 * * 2-6` (≈ 22h23 BRT, seg a sex) | lista B3 + rodízio de `GetDetail`; COTAHIST do dia; FCA do ano se mudou; publica `acoes` e `bdrs` |
| `etl-weekly` | `41 9 * * 0` (dom ≈ 06h41 BRT) | tudo do diário + revisita completa dos detalhes, listas Banco B3 e Bradesco, cadastro CVM |
| `etl-monthly` | `7 11 5 * *` (dia 5) | reconcilia o COTAHIST mensal do mês fechado, snapshot em `data/history/snapshots/`, e refaz a publicação completa |
| `keepalive` | `17 6 15 * *` | commit vazio se o repositório ficou parado há mais de 45 dias; reativa os agendamentos |
| `ci` | PR e push | lint, tipos, testes, build, e2e e `painel-etl validate` |
| `probe` | manual | testa o acesso às fontes |

Todos os ETLs usam `concurrency: etl` (sem cancelar), `permissions` mínimas e actions fixadas por SHA. Entradas manuais passam por variáveis de ambiente, nunca coladas no script. O fluxo do ETL é: roda → valida os JSON Schemas → **só então** commita (e só se `data/` mudou) → resumo → Issues → falha o job se algo deu errado.

### Uma fonte falhou
1. O job fica vermelho e abre/atualiza **uma** Issue `[data-quality] <fonte>` (label `data-quality`) com o erro e o link da execução. O site **mantém o último dado bom**; a página `/status` e a faixa de aviso mostram o atraso (diárias: 3 dias úteis; semanais: 10 dias).
2. Veja o **Job Summary** da execução. Causas comuns: a B3 mudou um endpoint (atualize `docs/fontes.md`, a fonte em `etl/src/painel_etl/sources/` e regrave a fixture com `painel-etl probe <fonte>`); bloqueio de IP; queda temporária.
3. Quando a fonte voltar na execução seguinte, **a Issue se fecha sozinha**. Para forçar: Actions → o workflow → Run workflow.

### Portão de qualidade reprovou (dataset não publicado)
Abre a Issue `[data-quality] dataset:acoes` (ou `bdrs`) com os erros (queda de registros acima de 10%, campo obrigatório ausente, ticker duplicado, data futura...). O dataset anterior permanece. Investigue a fonte; se a queda for real e legítima (ex.: muitas deslistagens), ajuste o limite em `config/sources.yaml` e rode o workflow à mão.

### Instituição nova ou nome de escriturador que não casa
Abre a Issue `[data-quality] nomes-nao-mapeados` com os textos. Inclua a instituição (id, nome, CNPJ tirado do `CNPJ_Escriturador` do FCA, nunca de memória, aliases/padrões e cor) em `config/instituicoes.yaml` e rode `etl-daily`. O site mostra o nome original até lá, nunca falha em silêncio.

### BDR sem depositária
Aparece em `/status`. Se você souber a depositária **e a fonte**, acrescente uma linha em `config/overrides/depositarias.csv` (`ticker;nome;depositaria;fonte;data;observacao`, com o id da instituição). O Itaú bloqueia coleta automática: seus programas são mantidos aqui à mão. Quando o `run --weekly` avisar que a lista do Bradesco mudou, revise o CSV.

### Reprocessar ou recarregar histórico
```bash
cd etl
uv run painel-etl backfill fca --from 2010                    # FCA dos anos fechados
uv run painel-etl backfill cotahist --from 2024-10            # partições mensais do COTAHIST
uv run painel-etl run --dataset all --weekly                  # publicação completa
uv run painel-etl validate                                    # JSON Schemas
```
Depois, `git diff --stat data/` mostra o que mudou antes de commitar.

### Reverter dados ruins
Os dados são versionados: `git revert <commit de dados>` desfaz a publicação e a Vercel reimplanta. `data/events/` é append-only; ao reverter, remova à mão só os eventos do commit revertido.

### Eventos e feed
`data/events/AAAA.jsonl` guarda cada mudança (troca de escriturador, novo BDR...). O site mostra os 500 mais recentes em `/novidades` e no feed Atom `/feed.xml`.

### Custos
| item | estimativa | observação |
|---|---|---|
| Vercel | US$ 0 | Hobby, só site estático. Um deploy por commit na `main` (limite de 100 por dia); o `ignoreCommand` pula a build quando nada de `web/`, `data/public/` ou `schemas/` mudou |
| GitHub Actions, repositório público | US$ 0 | minutos gratuitos nos runners padrão |
| GitHub Actions, se o repositório for privado | ≈ 200 min/mês | **estimativa, a medir nas primeiras execuções**: diário ~5 min × 22 + semanal ~15 min × 4 + mensal ~20 min + CI. Cabe nos 2.000 min gratuitos. Medido no ensaio local: o passo do ETL diário levou 60 s; some ~1 a 2 min de preparação do runner (uv, cache). Registre os tempos reais aqui depois da primeira semana |

### Limites de tamanho
`data/public/` ≈ 1,5 MB (limite 15 MB). `data/history/` cresce ~165 KB por mês de COTAHIST e ~15 KB por ano de FCA. Se o repositório se aproximar de 500 MB, registre um ADR e mova os históricos para assets de GitHub Releases.

### Pontos que dependem de você ou ainda não foram verificados
- O `probe.yml` precisa ser rodado no GitHub (Passo 2).
- A pré-busca de links na Vercel (Passo 3.6).
- O `workflow_dispatch` pede `dataset`, `date` e `weekly`; **não** há seleção de fontes individuais (o prompt citava "fontes"): cada dataset já isola as suas fontes e o disjuntor derruba só a que falha.
- A estimativa de minutos do Actions é teórica até a primeira semana de execuções reais.
