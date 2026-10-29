"""CNPJ: limpeza, máscara, raiz e dígitos verificadores."""

from __future__ import annotations

import re

_PESOS_1 = (5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2)
_PESOS_2 = (6, *_PESOS_1)


def digits(valor: str | None) -> str:
    """Só os dígitos, com zeros à esquerda até 14 (a B3 devolve CNPJ sem zeros iniciais)."""
    d = re.sub(r"\D", "", valor or "")
    return d.zfill(14) if d else ""


def root(valor: str | None) -> str:
    """Raiz do CNPJ (8 dígitos): une matriz e filiais."""
    return digits(valor)[:8]


def _dv(base: str, pesos: tuple[int, ...]) -> str:
    soma = sum(int(c) * p for c, p in zip(base, pesos, strict=True))
    resto = soma % 11
    return "0" if resto < 2 else str(11 - resto)


def is_valid(valor: str | None) -> bool:
    d = digits(valor)
    if len(d) != 14 or len(set(d)) == 1:
        return False
    d1 = _dv(d[:12], _PESOS_1)
    d2 = _dv(d[:12] + d1, _PESOS_2)
    return d[12:] == d1 + d2


def format_cnpj(valor: str | None) -> str:
    d = digits(valor)
    return f"{d[:2]}.{d[2:5]}.{d[5:8]}/{d[8:12]}-{d[12:]}" if len(d) == 14 else ""
