"""Bradesco Custódia: programas de BDR não patrocinado (`docs/fontes.md`, seção 6).

O site é um SPA (AEM + React). Os dados públicos que ele mesmo consome:

- ações: consulta persistida do AEM (GraphQL) com os descritivos operacionais. Traz só o NOME da empresa,
  sem ticker; por isso serve de DETECTOR DE MUDANÇA (programa novo/removido) e a atribuição de ticker
  fica em `config/overrides/depositarias.csv`;
- ETFs: tabela HTML dentro do modelo de página `bdr-de-etf.model.json`, com os tickers.

Endpoint não documentado: pode mudar sem aviso. Falha aqui nunca derruba o dataset.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass

from painel_etl.core.http import Http

BASE = "https://custodia.bradesco"
GRAPHQL = (
    "/graphql/execute.json/banco-bradesco/custodia-get-bdr-by-path;"
    "path=/content/dam/banco-bradesco/custodia/conteudos/pt/arquivo/brazilian-depositary-receipt"
)
MODELO_ETF = "/content/custodia/pt/bdr-de-etf.model.json"
TIPO_PROGRAMA = "operational_description"


@dataclass(frozen=True)
class ProgramasBradesco:
    acoes: list[str]  # nomes de empresa
    etfs: list[str]  # tickers


def parse_acoes(texto: str) -> list[str]:
    itens = json.loads(texto)["data"]["bradescoCustodiaArquivoList"]["items"]
    return sorted(
        {i["link_title"].strip() for i in itens if i.get("file_type") == TIPO_PROGRAMA and i.get("link_title")}
    )


def parse_etfs(texto: str) -> list[str]:
    # O JSON bruto escapa "<" e ">" como </>: o "E" hexadecimal grudaria no ticker. Decodificar antes.
    decodificado = json.dumps(json.loads(texto), ensure_ascii=False)
    return sorted(set(re.findall(r"(?<![A-Z0-9])[A-Z0-9]{4}39(?![A-Z0-9])", decodificado)))


def buscar(http: Http) -> ProgramasBradesco:
    a = http.get(BASE + GRAPHQL)
    a.raise_for_status()
    e = http.get(BASE + MODELO_ETF)
    e.raise_for_status()
    return ProgramasBradesco(parse_acoes(a.text), parse_etfs(e.text))
