"""Itens 8.1 e 8.2: parser único, liquidez por ticker e companhia, categorias e eventos."""

from __future__ import annotations

import datetime as dt
import io
import zipfile
from pathlib import Path
from typing import Any, ClassVar

import httpx
import pytest
import respx

from painel_etl import pipeline, seed_import
from painel_etl.core import diff
from painel_etl.core import io as pio
from painel_etl.core.http import Http
from painel_etl.datasets import acoes_liquidez as ds
from painel_etl.datasets.bdrs import meses_fechados
from painel_etl.indicadores import carregar
from painel_etl.normalize.tickers import is_acao_especie
from painel_etl.sources import b3_cotahist
from tests.unit.test_sources import linha_cot

HOJE = dt.date(2026, 11, 3)
MESES = meses_fechados(HOJE)
CFG = carregar().liquidez


def particao(pregoes: int = 20, **tickers: dict[str, Any]) -> dict[str, Any]:
    return {
        "pregoes": [f"d{i}" for i in range(pregoes)],
        "fonte": "mensal",
        "tickers": {t: base(**v) for t, v in tickers.items()},
    }


def base(
    volume: int = 1000, negocios: int = 10, dias: int = 20, ultimo: str = "2026-10-30", **kw: Any
) -> dict[str, Any]:
    return {
        "volume": volume, "negocios": negocios, "quantidade": kw.get("quantidade", 100), "dias_com_negocio": dias,
        "volume_fracionario": kw.get("frac", 0), "ultimo_pregao": ultimo, "ultimo_preco": 10.0,
    }  # fmt: skip


def zip_de(*linhas: str) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("COTAHIST.TXT", "\r\n".join(["00COTAHIST", *linhas, "99COTAHIST"]) + "\r\n")
    return buf.getvalue()


class TestFiltro:
    @pytest.mark.parametrize(
        ("esp", "esperado"),
        [
            ("ON", True), ("PN      N1", True), ("PNA ED", True), ("UNT     N2", True), ("PN  REC N1", False),
            ("BNS", False), ("DIR", False), ("TPR", False), ("CI", False), ("DRN", False), ("IBO/", False), ("", False),
        ],
    )  # fmt: skip
    def test_especie(self, esp: str, esperado: bool) -> None:
        assert is_acao_especie(esp) is esperado

    def test_fixture_real_de_out_2026(self, fixtures: Path) -> None:
        bruto = (fixtures / "b3_cotahist" / "COTAHIST_M102026_etapa80_extrato.txt").read_bytes().decode("iso-8859-1")
        linhas = [x for x in bruto.split("\r\n") if x]
        le = b3_cotahist.ler_arquivo(linhas)
        acoes = le.meses["acao"]["2026-10"]
        assert {"PETR4", "BOBR4", "AALR3"} <= set(acoes)  # lote padrão, recuperação judicial e extrajudicial entram
        assert not {"IBOV11", "NVDC34", "BBDC10", "AAGR11", "ONCO11", "PSVM11"} & set(acoes)  # índice, BDR, recibo...
        petr = acoes["PETR4"]
        assert petr.volume_fracionario_centavos > 0 and petr.negocios_fracionario > 0
        assert petr.dias_com_negocio == 2  # o extrato traz 01/10 e 30/10
        assert not [t for t in le.meses["bdr"]["2026-10"] if t.endswith("F")]  # ADR 0005


