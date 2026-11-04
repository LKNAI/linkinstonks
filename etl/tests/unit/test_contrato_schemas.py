"""Teste de contrato: um campo publicado só pode sumir com aumento da versão major (ADR 0008).

`tests/contratos/campos_v1.json` guarda todos os campos dos JSON Schemas da major 1. Campo novo entra sem atrito. Campo
removido faz este teste falhar até que a major suba e a linha de base seja regravada de propósito:

    uv run python -m tests.unit.test_contrato_schemas
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from painel_etl import paths

BASE = Path(__file__).parent.parent / "contratos" / "campos_v1.json"
MAJOR = 1


def _campos(no: Any, raiz: dict[str, Any], prefixo: str = "") -> set[str]:
    if not isinstance(no, dict):
        return set()
    saida: set[str] = set()
    if "$ref" in no:
        return _campos(raiz["$defs"][no["$ref"].rsplit("/", 1)[-1]], raiz, prefixo)
    for nome, sub in no.get("properties", {}).items():
        caminho = f"{prefixo}.{nome}" if prefixo else nome
        saida |= {caminho} | _campos(sub, raiz, caminho)
    for chave in ("items", "additionalProperties"):
        if isinstance(no.get(chave), dict):
            saida |= _campos(no[chave], raiz, f"{prefixo}[]")
    for sub in no.get("oneOf", []):
        saida |= _campos(sub, raiz, prefixo)
    return saida


def campos_atuais() -> dict[str, list[str]]:
    saida = {}
    for arq in sorted(paths.schemas_dir().glob("*.schema.json")):
        doc = json.loads(arq.read_text(encoding="utf-8"))
        saida[arq.name.removesuffix(".schema.json")] = sorted(_campos(doc, doc))
    return saida


def major_de(nome: str) -> int:
    doc = json.loads((paths.schemas_dir() / f"{nome}.schema.json").read_text(encoding="utf-8"))
    achado = re.match(r"\^(\d+)\\\.", doc["properties"]["schema_version"]["pattern"])
    assert achado, f"{nome}: schema_version deve ser MAJOR.MINOR"
    return int(achado.group(1))


def test_nenhum_campo_foi_removido_sem_subir_a_major() -> None:
    linha_de_base = json.loads(BASE.read_text(encoding="utf-8"))
    atuais = campos_atuais()
    for nome, campos in linha_de_base.items():
        if nome in atuais and major_de(nome) > MAJOR:
            continue
        faltando = sorted(set(campos) - set(atuais.get(nome, [])))
        assert not faltando, f"{nome}: campos removidos sem subir a major do schema_version: {faltando}"


def test_todo_schema_esta_na_linha_de_base() -> None:
    assert set(campos_atuais()) <= set(json.loads(BASE.read_text(encoding="utf-8")))


def test_todo_schema_usa_major_ponto_minor() -> None:
    for nome in campos_atuais():
        assert major_de(nome) >= MAJOR


if __name__ == "__main__":
    BASE.parent.mkdir(exist_ok=True)
    BASE.write_text(json.dumps(campos_atuais(), ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
