"""Interface de linha de comando: `painel-etl`."""

from __future__ import annotations

from pathlib import Path
from typing import Annotated

import typer

from painel_etl import __version__
from painel_etl import probe as probe_mod

app = typer.Typer(help="ETL do Painel B3 (escrituradores de ações e BDRs).", no_args_is_help=True, add_completion=False)

NOT_YET = 3  # código de saída dos comandos ainda não implementados


def _not_yet(phase: int) -> None:
    typer.echo(f"Ainda não implementado: previsto para a Fase {phase}.", err=True)
    raise typer.Exit(NOT_YET)


@app.command()
def version() -> None:
    """Mostra a versão."""
    typer.echo(__version__)


@app.command()
def probe(
    sources: Annotated[
        list[str] | None, typer.Argument(help="Fontes: " + ", ".join(probe_mod.SOURCES) + ". Padrão: todas.")
    ] = None,
    out: Annotated[Path, typer.Option(help="Pasta de saída dos fixtures.")] = probe_mod.DEFAULT_OUT,
    report: Annotated[Path | None, typer.Option(help="Grava o resultado em JSON.")] = None,
) -> None:
    """Sonda as fontes com chamadas mínimas e grava a resposta real como fixture."""
    try:
        code = probe_mod.run(sources, out, report)
    except ValueError as e:
        raise typer.BadParameter(str(e)) from e
    raise typer.Exit(code)


@app.command()
def run(dataset: str = "all", dry_run: bool = False) -> None:
    """Busca, normaliza, valida e publica os datasets."""
    _not_yet(2)


@app.command()
def backfill(kind: str, start: str = "") -> None:
    """Carga histórica (cotahist, fca)."""
    _not_yet(3)


@app.command()
def validate() -> None:
    """Valida os arquivos de data/public contra os JSON Schemas."""
    _not_yet(2)


@app.command()
def report() -> None:
    """Imprime um resumo em Markdown (Job Summary e Issues)."""
    _not_yet(6)


@app.command("seed-import")
def seed_import() -> None:
    """Converte seed/ no formato novo de data/ (carga inicial)."""
    _not_yet(2)
