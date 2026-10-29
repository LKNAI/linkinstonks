"""Interface de linha de comando: `painel-etl`."""

from __future__ import annotations

import datetime as dt
import json
import sys
from pathlib import Path
from typing import Annotated
from zoneinfo import ZoneInfo

import typer

from painel_etl import __version__, ci, issues, paths, pipeline, seed_import
from painel_etl import probe as probe_mod
from painel_etl.core.http import Http
from painel_etl.core.state import State
from painel_etl.sources import b3_cotahist, cvm_fca

app = typer.Typer(help="ETL do Painel B3 (escrituradores de ações e BDRs).", no_args_is_help=True, add_completion=False)
backfill_app = typer.Typer(help="Carga histórica.", no_args_is_help=True)
app.add_typer(backfill_app, name="backfill")

DATASETS = ("acoes", "bdrs", "acoes_volume")


def _gravar_relatorio(
    ctx: pipeline.Contexto,
    resultados: list[pipeline.Resultado],
    report_json: Path | None,
    summary_md: Path | None,
) -> None:
    rel = pipeline.relatorio_execucao(ctx, resultados)
    if report_json:
        report_json.parent.mkdir(parents=True, exist_ok=True)
        report_json.write_text(json.dumps(rel, ensure_ascii=False, indent=2), encoding="utf-8")
    if summary_md:
        summary_md.parent.mkdir(parents=True, exist_ok=True)
        summary_md.write_text(ci.resumo_markdown(rel), encoding="utf-8")


def _hoje() -> dt.date:
    return dt.datetime.now(ZoneInfo("America/Sao_Paulo")).date()


def _utf8() -> None:
    reconfigure = getattr(sys.stdout, "reconfigure", None)
    if reconfigure:
        reconfigure(encoding="utf-8")  # o console do Windows usa cp1252


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
def run(
    dataset: Annotated[str, typer.Option(help="acoes, bdrs ou all.")] = "all",
    dry_run: Annotated[bool, typer.Option(help="Calcula e valida sem gravar nada.")] = False,
    weekly: Annotated[bool, typer.Option(help="Rotina semanal: revisita todos os detalhes e atualiza listas.")] = False,
    report_json: Annotated[Path | None, typer.Option(help="Grava o relatório da execução em JSON.")] = None,
    summary_md: Annotated[Path | None, typer.Option(help="Grava o resumo em Markdown (Job Summary).")] = None,
    date: Annotated[str | None, typer.Option(help="Data de referência AAAA-MM-DD (padrão: hoje em Brasília).")] = None,
) -> None:
    """Busca, normaliza, valida e publica os datasets."""
    _utf8()
    if dataset not in (*DATASETS, "all"):
        raise typer.BadParameter("use acoes, bdrs ou all")
    ctx = pipeline.Contexto(hoje=dt.date.fromisoformat(date) if date else _hoje(), dry_run=dry_run, semanal=weekly)
    resultados = pipeline.run(ctx, list(DATASETS) if dataset == "all" else [dataset])
    _gravar_relatorio(ctx, resultados, report_json, summary_md)
    falhou = False
    for r in resultados:
        estado = "publicado" if r.publicado else "NÃO publicado"
        typer.echo(f"{r.dataset}: {estado} ({r.contagem} registros, {r.eventos} evento(s), mudou={r.mudou})")
        if r.erro:
            typer.echo(f"  erro: {r.erro}", err=True)
        if r.relatorio:
            typer.echo("  " + r.relatorio.markdown().replace("\n", "\n  "))
        for a in r.avisos:
            typer.echo(f"  aviso: {a}")
        falhou |= bool(r.erro) or not r.publicado
    raise typer.Exit(1 if falhou else 0)


@backfill_app.command("cotahist")
def backfill_cotahist(
    start: Annotated[str, typer.Option("--from", help="Mês inicial AAAA-MM.")],
    end: Annotated[str | None, typer.Option("--to", help="Mês final AAAA-MM (padrão: mês anterior ao atual).")] = None,
    force: Annotated[bool, typer.Option(help="Rebaixa meses cuja partição já é a oficial (mensal).")] = False,
    categoria: Annotated[str, typer.Option(help="Recorte do COTAHIST: bdr ou acao.")] = "bdr",
) -> None:
    """Carrega partições mensais do COTAHIST (arquivos `M`) para `data/history/<categoria>_volume/`."""
    _utf8()
    hoje = _hoje()
    fim = end or f"{(hoje.replace(day=1) - dt.timedelta(days=1)):%Y-%m}"
    cats = {"bdr": b3_cotahist.BDR, "acao": b3_cotahist.ACAO}
    if categoria not in cats:
        raise typer.BadParameter(f"categoria deve ser uma de {sorted(cats)}")
    cat = cats[categoria]
    pasta = paths.data_dir() / "history" / cat.pasta
    http = Http("b3_cotahist")
    for ano, mes in b3_cotahist.meses_entre(start, fim):
        chave = f"{ano}-{mes:02d}"
        atual = b3_cotahist.ler_particao(chave, pasta)
        if atual and atual["fonte"] == "mensal" and not force:
            typer.echo(f"{chave}: já oficial, pulando")
            continue
        r = b3_cotahist.processar_mensal(http, ano, mes, cache=paths.cache_dir() / "b3_cotahist", pasta=pasta, cat=cat)
        typer.echo(f"{chave}: {r['status']} ({r.get('tickers', 0)} tickers)")


