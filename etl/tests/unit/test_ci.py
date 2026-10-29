"""Automação: mensagem de commit, resumo, Issues de qualidade e rotina mensal."""

from __future__ import annotations

import datetime as dt
import gzip
import json
from pathlib import Path
from typing import Any

import httpx
import pytest
import respx
from typer.testing import CliRunner

from painel_etl import ci, issues, pipeline
from painel_etl.cli import app
from painel_etl.core import quality
from painel_etl.core.http import Http
from painel_etl.sources import b3_cotahist
from tests.unit.test_sources import TestCotahist, linha_cot


def resultado(dataset: str = "acoes", **kw: Any) -> dict[str, Any]:
    base = {
        "dataset": dataset, "publicado": True, "mudou": False, "contagem": 568, "eventos": 0, "erro": "", "avisos": [],
        "fontes": {}, "nao_mapeados": [], "qualidade": {"erros": [], "avisos": []},
    }  # fmt: skip
    return {**base, **kw}


def relatorio(*resultados: dict[str, Any]) -> dict[str, Any]:
    return {"data": "2026-10-29", "resultados": list(resultados)}


class TestResumo:
    def test_mensagem_de_commit_no_formato_do_prompt(self) -> None:
        rel = relatorio(resultado("acoes", eventos=2), resultado("bdrs", eventos=1))
        assert ci.mensagem_commit(rel) == "data(acoes,bdrs): atualização 2026-10-29 [+3 eventos]"

    def test_so_lista_o_que_foi_publicado(self) -> None:
        rel = relatorio(resultado("acoes", publicado=False), resultado("bdrs"))
        assert ci.mensagem_commit(rel) == "data(bdrs): atualização 2026-10-29 [+0 eventos]"
        assert ci.mensagem_commit(relatorio(resultado("mensal"))) == "data(estado): atualização 2026-10-29 [+0 eventos]"

    def test_resumo_mostra_erros_avisos_e_fontes_ruins(self) -> None:
        r = resultado(
            "bdrs", publicado=False, erro="API fora", avisos=["finservices caiu"],
            fontes={"b3_finservices": {"status": "desatualizado", "mensagem": "timeout"}},
            qualidade={"erros": [{"codigo": "queda", "mensagem": "85 contra 100"}], "avisos": []},
        )  # fmt: skip
        md = ci.resumo_markdown(relatorio(r))
        assert "❌ não publicado" in md and "API fora" in md and "`queda`" in md and "finservices caiu" in md
        assert "`b3_finservices` (desatualizado): timeout" in md

    def test_falhou(self) -> None:
        assert not ci.falhou(relatorio(resultado()))
        assert ci.falhou(relatorio(resultado(publicado=False)))
        assert ci.falhou(relatorio(resultado(erro="x")))


