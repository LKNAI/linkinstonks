"""Casos de borda do pipeline (Fase 7): fonte fora do ar, ZIP corrompido, feriado e queda de contagem.

Em todos, a regra é a mesma: o dado já publicado nunca é degradado, o problema vira aviso/erro no relatório e a
execução seguinte se recupera sozinha.
"""

from __future__ import annotations

import datetime as dt
import io
import json
import zipfile
from pathlib import Path

import httpx
import pytest
import respx

from painel_etl import ci, pipeline, seed_import
from painel_etl.core.http import Http
from painel_etl.core.state import State
from painel_etl.sources import b3_cotahist
from painel_etl.sources.b3_listed import ListedCompany
from tests.unit.test_sources import linha_cot

HOJE = dt.date(2026, 10, 29)  # quinta-feira


def ctx(raiz: Path, **kw: object) -> pipeline.Contexto:
    """Contexto isolado em `raiz`, com HTTP sem esperas reais."""
    return pipeline.Contexto(
        hoje=HOJE,
        raiz=raiz,
        cache=raiz / "cache",
        http=lambda nome: Http(nome, wait=lambda _s: 0.0, sleep=lambda _s: None),
        **kw,  # type: ignore[arg-type]
    )


def zip_dia(*linhas: str) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("COTAHIST.TXT", "\r\n".join(["00COTAHIST", *linhas, "99COTAHIST"]) + "\r\n")
    return buf.getvalue()


