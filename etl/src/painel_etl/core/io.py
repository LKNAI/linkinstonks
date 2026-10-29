"""Escrita atômica e determinística (seção 3.4 e 8 do prompt).

Mesmo conteúdo => mesmos bytes => nenhum commit. Chaves ordenadas, `ensure_ascii=False`,
`\\n` no fim, CSV com `;` e UTF-8 com BOM (abre direto no Excel).
"""

from __future__ import annotations

import csv
import gzip
import io
import json
import os
import tempfile
from collections.abc import Iterable, Sequence
from pathlib import Path
from typing import Any


def dumps(obj: Any, indent: int | None = 2) -> str:
    """JSON determinístico. `indent=0` para arquivos grandes (uma linha por elemento), 2 para pequenos."""
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, indent=indent) + "\n"


def write_bytes(path: Path, data: bytes) -> bool:
    """Grava de forma atômica (temporário + `os.replace`). Devolve True se o conteúdo mudou."""
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.read_bytes() == data:
        return False
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        os.replace(tmp, path)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise
    return True


def write_json(path: Path, obj: Any, indent: int | None = 2) -> bool:
    return write_bytes(path, dumps(obj, indent).encode("utf-8"))


def read_json(path: Path, default: Any = None) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def csv_bytes(header: Sequence[str], rows: Iterable[Sequence[Any]]) -> bytes:
    buf = io.StringIO(newline="")
    w = csv.writer(buf, delimiter=";", lineterminator="\n")
    w.writerow(header)
    for r in rows:
        w.writerow(["" if v is None else v for v in r])
    return b"\xef\xbb\xbf" + buf.getvalue().encode("utf-8")


def write_csv(path: Path, header: Sequence[str], rows: Iterable[Sequence[Any]]) -> bool:
    return write_bytes(path, csv_bytes(header, rows))


def write_csv_gz(path: Path, header: Sequence[str], rows: Iterable[Sequence[Any]]) -> bool:
    """CSV compactado. `mtime=0`: o gzip fica idêntico entre execuções."""
    return write_bytes(path, gzip.compress(csv_bytes(header, rows), compresslevel=9, mtime=0))


def read_csv_gz(path: Path) -> list[dict[str, str]]:
    text = gzip.decompress(path.read_bytes()).decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(text), delimiter=";"))


def append_jsonl(path: Path, linhas: Iterable[dict[str, Any]]) -> int:
    """Acrescenta linhas que ainda não existem (idempotente). `data/events` é append-only."""
    path.parent.mkdir(parents=True, exist_ok=True)
    existentes = set(path.read_text(encoding="utf-8").splitlines()) if path.exists() else set()
    novas = [json.dumps(x, ensure_ascii=False, sort_keys=True) for x in linhas]
    novas = [x for x in novas if x not in existentes]
    if novas:
        with path.open("a", encoding="utf-8", newline="\n") as f:
            f.writelines(x + "\n" for x in novas)
    return len(novas)