class TestParserUnico:
    """Cada arquivo é baixado uma vez e alimenta todas as categorias."""

    @respx.mock
    def test_diario_baixa_uma_vez_e_grava_as_duas_categorias(self, tmp_path: Path) -> None:
        conteudo = zip_de(
            linha_cot("20261103", "PETR4", especi="PN", nome="PETROBRAS", neg=5, vol=100000, qtd=300),
            linha_cot("20261103", "PETR4F", mercado="020", especi="PN", nome="PETROBRAS", neg=2, vol=500, qtd=7),
            linha_cot("20261103", "AAPL34", vol=70000),
        )
        rota = respx.get(b3_cotahist.url_diario(HOJE)).mock(return_value=httpx.Response(200, content=conteudo))
        respx.get(b3_cotahist.url_diario(dt.date(2026, 11, 2))).mock(return_value=httpx.Response(404))
        respx.get(b3_cotahist.url_mensal(2026, 10)).mock(return_value=httpx.Response(404))
        ctx = pipeline.Contexto(
            hoje=HOJE, raiz=tmp_path, cache=tmp_path / "cache",
            http=lambda n: Http(n, wait=lambda _s: 0.0, sleep=lambda _s: None),
        )  # fmt: skip
        for nome, cat in (("bdrs", b3_cotahist.BDR), ("acoes_liquidez", b3_cotahist.ACAO)):
            pipeline._cotahist(ctx, pipeline.Resultado(nome), cat)
        assert rota.call_count == 1
        acoes = b3_cotahist.ler_particao("2026-11", tmp_path / "history" / "acoes_liquidez")
        assert acoes
        v = acoes["tickers"]["PETR4"]
        assert (v["volume"], v["volume_fracionario"], v["negocios"], v["negocios_fracionario"]) == (1005, 5, 7, 2)
        assert (v["quantidade"], v["dias_com_negocio"]) == (307, 1)
        bdr = b3_cotahist.ler_particao("2026-11", tmp_path / "history" / "bdr_volume")
        assert bdr and set(bdr["tickers"]) == {"AAPL34"} and "dias_com_negocio" not in bdr["tickers"]["AAPL34"]

    @respx.mock
    def test_mensal_baixa_uma_vez_e_conta_todos_os_pregoes(self, tmp_path: Path) -> None:
        conteudo = zip_de(
            linha_cot("20261001", "AAPL34", vol=70000),
            linha_cot("20261002", "OUTR3", especi="ON", vol=100),
            linha_cot("20261005", "OPCA10", mercado="070", especi="OPC"),
        )
        rota = respx.get(b3_cotahist.url_mensal(2026, 10)).mock(return_value=httpx.Response(200, content=conteudo))
        alvos = [(c, tmp_path / "history" / c.pasta) for c in b3_cotahist.CATEGORIAS]
        http = Http("b3", wait=lambda _s: 0.0, sleep=lambda _s: None)
        r = b3_cotahist.processar_mensal_varias(http, 2026, 10, cache=tmp_path / "c", alvos=alvos)
        assert rota.call_count == 1 and r["acao"]["tickers"] == 1 and r["bdr"]["tickers"] == 1
        parte = b3_cotahist.ler_particao("2026-10", tmp_path / "history" / "acoes_liquidez")
        # Todas as datas do arquivo, inclusive a que só tem opção: a definição de "pregões do mês".
        assert parte and parte["pregoes"] == ["2026-10-01", "2026-10-02", "2026-10-05"]
        assert parte["conferencia"] == {"acoes_filtro_ticker": 1, "total_vista_fracionario": 701}

    @respx.mock
    def test_backfill_reaproveita_o_zip_do_cache(self, tmp_path: Path) -> None:
        cache = tmp_path / "c"
        cache.mkdir()
        (cache / "COTAHIST_M102026.ZIP").write_bytes(zip_de(linha_cot("20261001", "OUTR3", especi="ON")))
        rota = respx.get(b3_cotahist.url_mensal(2026, 10))
        http = Http("b3", wait=lambda _s: 0.0, sleep=lambda _s: None)
        alvos = [(b3_cotahist.ACAO, tmp_path / "h" / "acoes_liquidez")]
        r = b3_cotahist.processar_mensal_varias(http, 2026, 10, cache=cache, alvos=alvos, reutilizar=True)
        assert r["acao"]["status"] == "ok" and not rota.called


class TestEstouroDeNegocios:
    CFG = carregar().estouro_negocios

    def test_caso_real_da_petr4(self) -> None:
        """11/02/2026: 39 negócios e 45 milhões de ações; nos dias vizinhos, cerca de 600 ações por negócio."""
        dias = [(f"2026-02-{d:02d}", 60_000, 36_000_000) for d in range(2, 11)]
        dias.append(("2026-02-11", 39, 45_000_000))
        assert b3_cotahist.dias_suspeitos(dias, self.CFG) == ["2026-02-11"]

    def test_dia_comum_e_papel_pouco_negociado_nao_acusam(self) -> None:
        assert not b3_cotahist.dias_suspeitos([(f"d{i}", 50_000, 30_000_000) for i in range(10)], self.CFG)
        assert not b3_cotahist.dias_suspeitos([(f"d{i}", 10, 1000) for i in range(10)], self.CFG)

    def test_negocio_em_bloco_em_papel_pouco_negociado_nao_acusa(self) -> None:
        """BDR com 20 negócios por dia e um bloco de 2 milhões: o número é real, não estouro."""
        dias = [(f"d{i}", 20, 200) for i in range(10)] + [("bloco", 25, 2_000_000)]
        assert not b3_cotahist.dias_suspeitos(dias, self.CFG)

    def test_poucos_pregoes_nao_tem_tamanho_tipico(self) -> None:
        assert not b3_cotahist.dias_suspeitos([("a", 39, 45_000_000), ("b", 60_000, 36_000_000)], self.CFG)