@pytest.fixture
def cotahist(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Partição do mês corrente já publicada (boa), estado começando em 28/10 e as partições isoladas em tmp."""
    pasta = tmp_path / "bdr_volume"
    monkeypatch.setattr(b3_cotahist, "particao_dir", lambda: pasta)
    a = b3_cotahist.Agregado("ACME INC", "DRN", "BRACMEBDR001", 100, 1, "2026-10-27", "2026-10-27", 1.0)
    b3_cotahist.gravar_particao("2026-10", {"AAPL34": a}, "diario", ["2026-10-27"], pasta)
    state = State("cotahist", tmp_path / "state")
    state.set("inicio", "2026-10-28")
    state.set("processados", ["2026-10-27"])
    state.save()
    return pasta


def bytes_da_particao(pasta: Path) -> bytes:
    return (pasta / "2026-10.json").read_bytes()


class TestCotahistNoPipeline:
    @respx.mock
    def test_zip_corrompido_nao_derruba_nem_marca_o_pregao_e_a_proxima_execucao_se_recupera(
        self, tmp_path: Path, cotahist: Path
    ) -> None:
        antes = bytes_da_particao(cotahist)
        respx.get(b3_cotahist.url_diario(dt.date(2026, 10, 28))).mock(
            return_value=httpx.Response(200, content=b"isto nao e um zip")
        )
        respx.get(b3_cotahist.url_diario(HOJE)).mock(return_value=httpx.Response(404))
        respx.get(b3_cotahist.url_mensal(2026, 9)).mock(return_value=httpx.Response(404))

        res = pipeline.Resultado("bdrs")
        pipeline._cotahist(ctx(tmp_path), res)
        assert res.fontes["b3_cotahist"]["status"] == "desatualizado"
        assert any("COTAHIST indisponível" in a for a in res.avisos)
        assert bytes_da_particao(cotahist) == antes  # o publicado não é tocado
        assert State("cotahist", tmp_path / "state").get("processados") == ["2026-10-27"]  # 28/10 NÃO foi marcado

        # a B3 republica o arquivo íntegro: a execução seguinte processa o dia e a partição passa a incluí-lo
        respx.get(b3_cotahist.url_diario(dt.date(2026, 10, 28))).mock(
            return_value=httpx.Response(200, content=zip_dia(linha_cot("20261028", "AAPL34", vol=300)))
        )
        res2 = pipeline.Resultado("bdrs")
        pipeline._cotahist(ctx(tmp_path), res2)
        assert res2.fontes["b3_cotahist"]["status"] == "ok"
        assert State("cotahist", tmp_path / "state").get("processados") == ["2026-10-27", "2026-10-28"]
        parte = b3_cotahist.ler_particao("2026-10", cotahist)
        assert parte and parte["tickers"]["AAPL34"]["volume"] == 4  # R$ 1 já publicado + R$ 3 do dia recuperado

    @respx.mock
    def test_cotahist_fora_do_ar_mantem_a_particao_e_avisa(self, tmp_path: Path, cotahist: Path) -> None:
        antes = bytes_da_particao(cotahist)
        respx.route(url__startswith=b3_cotahist.BASE).mock(return_value=httpx.Response(503))
        res = pipeline.Resultado("bdrs")
        pipeline._cotahist(ctx(tmp_path), res)
        assert res.fontes["b3_cotahist"]["status"] == "desatualizado"
        assert res.avisos and "usando as partições existentes" in res.avisos[0]
        assert bytes_da_particao(cotahist) == antes

    @respx.mock
    def test_feriado_404_em_dia_util_nao_e_falha_e_fica_pendente(self, tmp_path: Path, cotahist: Path) -> None:
        for d in (dt.date(2026, 10, 28), HOJE):
            respx.get(b3_cotahist.url_diario(d)).mock(return_value=httpx.Response(404))
        respx.get(b3_cotahist.url_mensal(2026, 9)).mock(return_value=httpx.Response(404))
        res = pipeline.Resultado("bdrs")
        pipeline._cotahist(ctx(tmp_path), res)
        assert res.fontes["b3_cotahist"]["status"] == "ok" and not res.avisos
        st = State("cotahist", tmp_path / "state")
        assert st.get("processados") == ["2026-10-27"] and "2026-10-28" in st.get("espera")  # espera até 3 dias


class TestAcoesNoPipeline:
    @respx.mock
    def test_b3_fora_do_ar_nao_toca_na_publicacao(self, tmp_path: Path) -> None:
        seed_import.importar(destino=tmp_path / "public")
        antes = (tmp_path / "public" / "acoes.json").read_bytes()
        respx.route().mock(side_effect=httpx.ConnectError("sem rede"))
        res = pipeline.run_acoes(ctx(tmp_path))
        assert not res.publicado and res.erro.startswith("b3_listed")
        assert res.fontes["b3_listed"]["status"] == "erro"
        assert (tmp_path / "public" / "acoes.json").read_bytes() == antes
        assert ci.falhou(pipeline.relatorio_execucao(ctx(tmp_path), [res]))  # o job fica vermelho e abre a Issue

    @respx.mock
    def test_queda_de_contagem_acima_de_10_por_cento_nao_publica(self, tmp_path: Path, fixtures: Path) -> None:
        seed_import.importar(destino=tmp_path / "public")  # 568 companhias publicadas
        antes = (tmp_path / "public" / "acoes.json").read_bytes()
        j = json.loads((fixtures / "b3_listed" / "GetInitialCompanies_p1.json").read_bytes())
        parcial = [ListedCompany.model_validate(r) for r in j["results"]]  # a fonte devolve só uma página
        respx.route().mock(side_effect=httpx.ConnectError("sem rede"))  # FCA, cadastro e detalhes indisponíveis
        res = pipeline.run_acoes(ctx(tmp_path, listadas=parcial))
        assert not res.publicado
        assert res.relatorio and [e.codigo for e in res.relatorio.erros] == ["queda"]
        assert (tmp_path / "public" / "acoes.json").read_bytes() == antes  # nada foi sobrescrito
        assert not (tmp_path / "events").exists()  # e nenhum evento falso de "deslistagem em massa"
        assert ci.falhou(pipeline.relatorio_execucao(ctx(tmp_path), [res]))

    @respx.mock
    def test_fonte_devolvendo_vazio_tambem_nao_publica(self, tmp_path: Path) -> None:
        seed_import.importar(destino=tmp_path / "public")
        antes = (tmp_path / "public" / "acoes.json").read_bytes()
        respx.route().mock(side_effect=httpx.ConnectError("sem rede"))
        res = pipeline.run_acoes(ctx(tmp_path, listadas=[]))
        assert not res.publicado and res.relatorio and res.relatorio.erros[0].codigo == "vazio"
        assert (tmp_path / "public" / "acoes.json").read_bytes() == antes
