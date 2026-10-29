# Logo do linkinstonks

- `linkinstonks.svg`: o símbolo (quadrado arredondado, degradê violeta → magenta, linha de gráfico em alta feita de nós ligados e seta). É o mesmo arquivo do favicon (`web/app/icon.svg`).
- No site, o componente `web/components/layout/Logo.tsx` desenha o símbolo mais o nome ("linkin" em peso médio e "stonks" em negrito, cor `--accent-2`). Se o desenho mudar, ajuste o SVG **e** o componente.

**Conceito.** Os nós ligados são o "link" (o site liga empresas a escrituradores e BDRs a depositárias); a linha em alta com seta é o "stonks" (o volume). O último nó em âmbar marca o dado mais recente. O nome lê "link in stonks".

**Uso.** Mínimo de 16 px (legível como favicon). Sobre fundo claro ou escuro, sem alterar proporções nem cores. Cores do degradê: `#3b2bc4`, `#6250d6`, `#b444b5`; nó âmbar: `#fde68a` com borda `#fbbf24`. Ainda não há versão monocromática nem imagem para redes sociais (Open Graph).
