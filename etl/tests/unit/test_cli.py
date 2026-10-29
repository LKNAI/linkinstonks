from __future__ import annotations

import pytest
from typer.testing import CliRunner

from painel_etl import __version__
from painel_etl.cli import NOT_YET, app

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


@pytest.mark.parametrize("args", [["run"], ["backfill", "cotahist"], ["validate"], ["report"], ["seed-import"]])
def test_comandos_futuros_avisam_e_saem_com_codigo_3(args: list[str]) -> None:
    r = runner.invoke(app, args)
    assert r.exit_code == NOT_YET
    assert "Fase" in r.output


def test_probe_rejeita_fonte_desconhecida() -> None:
    r = runner.invoke(app, ["probe", "inexistente"])
    assert r.exit_code != 0
