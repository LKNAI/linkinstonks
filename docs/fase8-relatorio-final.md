# Fase 8: relatório final

Situação em 03/11/2026. As Ondas A e B estão nos PRs #7 e #8, e a Onda C está na branch local `feat/fase8-onda-c`. Nada foi integrado ao `main` nem publicado. O dono dispensou a revisão de cada etapa.

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
| e2e com axe | 123 passaram, 1 ignorado (só roda quando há mês parcial) |
| JS inicial | maior rota com 197,7 KB; `/acoes` e `/bdrs` com 180,9 KB (limite de 200 KB) |
| `data/public` | 3,9 MB (limite de 20 MB) |
| `data/snapshots_site` | 11 MB; maior mês com 534 KB (limite de 600 KB) |
| Capturas da Onda C | 27, em 1440, 1024 e 390 px, sem rolagem horizontal nem erro de console, em `docs/capturas/fase8-onda-c/`, fora do Git |
| Impressão | PDF conferido: A4, com cabeçalho e rodapé repetidos em cada página |

## O que não foi verificado

- **CI da Onda C:** os testes rodaram só nesta máquina, porque a branch não foi enviada.
- **Lighthouse e PageSpeed:** não medidos. A última medida local de desempenho foi baixa (58 a 62, `docs/design-system.md`). Baixar os painéis sob demanda deve ajudar, mas não há número.
- **Tempos no GitHub Actions:** só há medidas locais (`docs/operacao.md`), e a meta é ficar abaixo de 8 minutos no diário e 20 no mensal.
- **Rotina mensal real:** a primeira com este código depende da integração. A de 05/11/2026 é a próxima.
- **Fluxo diário com arquivo de novembro:** não exercitado com dado real.

## Riscos

1. **Termos da B3.** O site continua mostrando dados de negociação sem autorização da B3. O [ADR 0009](decisoes/0009-termos-de-uso-da-b3.md) reduz a exposição, mas não a elimina, e traz o texto do pedido de autorização. Não é parecer jurídico.
2. **Integração.** O bot grava em `data/` no `main` todo dia, então `data/public` precisa ser regenerado na integração. Se a integração for depois de 05/11, a rotina antiga terá gravado o snapshot de outubro sem registrar a data, e o mês precisa ser refeito (`docs/operacao.md`).
3. **Reconstituição.** Mostra só companhias do cadastro atual com escriturador no FCA. "+N desde então" compara conjuntos diferentes e não mede novas listagens. A tela e a metodologia avisam.
4. **`TOTNEG`.** O estouro em 5 dígitos é inferência, sem confirmação da B3. Negócios e ticket seguem como vieram, com "≈" nos meses suspeitos.
5. **Janela de BDRs.** As partições começam em out/2024, então só meses recentes têm 24 meses de série. As telas dizem quantos meses mostram.
6. **Tamanho.** O deploy tem cerca de 270 MB, a maior parte em páginas de detalhe. Convém acompanhar o limite da Vercel.

## Sugestões para a Fase 9

1. Enviar o pedido à B3 e registrar a resposta no ADR 0009.
2. Medir PageSpeed e os tempos do Actions, e corrigir o que ficar abaixo da meta.
3. Carregar mais 24 meses de COTAHIST, para dar série completa aos BDRs em meses passados.
4. Guardar liquidez e faixas de ticket nos snapshots, para que essas seções também apareçam no mês passado.
5. Reabrir o empréstimo de ativos, se a B3 autorizar.
