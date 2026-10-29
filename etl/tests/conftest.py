"""Regra do projeto: o CI nunca acessa a rede. Qualquer conexão em teste falha."""

from __future__ import annotations

import socket
from pathlib import Path

import pytest

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(autouse=True)
def _sem_rede(monkeypatch: pytest.MonkeyPatch) -> None:
    def bloqueado(*_a: object, **_k: object) -> None:
        raise RuntimeError("Teste tentou acessar a rede; use fixtures (respx).")

    monkeypatch.setattr(socket.socket, "connect", bloqueado)


@pytest.fixture
def fixtures() -> Path:
    return FIXTURES
