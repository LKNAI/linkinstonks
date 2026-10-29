"""Dataset `acoes_volume`: o exemplo de escalabilidade (volume mensal de ações), sem fonte nova."""

from __future__ import annotations

import datetime as dt
from pathlib import Path

import pytest

from painel_etl import pipeline, seed_import
from painel_etl.core import io as pio
from painel_etl.datasets import acoes_volume as ds
from painel_etl.datasets.bdrs import meses_fechados
from painel_etl.sources import b3_cotahist

HOJE = dt.date(2026, 10, 29)
MESES = meses_fechados(HOJE)
NAO = {"tickers": 0, "volume_mensal": [0] * 24}
CIAS = [
    {"codigo_cvm": "9512", "pregao": "PETROBRAS", "tickers": [{"ticker": "PETR3"}, {"ticker": "PETR4"}]},
    {"codigo_cvm": "4170", "pregao": "VALE", "tickers": [{"ticker": "VALE3"}]},
    {"codigo_cvm": "1", "pregao": "SEM NEGOCIO", "tickers": [{"ticker": "ZZZZ3"}]},
]


def particao(**vol: int) -> dict:
    """Partição mínima: ticker -> volume em R$ (negócios = 1 por ticker)."""
    return {"tickers": {t: {"volume": v, "negocios": 1} for t, v in vol.items()}}


class TestConstruir:
    def test_soma_os_tickers_de_cada_companhia_por_mes(self) -> None:
        part = {m: particao(PETR3=10, PETR4=90, VALE3=5) for m in MESES}
        cias, nao = ds.construir(part, MESES, None, CIAS)
        petro = next(c for c in cias if c["codigo_cvm"] == "9512")
        assert petro["volume_mensal"] == [100] * 24 and petro["volume_24m"] == 2400
        assert petro["tickers"] == ["PETR3", "PETR4"] and petro["negocios_24m"] == 48
        assert petro["volume_mes_parcial"] is None
        assert nao == {"tickers": 0, "volume_mensal": [0] * 24}

    def test_companhia_sem_negocio_na_janela_nao_aparece_e_a_saida_e_ordenada(self) -> None:
        part = {m: particao(VALE3=5, PETR4=1) for m in MESES}
        cias, _ = ds.construir(part, MESES, None, CIAS)
        assert [c["codigo_cvm"] for c in cias] == ["4170", "9512"]  # ordem por código; "SEM NEGOCIO" fora

    def test_volume_sem_companhia_vai_para_nao_atribuido_e_nada_se_perde(self) -> None:
        part = {m: particao(PETR4=100, OLDX3=50) for m in MESES}  # OLDX3: empresa que saiu do cadastro
        cias, nao = ds.construir(part, MESES, None, CIAS)
        assert nao["tickers"] == 1 and nao["volume_mensal"] == [50] * 24
        total = sum(c["volume_24m"] for c in cias) + sum(nao["volume_mensal"])
        assert total == (100 + 50) * 24  # companhias + não atribuído = total dos arquivos

    def test_mes_parcial_fica_fora_do_total_de_24_meses(self) -> None:
        part = {m: particao(VALE3=10) for m in MESES} | {"2026-10": particao(VALE3=7)}
        cias, _ = ds.construir(part, MESES, "2026-10", CIAS)
        assert cias[0]["volume_24m"] == 240 and cias[0]["volume_mes_parcial"] == 7

    def test_fontes_apontam_para_o_cotahist_oficial_de_cada_mes(self) -> None:
        part = {m: {"fonte": "mensal", "pregoes": []} for m in MESES} | {
            "2026-10": {"fonte": "diario", "pregoes": ["2026-10-01"]}
        }
        f = ds.fontes_volume(part, MESES, "2026-10")
        assert len(f) == 25 and f["2024-10"]["arquivos"][0].endswith("COTAHIST_M102024.ZIP")
        assert f["2026-10"]["tipo"] == "diario"