class TestIssues:
    def test_fonte_com_problema_abre_uma_issue(self) -> None:
        rel = relatorio(resultado(fontes={"b3_listed": {"status": "erro", "mensagem": "HTTP 500"}}))
        plano = issues.planejar(rel, {})
        abrir = [a for a in plano if a.tipo == "abrir"]
        assert [a.titulo for a in abrir] == ["[data-quality] b3_listed"]
        assert "HTTP 500" in abrir[0].corpo

    def test_issue_ja_aberta_e_atualizada_e_nao_duplicada(self) -> None:
        rel = relatorio(resultado(fontes={"b3_listed": {"status": "erro", "mensagem": "HTTP 500"}}))
        plano = issues.planejar(rel, {"b3_listed": 7})
        assert [(a.tipo, a.numero) for a in plano if a.chave == "b3_listed"] == [("atualizar", 7)]

    def test_fonte_que_voltou_fecha_a_issue_sozinha(self) -> None:
        rel = relatorio(resultado(fontes={"b3_listed": {"status": "ok"}}))
        plano = issues.planejar(rel, {"b3_listed": 7, "cvm_fca": 8})
        assert [(a.tipo, a.chave, a.numero) for a in plano if a.tipo == "fechar"] == [("fechar", "b3_listed", 7)]

    def test_fonte_ausente_do_relatorio_nao_e_tocada(self) -> None:
        """Execução diária não roda as fontes semanais: a Issue delas não pode ser fechada por silêncio."""
        plano = issues.planejar(relatorio(resultado()), {"bradesco": 9})
        assert all(a.chave != "bradesco" for a in plano)

    def test_dataset_nao_publicado_abre_issue_com_os_erros_do_portao(self) -> None:
        r = resultado(
            "acoes",
            publicado=False,
            qualidade={"erros": [{"codigo": "queda", "mensagem": "50 contra 568"}], "avisos": []},
        )
        plano = issues.planejar(relatorio(r), {})
        a = next(x for x in plano if x.chave == "dataset:acoes")
        assert a.tipo == "abrir" and "50 contra 568" in a.corpo

    def test_instituicao_nao_mapeada_abre_issue_e_fecha_quando_some(self) -> None:
        com = relatorio(resultado("acoes", nao_mapeados=["Banco Novo"]))
        assert any(
            a.chave == "nomes-nao-mapeados" and a.tipo == "abrir" and "Banco Novo" in a.corpo
            for a in issues.planejar(com, {})
        )
        sem = relatorio(resultado("acoes"))
        assert any(
            a.chave == "nomes-nao-mapeados" and a.tipo == "fechar"
            for a in issues.planejar(sem, {"nomes-nao-mapeados": 3})
        )

    def test_executar_traduz_o_plano_em_chamadas_gh(self) -> None:
        chamadas: list[tuple[list[str], str | None]] = []

        def gh(args: list[str], entrada: str | None) -> str:
            chamadas.append((args, entrada))
            return ""

        plano = [
            issues.Acao("abrir", "a", "[data-quality] a", "corpo a"),
            issues.Acao("atualizar", "b", "[data-quality] b", "corpo b", 2),
            issues.Acao("fechar", "c", "[data-quality] c", "ok", 3),
        ]
        issues.executar(plano, gh)
        verbos = [(c[0][0], c[0][1]) for c in chamadas]
        assert verbos == [("label", "create"), ("issue", "create"), ("issue", "edit"), ("issue", "close")]
        assert chamadas[1][1] == "corpo a" and "--label" in chamadas[1][0] and issues.LABEL in chamadas[1][0]
        assert chamadas[2][0][2] == "2" and chamadas[3][0][2] == "3"

    def test_listar_abertas_ignora_issues_que_nao_sao_nossas(self) -> None:
        saida = json.dumps([{"number": 4, "title": "[data-quality] cvm_fca"}, {"number": 5, "title": "outra coisa"}])
        assert issues.listar_abertas(lambda *_: saida) == {"cvm_fca": 4}

    def test_cli_dry_run_mostra_o_plano_sem_chamar_o_gh(self, tmp_path: Path) -> None:
        arq = tmp_path / "r.json"
        arq.write_text(
            json.dumps(relatorio(resultado(fontes={"cvm_fca": {"status": "erro", "mensagem": "x"}}))), encoding="utf-8"
        )
        r = CliRunner().invoke(app, ["issues", "--report", str(arq), "--dry-run"])
        assert r.exit_code == 0 and "abrir: [data-quality] cvm_fca" in r.stdout

    def test_cli_commit_message(self, tmp_path: Path) -> None:
        arq = tmp_path / "r.json"
        arq.write_text(json.dumps(relatorio(resultado("acoes", eventos=4))), encoding="utf-8")
        r = CliRunner().invoke(app, ["commit-message", "--report", str(arq)])
        assert r.stdout.strip() == "data(acoes): atualização 2026-10-29 [+4 eventos]"


