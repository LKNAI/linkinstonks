"""Validação dos arquivos publicados contra os JSON Schemas em `schemas/`."""

from __future__ import annotations

import json
from functools import cache
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

from painel_etl import paths


@cache
def _validator(nome: str, raiz: Path) -> Draft202012Validator:
    schema = json.loads((raiz / f"{nome}.schema.json").read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


def erros(nome: str, obj: Any, raiz: Path | None = None) -> list[str]:
    """Mensagens de erro (vazio = válido), com o caminho do campo."""
    v = _validator(nome, raiz or paths.schemas_dir())
    saida = []
    for e in sorted(v.iter_errors(obj), key=lambda e: list(map(str, e.absolute_path))):
        caminho = "/".join(str(p) for p in e.absolute_path) or "(raiz)"
        saida.append(f"{caminho}: {e.message[:200]}")
    return saida


def validar(nome: str, obj: Any, raiz: Path | None = None) -> None:
    e = erros(nome, obj, raiz)
    if e:
        raise ValueError(f"{nome}: {len(e)} erro(s) de schema; primeiro: {e[0]}")
