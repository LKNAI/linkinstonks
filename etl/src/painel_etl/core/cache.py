"""Cache dos downloads brutos em `.cache/raw/<fonte>/` (nunca commitado; vai para `actions/cache`).

Conteúdo idêntico ao anterior (mesmo sha256) => pular o parse.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path

from painel_etl import paths


@dataclass(frozen=True)
class RawArtifact:
    fonte: str
    nome: str
    path: Path
    sha256: str
    url: str = ""
    etag: str | None = None
    last_modified: str | None = None
    mudou: bool = True  # False se o sha256 coincide com o do estado anterior


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for bloco in iter(lambda: f.read(1 << 20), b""):
            h.update(bloco)
    return h.hexdigest()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def raw_path(fonte: str, nome: str, raiz: Path | None = None) -> Path:
    return (raiz or paths.cache_dir()) / fonte / nome