@backfill_app.command("fca")
def backfill_fca(
    start: Annotated[
        int, typer.Option("--from", help="Ano inicial (a CVM publica a partir de 2010).")
    ] = cvm_fca.ANO_INICIAL,
) -> None:
    """Baixa os FCA dos anos fechados para `data/history/fca/`."""
    _utf8()
    http = Http("cvm_fca")
    state = State("cvm_fca")
    for ano in range(start, _hoje().year + 1):
        artefato = cvm_fca.fetch_ano(http, ano, state=state, cache=paths.cache_dir(), forcar=True)
        if artefato:
            linhas = list(cvm_fca.parse_zip(artefato.path))
            cvm_fca.salvar_particao(ano, linhas)
            typer.echo(f"{ano}: {len(linhas)} linhas")
    state.save()


@app.command()
def validate() -> None:
    """Valida os arquivos de data/public contra os JSON Schemas."""
    _utf8()
    erros = pipeline.validar_publicados()
    for e in erros:
        typer.echo(e, err=True)
    typer.echo("ok" if not erros else f"{len(erros)} erro(s)")
    raise typer.Exit(1 if erros else 0)


@app.command()
def report() -> None:
    """Imprime um resumo em Markdown (Job Summary e Issues)."""
    _utf8()
    typer.echo(pipeline.resumo_markdown())


@app.command("seed-import")
def seed_import_cmd() -> None:
    """Converte seed/ no formato novo de data/ (carga inicial)."""
    _utf8()
    r = seed_import.importar()
    typer.echo(f"importado do seed: {r['acoes']} companhias, {r['bdrs']} BDRs")


@app.command()
def monthly(
    report_json: Annotated[Path | None, typer.Option(help="Grava o relatório da execução em JSON.")] = None,
    summary_md: Annotated[Path | None, typer.Option(help="Grava o resumo em Markdown (Job Summary).")] = None,
    date: Annotated[str | None, typer.Option(help="Data de referência AAAA-MM-DD.")] = None,
) -> None:
    """Rotina mensal: reconcilia o COTAHIST do mês fechado, guarda o snapshot e refaz a publicação completa."""
    _utf8()
    ctx = pipeline.Contexto(hoje=dt.date.fromisoformat(date) if date else _hoje(), semanal=True)
    resultados = [pipeline.mensal(ctx), *pipeline.run(ctx, list(DATASETS))]
    _gravar_relatorio(ctx, resultados, report_json, summary_md)
    for r in resultados:
        typer.echo(f"{r.dataset}: {'ok' if r.publicado and not r.erro else 'FALHOU'} {r.erro}".strip())
        for a in r.avisos:
            typer.echo(f"  aviso: {a}")
    raise typer.Exit(1 if any(r.erro or not r.publicado for r in resultados) else 0)


@app.command("commit-message")
def commit_message(report: Annotated[Path, typer.Option(help="Relatório JSON da execução.")]) -> None:
    """Imprime a mensagem do commit de dados."""
    typer.echo(ci.mensagem_commit(json.loads(report.read_text(encoding="utf-8"))))


@app.command("issues")
def issues_cmd(
    report: Annotated[Path, typer.Option(help="Relatório JSON da execução.")],
    dry_run: Annotated[bool, typer.Option(help="Só mostra o plano, sem chamar o gh.")] = False,
) -> None:
    """Abre, atualiza e fecha as Issues `data-quality` (uma por fonte) conforme o relatório."""
    _utf8()
    rel = json.loads(report.read_text(encoding="utf-8"))
    plano = issues.planejar(rel, {} if dry_run else issues.listar_abertas())
    for a in plano:
        typer.echo(f"{a.tipo}: {a.titulo}")
    if not dry_run:
        issues.executar(plano)
