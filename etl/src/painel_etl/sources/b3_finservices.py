"""Banco B3 (finservices.b3.com.br): programas de BDR não patrocinado (DRN) e de ETF (`docs/fontes.md`, seção 5).

A lista está numa tabela HTML paginada pelo servidor; `delta=1000` devolve tudo numa só requisição.
Marca de investidor qualificado: `*` no fim do nome. Scraper tolerante: se o número de itens cair mais de
20% em relação à execução anterior, quem chama mantém a lista anterior e abre alerta.
"""

from __future__ import annotations

from dataclasses import dataclass

from selectolax.lexbor import LexborHTMLParser

from painel_etl.core.http import Http
from painel_etl.normalize.tickers import is_bdr_ticker

URL_DRN = "https://finservices.b3.com.br/bdr-nao-patrocinado/programas?delta=1000&start=1"
URL_ETF = "https://finservices.b3.com.br/bdr-de-etf/programa?delta=1000&start=1"


@dataclass(frozen=True)
class Programa:
    ticker: str
    nome: str
    qualificado: bool


def parse(html: str) -> list[Programa]:
    """Linhas `Empresa | Código de Negociação | Ações`; ignora o cabeçalho e linhas sem ticker de BDR."""
    saida: dict[str, Programa] = {}
    for tr in LexborHTMLParser(html).css("tr"):
        celulas = [td.text(strip=True) for td in tr.css("td")]
        if len(celulas) < 2 or not is_bdr_ticker(celulas[1]):
            continue
        nome = celulas[0]
        saida[celulas[1]] = Programa(celulas[1], nome.rstrip("*").strip(), nome.endswith("*"))
    return sorted(saida.values(), key=lambda p: p.ticker)


def buscar(http: Http) -> dict[str, list[Programa]]:
    saida = {}
    for tipo, url in (("DRN", URL_DRN), ("ETF", URL_ETF)):
        r = http.get(url, read_timeout=120)
        r.raise_for_status()
        saida[tipo] = parse(r.text)
    return saida