class TestConstruir:
    CIAS: ClassVar[list[dict[str, Any]]] = [
        {"codigo_cvm": "9512", "pregao": "PETROBRAS", "tickers": [{"ticker": "PETR3"}, {"ticker": "PETR4"}]},
        {"codigo_cvm": "2437", "pregao": "AXIA", "tickers": [{"ticker": "AXIA3"}]},
    ]

    def particoes(self) -> dict[str, dict[str, Any]]:
        saida = {}
        for i, m in enumerate(MESES):
            tickers: dict[str, Any] = {
                "PETR3": {"volume": 100, "negocios": 10, "dias": 10},
                "PETR4": {"volume": 900, "negocios": 90, "dias": 18},
                "OLDX3": {"volume": 50, "negocios": 5, "dias": 1},
            }
            tickers["ELET3" if i < 12 else "AXIA3"] = {"volume": 200, "negocios": 20, "dias": 20}
            saida[m] = particao(20, **tickers)
        return saida

    def test_companhia_soma_os_tickers_e_presenca_e_do_mais_negociado(self) -> None:
        doc = ds.construir(self.particoes(), MESES, None, self.CIAS, {}, {}, CFG)
        petro = next(c for c in doc["companhias"] if c["codigo_cvm"] == "9512")
        assert petro["mensal"]["volume"] == [1000] * 24 and petro["mensal"]["negocios"] == [100] * 24
        assert petro["mensal"]["dias_com_negocio"] == [18] * 24  # os da PETR4, não 28
        assert petro["mensal"]["presenca"] == [0.9] * 24 and petro["mensal"]["ticket_medio"] == [10.0] * 24
        assert petro["mensal"]["volume_medio_diario"] == [50] * 24 and petro["ticker_principal"] == "PETR4"
        a = petro["agregados"]["6m"]
        assert (a["volume"], a["dias_com_negocio"], a["pregoes"], a["presenca"]) == (6000, 108, 120, 0.9)

    def test_ticker_antigo_atribuido_pelo_fca_mantem_a_serie(self) -> None:
        doc = ds.construir(self.particoes(), MESES, None, self.CIAS, {"ELET3": "2437"}, {}, CFG)
        axia = next(c for c in doc["companhias"] if c["codigo_cvm"] == "2437")
        assert axia["mensal"]["volume"] == [200] * 24 and axia["tickers"] == ["AXIA3", "ELET3"]
        elet = next(t for t in doc["tickers"] if t["ticker"] == "ELET3")
        assert elet["historico"] is True and elet["codigo_cvm"] == "2437"

    def test_nada_se_perde_e_a_validacao_confere(self) -> None:
        part = self.particoes()
        doc = {**ds.construir(part, MESES, None, self.CIAS, {}, {}, CFG), "meses": MESES}
        assert doc["nao_atribuido"]["tickers"] == 2  # OLDX3 e ELET3 sem o mapa
        assert ds.validar(doc, part, None, CFG).ok

    def test_mes_sem_negocio_tem_ticket_nulo(self) -> None:
        part = {m: particao(20, PETR4={"volume": 10, "negocios": 1, "dias": 1}) for m in MESES}
        part[MESES[0]] = particao(20)
        doc = ds.construir(part, MESES, None, self.CIAS, {}, {}, CFG)
        m = doc["tickers"][0]["mensal"]
        assert m["ticket_medio"][0] is None and m["negocios"][0] == 0 and m["presenca"][0] == 0.0

    def test_validacao_reprova_presenca_acima_de_1(self) -> None:
        part = {m: particao(20, PETR4={"dias": 25}) for m in MESES}
        doc = {**ds.construir(part, MESES, None, self.CIAS, {}, {}, CFG), "meses": MESES}
        assert "presenca_maior_que_1" in {e.codigo for e in ds.validar(doc, part, None, CFG).erros}

    def test_meses_suspeitos_aparecem_no_ticker_e_na_companhia(self) -> None:
        sus = {MESES[-1]: {"PETR4": ["2026-10-26"]}}
        doc = ds.construir(self.particoes(), MESES, None, self.CIAS, {}, sus, CFG)
        assert next(c for c in doc["companhias"] if c["codigo_cvm"] == "9512")["meses_negocios_suspeitos"] == [
            MESES[-1]
        ]
        assert next(t for t in doc["tickers"] if t["ticker"] == "PETR3")["meses_negocios_suspeitos"] == []


