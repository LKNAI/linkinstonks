# ADR 0001: Git como armazenamento dos dados

- Status: aceito (2026-10-29)
- Contexto: fases 0 e 1

## Contexto
O projeto tem custo zero e não pode depender de banco de dados pago, KV, Blob ou servidor. Os dados são pequenos e mudam pouco: 568 companhias, 1.143 BDRs, uma partição mensal de volume. O seed inteiro (`seed/data`) tem ~0,9 MB em JSON e CSV. Queremos histórico, diff legível e rollback sem operar infraestrutura.

## Decisão
O repositório Git é a fonte da verdade dos dados **processados**:

- `data/public/`: contrato com o site (validado por JSON Schema).
- `data/history/`: séries longas e snapshots mensais (`csv.gz`, particionados).
- `data/events/AAAA.jsonl`: log de mudanças, só acrescenta linhas.
- `data/state/`: estado do ETL (últimas datas, ETags, hashes, contagens).

O ETL roda no GitHub Actions, escreve esses arquivos e só faz commit se houver diferença (`git diff --quiet data/`). Os **downloads brutos nunca são commitados**; ficam em `actions/cache` (`.cache/raw/`).

## Consequências
- (+) Histórico, auditoria e rollback de graça: `git log -p data/public/acoes.json` mostra cada troca de escriturador.
- (+) Sem segredos e sem serviço externo; a Vercel só lê o repositório.
- (+) Saídas determinísticas (chaves ordenadas, sem timestamps nos dados) mantêm os diffs pequenos e fazem "sem mudança na fonte" virar "sem commit".
- (−) O repositório só cresce. Orçamento: `data/public/` ≤ 15 MB e repositório ≤ 500 MB. As séries longas ficam em `csv.gz` por ano para comprimir bem.
- (−) Dois commits do bot concorrentes causariam conflito: os workflows usam `concurrency: etl` sem cancelar.
- (−) Cada commit de dados dispara um deploy na Vercel (limite de 100 por dia no Hobby, muito acima do necessário); `ignoreCommand` evita builds sem mudança em `data/public/` ou `web/` (Fase 6).

## Alternativas descartadas
- **Banco gerenciado gratuito (Supabase, etc.):** exige conta e chave, vira dependência e perde o histórico por diff.
- **Armazenar os brutos no Git:** o COTAHIST mensal tem ~90 MB descompactado; estouraria o orçamento.
- **GitHub Releases para os históricos:** fica como plano B se o crescimento ameaçar o limite de 500 MB (registrar novo ADR nesse caso).
