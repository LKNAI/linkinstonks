# ADR 0009: Termos de Uso da B3 no site atual

**Status:** aceita (2026-11-03; o dono delegou a decisão). Mitiga o risco, mas não o elimina. Não é parecer jurídico.

## O que dizem os Termos
Texto lido em 2026-11-03 em <https://www.b3.com.br/pt_br/termos-de-uso-e-protecao-de-dados/termos-de-uso/>. A página não mostra data de atualização.

- "Os visitantes deste website podem utilizar os dados disponíveis nessas páginas para uso exclusivamente pessoal".
- "É vedada a utilização dos dados contidos neste website para fins comerciais salvo mediante autorização prévia e por escrito da B3."
- Sobre a difusão de dados de mercado: "É vedada a distribuição, redistribuição, transferência, transmissão, retransmissão, licença, sublicença, locação, empréstimo, venda, revenda, recirculação, reformatação, publicação, prestação de serviços autônomos de difusão de dados e de avaliação ou fornecimento de bases de dados e produtos a terceiros por meio da utilização, ou disponibilização integral ou parcial da Difusão de Dados, exceto mediante prévio e expresso consentimento da B3."
- A página não traz exceção para uso público ou não comercial, regra de citação de fonte nem canal específico para o pedido. O consentimento é descrito como "instrumento contratual próprio".

## O problema
O linkinstonks publica, para qualquer pessoa, dados derivados do COTAHIST (volume, presença, ticket médio, último preço) e cadastros da B3. Ser gratuito e não comercial não cria uma exceção: o texto de difusão não distingue. Publicar agregados mensais pode ou não ser "difusão de dados de mercado"; isso é questão de interpretação que este projeto não pode decidir sozinho. A página de séries históricas não veda a coleta automatizada, e o CE 033/2019 cita essas séries como parte da divulgação prevista na regulamentação, mas isso não é uma autorização para republicar.

**Só um consentimento da B3 resolve a questão por inteiro.** Nenhuma mudança de código faz isso.

## Decisão
Reduzir o que mais se aproxima do texto vedado, sem tirar as telas do ar:

1. **Arquivos para baixar só com cadastro.** `downloads/acoes_volume.csv` e `downloads/acoes_liquidez.csv` deixam de ser publicados. `downloads/bdrs.csv` perde preço, negócios e volume. Os links para `acoes.json` e `bdrs.json` saem de `/sobre`. O motivo é o trecho "fornecimento de bases de dados": um arquivo com URL fixa é o que mais se parece com isso.
2. **CSVs de negociação fora do site.** Vão para `data/history/csv_correntes/`, de onde sai o snapshot mensal.
3. **`X-Robots-Tag: noindex` em `/data/`.** Os arquivos não entram em buscadores, e as telas continuam a carregá-los.
4. **Sem "dados abertos".** O selo das telas passa a "dados públicos", porque os dados da B3 não têm licença aberta. Os da CVM têm (ODbL).
5. **Aviso legal explícito** em `/sobre#aviso-legal`, com link no rodapé: propriedade da B3, link para os Termos, ausência de vínculo e de autorização, finalidade não comercial e canal para pedir correção ou retirada.

## O que continua exposto
- As telas seguem mostrando volume, presença, ticket e preço, inclusive em forma de gráfico ("reformatação").
- A exportação CSV de cada tabela segue no site, porque o dono a pediu e é uma cópia do que a pessoa está vendo.
- Os JSON que alimentam as telas continuam acessíveis por URL: um site estático não tem como evitar isso.
- **O repositório é público**, então `data/history/` também pode ser baixado. O dono decidiu mantê-lo público (2026-11-04): torná-lo privado reduziria pouco, porque as telas e os JSON continuam abertos, e tiraria a transparência do método. Dá para rever a decisão quando a B3 responder.

## Se a B3 pedir a retirada
Atender de imediato: remover do site os dados de negociação (`bdrs.json` sem volume, sem `acoes_liquidez*.json`, sem as seções correspondentes), mantendo o cadastro de escrituradores da CVM, e registrar aqui o que foi pedido.

## Como encerrar
O dono pode pedir autorização por escrito com o texto abaixo. Contato: Coordenadoria de Operações de Dados, `dataservices@b3.com.br`, informado no comunicado CE 019/2023; a B3 pode indicar outro canal. Pedir também chama atenção para o site e pode terminar em negativa ou em contrato pago, então enviar ou não é decisão do dono.

### Texto do pedido

> **Assunto:** Pedido de autorização para exibir dados públicos em site pessoal não comercial
>
> Prezados,
>
> Mantenho o linkinstonks (https://linkinstonks.vercel.app), site pessoal, gratuito e sem publicidade, que informa quem é o escriturador de cada ação listada e a depositária de cada BDR.
>
> O site usa estas fontes públicas da B3: Séries Históricas (COTAHIST), lista de Empresas Listadas e listas de programas de BDR do Banco B3. Exibe agregados mensais por ativo (volume, número de negócios, dias com negócio e ticket médio), o último preço e dados cadastrais, com atualização diária e indicação da fonte. Não exibe cotação em tempo real, não vende dados e não coleta das páginas "Boletim diário" e "Pesquisa por pregão".
>
> Os Termos de Uso limitam os dados a uso pessoal e exigem consentimento para publicação. Por isso, peço que informem:
>
> 1. se esse uso pode continuar e em que condições;
> 2. se há exigência de forma de citação ou de contrato;
> 3. se este é o canal correto para o pedido.
>
> Se a B3 preferir que algum dado não seja exibido, removo.
>
> Atenciosamente,
> [nome do responsável]
> [contato]

## Como desfazer
Reverter o commit deste ADR recoloca os arquivos e os links.
