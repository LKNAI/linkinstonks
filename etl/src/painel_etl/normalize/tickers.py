"""Tickers: classe da ação e filtro de BDR."""

from __future__ import annotations

import re

#: BDR no COTAHIST: 4 caracteres + 3 + [1-5 ou 9] (+ F no fracionário). Seção 7.4 do prompt.
BDR_RX = re.compile(r"^[A-Z0-9]{4}3[1-59]F?$")

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