class TestClassificar:
    def cat(
        self, part: dict[str, Any], *, tickers: tuple[str, ...] = ("PETR4",), desde: str | None = "2010-01-01"
    ) -> dict[str, str]:
        return ds.classificar(list(tickers), list(tickers), desde, part, MESES, HOJE, CFG)

    def com(self, dias: int) -> dict[str, Any]:
        return {m: particao(20, PETR4={"dias": dias}) for m in MESES}

    def test_sem_ticker(self) -> None:
        assert self.cat(self.com(20), tickers=())["categoria"] == "sem_ticker"

    def test_listagem_recente_tem_precedencia(self) -> None:
        r = self.cat(self.com(1), desde="2026-09-15")
        assert r["categoria"] == "listagem_recente" and "15/09/2026" in r["criterio_texto"]

    def test_sem_registro_na_janela_inteira(self) -> None:
        r = self.cat({m: particao(20) for m in MESES})
        assert r["categoria"] == "sem_cotacao_no_periodo" and "24 meses" in r["criterio_texto"]

    def test_sem_negocios_nos_ultimos_3_meses(self) -> None:
        part = {m: particao(20, PETR4={"ultimo": f"{m}-15"}) if m < MESES[-3] else particao(20) for m in MESES}
        r = self.cat(part)
        assert r["categoria"] == "sem_negocios" and "15/07/2026" in r["criterio_texto"]

    @pytest.mark.parametrize(
        ("dias", "categoria"),
        [(4, "presenca_baixa"), (5, "presenca_media"), (15, "presenca_media"), (16, "presenca_alta")],
    )
    def test_limiares_de_presenca(self, dias: int, categoria: str) -> None:
        r = self.cat(self.com(dias))
        assert r["categoria"] == categoria
        assert r["criterio_texto"] == f"Negociou em {dias * 6} de 120 pregões nos últimos 6 meses."

    def test_linguagem_e_factual(self) -> None:
        for dias in (1, 10, 20):
            texto = self.cat(self.com(dias))["criterio_texto"].lower()
            assert not {"ruim", "problema", "ilíquid", "risco"} & set(texto.split())


class TestEventos:
    def acao(self, categoria: str | None, segmento_cvm: str | None = None) -> dict[str, Any]:
        return {
            "pregao": "X", "segmento": "NM", "detalhe_b3": True, "tickers": [], "divergente_b3_cvm": False,
            "escriturador_b3": {"on": "A", "pn": None}, "escriturador_cvm": None,
            "liquidez": {"categoria": categoria, "criterio_texto": "t"} if categoria else None,
            "listagem": {"segmento_cvm": segmento_cvm} if segmento_cvm else None,
        }  # fmt: skip

    def tipos(self, a: dict[str, Any], d: dict[str, Any]) -> list[tuple[str, Any, Any]]:
        return [(e["tipo"], e["de"], e["para"]) for e in diff.diff_acoes({"1": a}, {"1": d}, HOJE)]

    def test_entrada_e_saida(self) -> None:
        assert self.tipos(self.acao("presenca_media"), self.acao("presenca_baixa")) == [
            ("entrou_presenca_baixa", "presenca_media", "presenca_baixa")
        ]
        assert self.tipos(self.acao("sem_negocios"), self.acao("presenca_baixa")) == [
            ("saiu_sem_negocios", "sem_negocios", "presenca_baixa"),
            ("entrou_presenca_baixa", "sem_negocios", "presenca_baixa"),
        ]

    def test_primeira_classificacao_nao_vira_novidade(self) -> None:
        assert self.tipos(self.acao(None), self.acao("sem_negocios")) == []

    def test_mudanca_de_segmento_da_cvm(self) -> None:
        eventos = diff.diff_acoes({"1": self.acao(None, "Básico")}, {"1": self.acao(None, "Novo Mercado")}, HOJE)
        assert [(e["tipo"], e["fonte"]) for e in eventos] == [("mudanca_segmento", "CVM")]

    def test_tipos_novos_estao_no_schema(self) -> None:
        import json

        from painel_etl import paths

        sch = json.loads((paths.schemas_dir() / "eventos.schema.json").read_text(encoding="utf-8"))
        assert set(sch["properties"]["eventos"]["items"]["properties"]["tipo"]["enum"]) == set(diff.TIPOS)