class TestValidar:
    def cia(self, cvm: str = "1", vol: int = 1) -> dict:
        return {"codigo_cvm": cvm, "pregao": "X", "volume_24m": vol, "volume_mensal": [vol] * 24}

    def test_ok(self) -> None:
        assert ds.validar([self.cia("1"), self.cia("2")], NAO, None, HOJE).ok

    def test_queda_de_contagem_reprova(self) -> None:
        rel = ds.validar([self.cia("1")], NAO, 100, HOJE)
        assert not rel.ok and rel.erros[0].codigo == "queda"

    def test_duplicado_e_volume_negativo_reprovam(self) -> None:
        assert not ds.validar([self.cia("1"), self.cia("1")], NAO, None, HOJE).ok
        assert not ds.validar([self.cia("1", -5)], NAO, None, HOJE).ok

    def test_muito_volume_sem_companhia_so_avisa(self) -> None:
        nao = {"tickers": 30, "volume_mensal": [10] * 24}
        rel = ds.validar([self.cia("1", 1)], nao, None, HOJE)
        assert rel.ok and [a.codigo for a in rel.avisos] == ["volume_sem_companhia"]

    def test_csv_em_reais_mil(self) -> None:
        c = {"codigo_cvm": "9", "pregao": "P", "tickers": ["P3", "P4"], "negocios_24m": 3, "volume_24m": 2_400_000,
             "volume_mensal": [100_000] * 24}  # fmt: skip
        assert ds.csv_cabecalho(MESES)[:5] == ["codigo_cvm", "pregao", "tickers", "negocios_24m", "volume_24m_rs_mil"]
        assert ds.csv_linhas([c])[0][:6] == ["9", "P", "P3 P4", 3, 2400, 100]


class TestPipeline:
    @pytest.fixture
    def raiz(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
        seed_import.importar(destino=tmp_path / "public")
        monkeypatch.setattr(pipeline, "_cotahist", lambda *_a, **_k: None)  # sem rede: as partições já existem
        return tmp_path

    def gravar(self, raiz: Path, meses: list[str], vol: int = 1000) -> None:
        pasta = raiz / "history" / "acoes_volume"
        for m in meses:
            a = b3_cotahist.Agregado("PETROBRAS", "PN", "BRPETRACNPR6", vol * 100, 5, f"{m}-02", f"{m}-20", 30.0)
            b3_cotahist.gravar_particao(m, {"PETR4": a}, "mensal", [], pasta)

    def ctx(self, raiz: Path) -> pipeline.Contexto:
        return pipeline.Contexto(hoje=HOJE, raiz=raiz, cache=raiz / "c")

    def test_publica_json_valido_e_csv_e_e_idempotente(self, raiz: Path) -> None:
        self.gravar(raiz, MESES)
        r = pipeline.run_acoes_volume(self.ctx(raiz))
        assert r.publicado and r.mudou and r.contagem == 1 and not r.erro
        doc = pio.read_json(raiz / "public" / "acoes_volume.json")
        petro = doc["companhias"][0]
        assert (petro["codigo_cvm"], petro["pregao"]) == ("9512", "PETROBRAS") and petro["volume_24m"] == 24_000
        assert doc["meses"] == MESES and doc["mes_parcial"] is None and len(doc["fontes_volume"]) == 24
        assert "9512;PETROBRAS;PETR4;" in (raiz / "public" / "downloads" / "acoes_volume.csv").read_text("utf-8")
        antes = (raiz / "public" / "acoes_volume.json").read_bytes()
        again = pipeline.run_acoes_volume(self.ctx(raiz))
        assert again.publicado and not again.mudou and (raiz / "public" / "acoes_volume.json").read_bytes() == antes

    def test_sem_particoes_pede_o_backfill_e_nao_publica(self, raiz: Path) -> None:
        self.gravar(raiz, MESES[:10])
        r = pipeline.run_acoes_volume(self.ctx(raiz))
        assert not r.publicado and "backfill cotahist --categoria acao" in r.erro
        assert not (raiz / "public" / "acoes_volume.json").exists()

    def test_sem_o_cadastro_de_acoes_nao_publica(self, tmp_path: Path) -> None:
        r = pipeline.run_acoes_volume(self.ctx(tmp_path))
        assert not r.publicado and "acoes.json ausente" in r.erro
