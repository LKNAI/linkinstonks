"""Localização dos diretórios do repositório, sem caminhos absolutos fixos."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=1)
def repo_root() -> Path:
    """Raiz do repositório: `PAINEL_ROOT` ou o primeiro pai que contenha `config/sources.yaml`."""
    env = os.environ.get("PAINEL_ROOT")
    if env:
        return Path(env).resolve()
    for p in Path(__file__).resolve().parents:
        if (p / "config" / "sources.yaml").exists():
            return p
    raise RuntimeError("Raiz do repositório não encontrada; defina PAINEL_ROOT.")


def config_dir() -> Path:
    return repo_root() / "config"


def data_dir() -> Path:
    return repo_root() / "data"


def schemas_dir() -> Path:
    return repo_root() / "schemas"


def cache_dir() -> Path:
    return Path(os.environ.get("PAINEL_CACHE", repo_root() / ".cache" / "raw"))
