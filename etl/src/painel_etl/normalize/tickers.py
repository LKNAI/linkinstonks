"""Tickers: classe da ação e filtro de BDR."""

from __future__ import annotations

import re

#: BDR no COTAHIST: 4 caracteres + 3 + [1-5 ou 9] (+ F no fracionário). Seção 7.4 do prompt.
BDR_RX = re.compile(r"^[A-Z0-9]{4}3[1-59]F?$")

#: Ação no COTAHIST: 4 caracteres + final 3 a 8 (ON, PN, PNA...), "B" opcional (séries, ex. MRSA3B) e F no fracionário. Units (final 11) só com ESPECI "UNT",
#: porque ETFs e FIIs também terminam em 11.
ACAO_RX = re.compile(r"^[A-Z0-9]{4}[3-8]B?F?$")
UNIT_RX = re.compile(r"^[A-Z0-9]{4}11B?F?$")

_CLASSES = {"3": "ON", "4": "PN", "5": "PNA", "6": "PNB", "7": "PNC", "8": "PND", "11": "Units"}

CLASSES_ORDEM = ("ON", "PN", "PNA", "PNB", "PNC", "PND", "Units", "Outros")


def ticker_class(ticker: str) -> str:
    """Classe pelo sufixo numérico. Sufixo "B" (BDR/recibo) é ignorado, como no seed."""
    sufixo = re.sub(r"B$", "", ticker)[4:]
    return _CLASSES.get(sufixo, "Outros")


def base_ticker(codneg: str) -> str:
    """Soma o mercado fracionário (sufixo F) no ticker-base."""
    return codneg[:-1] if codneg.endswith("F") else codneg


def is_bdr_ticker(codneg: str) -> bool:
    return bool(BDR_RX.match(codneg))


def is_acao_ticker(codneg: str, especi: str = "") -> bool:
    """Ação (ON/PN/units) negociada à vista; exclui BDR (dois dígitos finais), ETF, FII, opções e termo."""
    return bool(ACAO_RX.match(codneg)) or bool(UNIT_RX.match(codneg) and "UNT" in especi)