class TestClassificarNoPipeline:
    def companhia(self, liquidez: dict[str, str] | None = None) -> dict[str, Any]:
        return {
            "codigo_cvm": "9512", "cnpj": "33.000.167/0001-01", "tickers": [{"ticker": "PETR4"}], "listagem": None,
            "liquidez": liquidez,
        }  # fmt: skip

    def test_com_particoes_classifica(self, tmp_path: Path) -> None:
        pasta = tmp_path / "history" / "acoes_liquidez"
        for m in MESES:
            a = b3_cotahist.Agregado("P", "PN", "X", 100, 1, f"{m}-02", f"{m}-02", 1.0)
            a.dias_anteriores = 20
            b3_cotahist.gravar_particao(
                m, {"PETR4": a}, "mensal", [f"{m}-{d:02d}" for d in range(1, 21)], pasta, detalhada=True
            )
        ctx = pipeline.Contexto(hoje=HOJE, raiz=tmp_path, cache=tmp_path / "c", cotahist={})
        cias = [self.companhia()]
        pipeline._classificar_liquidez(ctx, pipeline.Resultado("acoes"), cias, {}, {})
        assert cias[0]["liquidez"]["categoria"] == "presenca_alta"

    def test_sem_particoes_mantem_a_ultima_classificacao_boa(self, tmp_path: Path) -> None:
        ctx = pipeline.Contexto(hoje=HOJE, raiz=tmp_path, cache=tmp_path / "c", cotahist={})
        anterior = {"categoria": "sem_negocios", "criterio_texto": "t"}
        cias = [self.companhia()]
        res = pipeline.Resultado("acoes")
        pipeline._classificar_liquidez(ctx, res, cias, {}, {"9512": {"liquidez": anterior}})
        assert cias[0]["liquidez"] == anterior and any("mantida a última" in a for a in res.avisos)


class TestPipeline:
    @pytest.fixture
    def raiz(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
        seed_import.importar(destino=tmp_path / "public")
        monkeypatch.setattr(pipeline, "_cotahist", lambda *_a, **_k: None)
        pasta = tmp_path / "history" / "acoes_liquidez"
        for m in MESES:
            a = b3_cotahist.Agregado("PETROBRAS", "PN", "BRPETRACNPR6", 100_000, 5, f"{m}-02", f"{m}-20", 30.0)
            a.dias_anteriores = 10
            b3_cotahist.gravar_particao(
                m, {"PETR4": a}, "mensal", [f"{m}-{d:02d}" for d in range(1, 21)], pasta, detalhada=True
            )
        return tmp_path

    def test_publica_json_valido_e_csv_e_e_idempotente(self, raiz: Path) -> None:
        ctx = pipeline.Contexto(hoje=HOJE, raiz=raiz, cache=raiz / "c")
        r = pipeline.run_acoes_liquidez(ctx)
        assert r.publicado and r.mudou and not r.erro and r.contagem == 1
        doc = pio.read_json(raiz / "public" / "acoes_liquidez.json")
        assert doc["schema_version"] == "1.0" and doc["pregoes_mes"] == [20] * 24
        assert doc["companhias"][0]["agregados"]["3m"]["presenca"] == 0.5
        assert "9512;PETROBRAS;PETR4;" in (raiz / "public" / "downloads" / "acoes_liquidez.csv").read_text("utf-8")
        assert "9512;PETROBRAS;PETR4;" in (raiz / "public" / "downloads" / "acoes_volume.csv").read_text("utf-8")
        res = pio.read_json(raiz / "public" / "acoes_liquidez_resumo.json")
        cia = res["companhias"][0]
        assert cia["volume_mensal"] == doc["companhias"][0]["mensal"]["volume"] and cia["volume_24m"] == 24_000
        assert set(cia["agregados"]["3m"]) == set(ds.CAMPOS_RESUMO) and "mensal" not in cia
        antes = (raiz / "public" / "acoes_liquidez.json").read_bytes()
        again = pipeline.run_acoes_liquidez(pipeline.Contexto(hoje=HOJE, raiz=raiz, cache=raiz / "c"))
        assert not again.mudou and (raiz / "public" / "acoes_liquidez.json").read_bytes() == antes

    def test_sem_particoes_pede_o_backfill(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        seed_import.importar(destino=tmp_path / "public")
        monkeypatch.setattr(pipeline, "_cotahist", lambda *_a, **_k: None)
        r = pipeline.run_acoes_liquidez(pipeline.Contexto(hoje=HOJE, raiz=tmp_path, cache=tmp_path / "c"))
        assert not r.publicado and "backfill cotahist --datasets acoes" in r.erro