def test_resultado_serializa_o_portao_de_qualidade() -> None:
    rel = quality.Relatorio("acoes")
    rel.erro("queda", "x")
    rel.aviso("cnpj_invalido", "y")
    d = pipeline.Resultado("acoes", relatorio=rel, nao_mapeados=["Z"]).como_dict()
    assert d["qualidade"] == {
        "erros": [{"codigo": "queda", "mensagem": "x"}],
        "avisos": [{"codigo": "cnpj_invalido", "mensagem": "y"}],
    }
    assert d["nao_mapeados"] == ["Z"]
    json.dumps(d)  # tem de ser serializável


class TestMensal:
    def contexto(self, raiz: Path) -> pipeline.Contexto:
        return pipeline.Contexto(
            hoje=dt.date(2026, 10, 5), raiz=raiz, cache=raiz / "cache",
            http=lambda n: Http(n, wait=lambda _s: 0.0, sleep=lambda _s: None),
        )  # fmt: skip

    @respx.mock
    def test_reconcilia_o_mes_anterior_e_cria_snapshot_imutavel(self, tmp_path: Path) -> None:
        pasta = tmp_path / "history" / "bdr_volume"
        diario = b3_cotahist.Agregado("ACME", "DRN", "X", 100000, 5, "2026-09-01", "2026-09-02", 1.0)
        b3_cotahist.gravar_particao("2026-09", {"AAPL34": diario}, "diario", ["2026-09-01"], pasta)
        mensal = TestCotahist.zip_dia(
            linha_cot("20260901", "AAPL34", vol=100000), linha_cot("20260902", "AAPL34", vol=100000)
        )
        respx.get(b3_cotahist.url_mensal(2026, 9)).mock(return_value=httpx.Response(200, content=mensal))
        (tmp_path / "public" / "downloads").mkdir(parents=True)
        (tmp_path / "public" / "downloads" / "acoes.csv").write_bytes(b"a;b\n1;2\n")
        (tmp_path / "public" / "downloads" / "bdrs.csv").write_bytes(b"x\n")

        r = pipeline.mensal(self.contexto(tmp_path))
        assert r.publicado and not r.erro and r.mudou
        assert any("0,5%" in a for a in r.avisos)  # diário 1.000 contra mensal 2.000
        assert b3_cotahist.ler_particao("2026-09", pasta)["fonte"] == "mensal"  # type: ignore[index]
        snap = tmp_path / "history" / "snapshots" / "2026-09" / "acoes.csv.gz"
        assert gzip.decompress(snap.read_bytes()) == b"a;b\n1;2\n"

        (tmp_path / "public" / "downloads" / "acoes.csv").write_bytes(b"mudou\n")
        r2 = pipeline.mensal(self.contexto(tmp_path))
        assert not r2.mudou  # já oficial e snapshot existente: nada muda
        assert gzip.decompress(snap.read_bytes()) == b"a;b\n1;2\n"  # snapshot não é reescrito

    @respx.mock
    def test_mes_ainda_nao_publicado_vira_aviso_sem_derrubar(self, tmp_path: Path) -> None:
        respx.get(b3_cotahist.url_mensal(2026, 9)).mock(return_value=httpx.Response(404))
        r = pipeline.mensal(self.contexto(tmp_path))
        assert r.publicado and any("ainda não publicado" in a for a in r.avisos)
        assert r.fontes["b3_cotahist"]["status"] == "desatualizado"


@pytest.mark.parametrize("nome", ["acoes", "bdrs"])
def test_snapshots_nao_sao_criados_sem_publicacao(tmp_path: Path, nome: str) -> None:
    ctx = pipeline.Contexto(hoje=dt.date(2026, 10, 5), raiz=tmp_path, cache=tmp_path / "c")
    b3_cotahist.gravar_particao("2026-09", {}, "mensal", [], tmp_path / "history" / "bdr_volume")
    r = pipeline.mensal(ctx)
    assert r.publicado and not (tmp_path / "history" / "snapshots" / "2026-09" / f"{nome}.csv.gz").exists()
