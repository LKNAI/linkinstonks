"""Estado do ETL em `data/state/*.json`: ETags, últimas datas processadas, contagens anteriores."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from painel_etl import paths
from painel_etl.core import io


class State:
    def __init__(self, nome: str, raiz: Path | None = None) -> None:
        self.path = (raiz or paths.data_dir() / "state") / f"{nome}.json"
        self.dados: dict[str, Any] = io.read_json(self.path, {})

    def get(self, chave: str, default: Any = None) -> Any:
        return self.dados.get(chave, default)

    def set(self, chave: str, valor: Any) -> None:
        self.dados[chave] = valor

    def save(self) -> bool:
        return io.write_json(self.path, self.dados, indent=2)
