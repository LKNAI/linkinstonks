from __future__ import annotations

from pathlib import Path

import pytest
from typer.testing import CliRunner

from painel_etl import __version__, seed_import
from painel_etl.cli import app

runner = CliRunner()


def test_version() -> None:
    r = runner.invoke(app, ["version"])
    assert r.exit_code == 0
    assert r.stdout.strip() == __version__


def test_help_lista_os_comandos() -> None:
    r = runner.invoke(app, ["--help"])
    assert r.exit_code == 0
    for cmd in ("run", "backfill", "probe", "validate", "report", "seed-import"):
        assert cmd in r.stdout


def test_backfill_tem_subcomandos() -> None:
    r = runner.invoke(app, ["backfill", "--help"])
    assert r.exit_code == 0
    assert "cotahist" in r.stdout and "fca" in r.stdout


@pytest.mark.parametrize("args", [["probe", "inexistente"], ["run", "--dataset", "fiis"]])
def test_argumentos_invalidos_sao_rejeitados(args: list[str]) -> None:
    assert runner.invoke(app, args).exit_code != 0


def test_seed_import_gera_arquivos_validos_no_schema(tmp_path: Path) -> None:
    r = seed_import.importar(destino=tmp_path)
    assert r == {"acoes": 568, "bdrs": 1143}
    assert (tmp_path / "acoes.json").exists() and (tmp_path / "bdrs.json").exists()
