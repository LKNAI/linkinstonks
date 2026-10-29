"""Normalização de texto para comparação (sem acento, minúsculo, sem pontuação)."""

from __future__ import annotations

import re
import unicodedata

_STOP = {"s", "a", "sa", "cia", "companhia", "de", "do", "da", "e", "industria", "comercio", "participacoes", "ltda"}


def fold(texto: str | None) -> str:
    """ "Itaú  Corretora, S.A." -> "itau corretora s a"."""
    sem_acento = unicodedata.normalize("NFD", texto or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", sem_acento.lower()).strip()


def significant_words(texto: str | None) -> list[str]:
    return [w for w in fold(texto).split() if w not in _STOP]
