# Fase 8: relatório final

Situação em 04/11/2026. A Fase 8 está no `main` e publicada em <https://linkinstonks.vercel.app> desde 03/11/2026, às 22h50 de Brasília, pelo PR #9, que incorporou as Ondas A (#7) e B (#8). O dono autorizou integrar e publicar sem revisão, desde que a verificação e o CI passassem.

## O que foi entregue

| item | entrega | onde |
|---|---|---|
| 8.1 e 8.2 Liquidez das ações | volume, presença e ticket por ticker e companhia; categorias de negociação; `/acoes/liquidez` | Onda A e B |
| 8.3 Perfil de BDR | faixas de ticket, sem rótulo de tipo de investidor | Onda A e B |
| 8.4 Mapa de calor | `/bdrs/mapa`, 100 × 24 em cerca de 40 ms | Onda B |
| 8.5 Valores mobiliários | listagem e linha do tempo de segmentos, a partir de 2018 | Onda A e B |
| 8.8 Busca global | Ctrl/Cmd+K e `/`, índice de 37,5 KB em gzip (limite de 150 KB), sem biblioteca | Onda C |
| 8.9 Minha lista | estrela em tabelas, detalhes e busca; `/acompanhamento`; novidades; exportação e importação | Onda C |
| 8.7 Relatório mensal | `painel-etl report monthly`, `/relatorios`, impressão A4, feed | Onda C |
| 8.6 Ver mês passado | `?em=AAAA-MM` em `/acoes`, `/bdrs` e `/instituicoes`; 35 meses, 1 real e 34 reconstituídos | Onda C |

**Fora do escopo, por decisão do dono:** 8.10, a API pública ([ADR 0007](decisoes/0007-api-publica-fora-do-escopo.md)), e 8.11, o empréstimo de ativos, porque a B3 veda a coleta automatizada ([ADR 0006](decisoes/0006-emprestimo-de-ativos-nao-seguir.md)).

**ADRs da fase:** [0005](decisoes/0005-bdr-sem-fracionario.md) fracionário, [0006](decisoes/0006-emprestimo-de-ativos-nao-seguir.md) empréstimo, [0007](decisoes/0007-api-publica-fora-do-escopo.md) API, [0008](decisoes/0008-schema-version-major-minor.md) versões, [0009](decisoes/0009-termos-de-uso-da-b3.md) Termos da B3, [0010](decisoes/0010-busca-sem-biblioteca.md) busca e [0011](decisoes/0011-snapshots-no-site.md) snapshots.

## Números de conferência (outubro de 2026)

| número | valor | origem |
|---|---|---|
| Volume de ações | R$ 885,6 bi (+82,8% contra setembro) | partições do COTAHIST |
| Volume de BDRs | R$ 47,3 bi (+39,4% contra setembro) | partições do COTAHIST |
| Total do arquivo, mercados 010 e 020 | R$ 1,08 tri | `COTAHIST_M102026` |
| Pregões | 21 | idem |
| Companhias | 567 | `acoes.json` |
| BDRs | 1.151 | `bdrs.json` |

A alta de outubro foi conferida no arquivo da B3: 38.992 registros, nenhum repetido, com picos em 05/10 (R$ 96,8 bi) e 26/10 (R$ 112,1 bi). O número fica como veio. O relatório não explica a causa.

| categoria de negociação | companhias |
|---|---|
| presença alta | 284 |
| sem código de negociação | 223 |
| sem cotação no período | 31 |
| presença média | 17 |
| presença baixa | 7 |
| sem negócios | 5 |
| listagem recente | 0 |

| faixa de ticket dos BDRs | BDRs |
|---|---|
| dados insuficientes | 577 |
| intermediário | 286 |
| ticket baixo | 144 |
| ticket alto | 144 |

Quartis do mês: R$ 1.108,43 e R$ 7.463,41, com 574 BDRs no cálculo.

## Verificação

| verificação | resultado |
|---|---|
| Testes do ETL, ruff e mypy | 371 passaram, sem erros |
| Testes do site, ESLint, tipos e Prettier | 144 passaram, sem erros |
| e2e com axe | 124 passaram, nenhum ignorado, já com o mês parcial de novembro nos dados |
| CI do PR #9 | ETL, site com e2e, seed intacto e Vercel aprovados |
| Produção | todas as rotas respondem; arquivos retirados dão 404; `noindex` em `/data/`; busca, lista, relatório e mês passado conferidos em navegador, sem erro de console |
| `etl-daily` no Actions | 1 min 33 s (manual, 03/11, com o primeiro arquivo diário de novembro) e 1 min 37 s (agendado, 04/11), sem issue de qualidade; meta de 8 min |
| JS inicial | maior rota com 197,7 KB; `/acoes` e `/bdrs` com 180,9 KB (limite de 200 KB) |
| `data/public` | 3,9 MB (limite de 20 MB) |
| `data/snapshots_site` | 11 MB; maior mês com 534 KB (limite de 600 KB) |
| Capturas da Onda C | 27, em 1440, 1024 e 390 px, sem rolagem horizontal nem erro de console, em `docs/capturas/fase8-onda-c/`, fora do Git |
| Impressão | PDF conferido: A4, com cabeçalho e rodapé repetidos em cada página |

## O que não foi verificado

- **Lighthouse e PageSpeed:** não medidos. A API do PageSpeed recusou por falta de cota (HTTP 429), e o Lighthouse local não foi executado. A última medida na máquina local foi baixa (58 a 62, `docs/design-system.md`). Baixar os painéis sob demanda deve ajudar, mas não há número. Falta rodar <https://pagespeed.web.dev/> em `/acoes/` e `/bdrs/`.
- **Rotina mensal real:** a primeira com este código é a de 05/11/2026, que grava o snapshot real de outubro, refaz o relatório e mede o tempo contra a meta de 20 minutos.

## Riscos

1. **Termos da B3.** O site continua mostrando dados de negociação sem autorização da B3. O [ADR 0009](decisoes/0009-termos-de-uso-da-b3.md) reduz a exposição, mas não a elimina, e traz o texto do pedido de autorização. Não é parecer jurídico.
2. **Primeira rotina mensal.** O relatório e a posição compacta só foram exercitados por comando local, e o caminho completo roda pela primeira vez em 05/11. Se falhar, o job fica vermelho e abre uma Issue, e o site mantém o último dado bom. Para refazer um mês: `docs/operacao.md`.
3. **Reconstituição.** Mostra só companhias do cadastro atual com escriturador no FCA. "+N desde então" compara conjuntos diferentes e não mede novas listagens. A tela e a metodologia avisam.
4. **`TOTNEG`.** O estouro em 5 dígitos é inferência, sem confirmação da B3. Negócios e ticket seguem como vieram, com "≈" nos meses suspeitos.
5. **Janela de BDRs.** As partições começam em out/2024, então só meses recentes têm 24 meses de série. As telas dizem quantos meses mostram.
6. **Tamanho.** O deploy tem cerca de 270 MB, a maior parte em páginas de detalhe. Convém acompanhar o limite da Vercel.

## Sugestões para a Fase 9

1. Enviar o pedido à B3 e registrar a resposta no ADR 0009.
2. Medir o PageSpeed e o tempo da rotina mensal, e corrigir o que ficar fora da meta.
3. Carregar mais 24 meses de COTAHIST, para dar série completa aos BDRs em meses passados.
4. Guardar liquidez e faixas de ticket nos snapshots, para que essas seções também apareçam no mês passado.
5. Reabrir o empréstimo de ativos, se a B3 autorizar.
