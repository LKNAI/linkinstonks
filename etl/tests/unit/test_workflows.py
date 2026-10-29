"""Regras dos workflows (seção 9 do prompt): segurança, agendamento e concorrência. Sem rede."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import pytest
import yaml

from painel_etl import paths

PASTA = paths.repo_root() / ".github" / "workflows"
ARQUIVOS = sorted(PASTA.glob("*.yml"))


def carregar(p: Path) -> dict[str, Any]:
    wf = yaml.safe_load(p.read_text(encoding="utf-8"))
    wf["on"] = wf.pop(True, wf.get("on"))  # YAML 1.1 lê a chave `on` como True
    return wf  # type: ignore[no-any-return]


def passos(wf: dict[str, Any]) -> list[dict[str, Any]]:
    return [s for j in wf.get("jobs", {}).values() for s in j.get("steps", [])]


def test_ha_os_workflows_esperados() -> None:
    assert {p.name for p in ARQUIVOS} >= {
        "ci.yml", "etl.yml", "etl-daily.yml", "etl-weekly.yml", "etl-monthly.yml", "keepalive.yml", "probe.yml",
    }  # fmt: skip


@pytest.mark.parametrize("arq", ARQUIVOS, ids=lambda p: p.name)
def test_actions_de_terceiros_fixadas_por_sha(arq: Path) -> None:
    for s in passos(carregar(arq)):
        uso = s.get("uses")
        if uso and not uso.startswith("./"):
            assert re.search(r"@[0-9a-f]{40}$", uso), f"{arq.name}: {uso} não está fixada por SHA"


@pytest.mark.parametrize("arq", ARQUIVOS, ids=lambda p: p.name)
def test_nunca_interpola_inputs_dentro_do_run(arq: Path) -> None:
    """Entradas do usuário vão por `env`, nunca coladas no script (injeção de comando)."""
    for s in passos(carregar(arq)):
        assert "${{ inputs." not in s.get("run", ""), f"{arq.name}: input interpolado em run"
        assert "${{ github.event." not in s.get("run", ""), f"{arq.name}: contexto de evento em run"


@pytest.mark.parametrize("arq", ARQUIVOS, ids=lambda p: p.name)
def test_sem_segredos_alem_do_token_automatico(arq: Path) -> None:
    texto = arq.read_text(encoding="utf-8")
    assert "secrets." not in texto.replace("secrets: inherit", "")


@pytest.mark.parametrize("arq", ARQUIVOS, ids=lambda p: p.name)
def test_agendamentos_evitam_minuto_cheio_e_tem_disparo_manual(arq: Path) -> None:
    on = carregar(arq)["on"]
    for item in (on.get("schedule") or []) if isinstance(on, dict) else []:
        assert item["cron"].split()[0] != "0", f"{arq.name}: cron no minuto cheio"
        assert "workflow_dispatch" in on, f"{arq.name}: agendado sem workflow_dispatch"


@pytest.mark.parametrize("arq", ARQUIVOS, ids=lambda p: p.name)
def test_jobs_com_timeout_explicito(arq: Path) -> None:
    for nome, job in carregar(arq)["jobs"].items():
        if "uses" not in job:  # chamadores de workflow reutilizável não têm runner nem timeout
            assert "timeout-minutes" in job, f"{arq.name}:{nome} sem timeout-minutes"


@pytest.mark.parametrize(
    ("arq", "cron", "weekly", "monthly"),
    [
        ("etl-daily.yml", "23 1 * * 2-6", None, False),
        ("etl-weekly.yml", "41 9 * * 0", True, False),
        ("etl-monthly.yml", "7 11 5 * *", True, True),
    ],
)
def test_agendamentos_do_etl(arq: str, cron: str, weekly: bool | None, monthly: bool) -> None:
    wf = carregar(PASTA / arq)
    assert wf["on"]["schedule"] == [{"cron": cron}]
    assert wf["concurrency"] == {"group": "etl", "cancel-in-progress": False}
    assert wf["permissions"] == {"contents": "read"}
    job = wf["jobs"]["etl"]
    assert job["uses"] == "./.github/workflows/etl.yml"
    assert job["permissions"] == {"contents": "write", "issues": "write"}
    assert job["with"]["monthly"] is monthly
    if weekly is not None:
        assert job["with"]["weekly"] is weekly


def test_workflow_reutilizavel_nao_repete_a_concorrencia() -> None:
    wf = carregar(PASTA / "etl.yml")
    assert "concurrency" not in wf and "concurrency" not in wf["jobs"]["etl"]
    assert wf["jobs"]["etl"]["permissions"] == {"contents": "write", "issues": "write"}


def test_commit_de_dados_so_se_ha_mudanca_e_com_o_autor_do_prompt() -> None:
    texto = (PASTA / "etl.yml").read_text(encoding="utf-8")
    assert "git diff --cached --quiet" in texto
    assert 'git config user.name "painel-b3-bot"' in texto
    assert 'user.email "github-actions[bot]@users.noreply.github.com"' in texto
    wf = carregar(PASTA / "etl.yml")
    commit = next(s for s in passos(wf) if s.get("name", "").startswith("Commitar"))
    assert commit["if"] == "steps.validar.outcome == 'success'"  # nunca commita dado que não passou no schema


def test_issues_e_resumo_rodam_mesmo_com_falha() -> None:
    wf = carregar(PASTA / "etl.yml")
    por_nome = {s["name"]: s for s in passos(wf) if "name" in s}
    assert por_nome["Issues de qualidade (uma por fonte)"]["if"] == "always()"
    assert por_nome["Resumo da execução"]["if"] == "always()"
    assert por_nome["Rodar o ETL"]["id"] == "etl"


def test_ci_valida_os_dados_publicados() -> None:
    texto = (PASTA / "ci.yml").read_text(encoding="utf-8")
    assert "painel-etl validate" in texto
