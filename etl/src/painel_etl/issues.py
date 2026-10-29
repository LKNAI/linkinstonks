"""Issues de qualidade (seção 9.2): UMA Issue por fonte, label `data-quality`, fechada sozinha quando a fonte volta.

A decisão (`planejar`) é uma função pura sobre o relatório da execução; `executar` só traduz o plano em
chamadas `gh`. Chaves de Issue: o nome da fonte (`b3_listed`), `dataset:acoes` quando um dataset deixa de ser
publicado e `nomes-nao-mapeados` quando aparece instituição fora de `config/instituicoes.yaml`.
"""

from __future__ import annotations

import json
import os
import subprocess
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

LABEL = "data-quality"
PREFIXO = "[data-quality] "
NAO_MAPEADOS = "nomes-nao-mapeados"

Runner = Callable[[list[str], str | None], str]


@dataclass(frozen=True)
class Acao:
    tipo: str  # abrir | atualizar | fechar
    chave: str
    titulo: str
    corpo: str
    numero: int | None = None


def titulo(chave: str) -> str:
    return f"{PREFIXO}{chave}"


def chave_do_titulo(t: str) -> str | None:
    return t[len(PREFIXO) :] if t.startswith(PREFIXO) else None


def _corpo(chave: str, linhas: list[str], rel: dict[str, Any]) -> str:
    run = ""
    if os.environ.get("GITHUB_RUN_ID") and os.environ.get("GITHUB_REPOSITORY"):
        base = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
        run = f"\n\nExecução: {base}/{os.environ['GITHUB_REPOSITORY']}/actions/runs/{os.environ['GITHUB_RUN_ID']}"
    return f"**{chave}** (execução de {rel['data']})\n\n" + "\n".join(f"- {x}" for x in linhas) + run


def diagnosticar(rel: dict[str, Any]) -> tuple[dict[str, list[str]], set[str]]:
    """(problemas por chave, chaves observadas saudáveis nesta execução)."""
    problemas: dict[str, list[str]] = {}
    saudaveis: set[str] = set()
    nao_mapeados: list[str] = []
    for r in rel["resultados"]:
        if r["dataset"] in ("acoes", "bdrs"):
            chave = f"dataset:{r['dataset']}"
            if r["publicado"] and not r["erro"]:
                saudaveis.add(chave)
            else:
                linhas = [f"erro: {r['erro']}"] if r["erro"] else []
                linhas += [f"`{i['codigo']}`: {i['mensagem']}" for i in r["qualidade"]["erros"]]
                problemas[chave] = linhas or ["dataset não publicado"]
            nao_mapeados += r["nao_mapeados"]
        for fonte, info in r["fontes"].items():
            if info["status"] == "ok":
                saudaveis.add(fonte)
            else:
                problemas.setdefault(fonte, []).append(f"{info['status']}: {info.get('mensagem', 'sem detalhe')}")
    if nao_mapeados:
        problemas[NAO_MAPEADOS] = [f"incluir em `config/instituicoes.yaml`: {sorted(set(nao_mapeados))}"]
    elif any(r["dataset"] in ("acoes", "bdrs") for r in rel["resultados"]):
        saudaveis.add(NAO_MAPEADOS)
    saudaveis -= set(problemas)
    return problemas, saudaveis


def planejar(rel: dict[str, Any], abertas: dict[str, int]) -> list[Acao]:
    """`abertas`: chave -> número das Issues `data-quality` abertas."""
    problemas, saudaveis = diagnosticar(rel)
    plano = []
    for chave, linhas in sorted(problemas.items()):
        corpo = _corpo(chave, linhas, rel)
        plano.append(
            Acao("atualizar" if chave in abertas else "abrir", chave, titulo(chave), corpo, abertas.get(chave))
        )
    for chave in sorted(saudaveis & abertas.keys()):
        plano.append(
            Acao(
                "fechar",
                chave,
                titulo(chave),
                f"A fonte voltou ao normal na execução de {rel['data']}.",
                abertas[chave],
            )
        )
    return plano


def _gh(args: list[str], entrada: str | None = None) -> str:
    r = subprocess.run(["gh", *args], input=entrada, capture_output=True, text=True, check=True, encoding="utf-8")
    return r.stdout


def listar_abertas(run: Runner = _gh) -> dict[str, int]:
    saida = run(
        ["issue", "list", "--label", LABEL, "--state", "open", "--limit", "100", "--json", "number,title"], None
    )
    abertas = {}
    for i in json.loads(saida or "[]"):
        chave = chave_do_titulo(i["title"])
        if chave:
            abertas[chave] = i["number"]
    return abertas


def executar(plano: list[Acao], run: Runner = _gh) -> None:
    if any(a.tipo == "abrir" for a in plano):
        run(
            [
                "label",
                "create",
                LABEL,
                "--force",
                "--color",
                "D93F0B",
                "--description",
                "Problema de qualidade de dados",
            ],
            None,
        )
    for a in plano:
        if a.tipo == "abrir":
            run(["issue", "create", "--title", a.titulo, "--label", LABEL, "--body-file", "-"], a.corpo)
        elif a.tipo == "atualizar":
            run(["issue", "edit", str(a.numero), "--body-file", "-"], a.corpo)
        elif a.tipo == "fechar":
            run(["issue", "close", str(a.numero), "--comment", a.corpo], None)
