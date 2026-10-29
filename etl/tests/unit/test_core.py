from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

import httpx
import pytest
import respx

from painel_etl.core import diff, quality
from painel_etl.core import io as pio
from painel_etl.core.http import BREAKER_LIMIT, CircuitOpenError, Http
from painel_etl.core.state import State

URL = "https://exemplo.test/dados"


def novo_http(**kw: object) -> tuple[Http, list[float]]:
    esperas: list[float] = []
    return Http("teste", wait=lambda _s: 0.0, sleep=esperas.append, **kw), esperas  # type: ignore[arg-type]


class TestHttp:
    @respx.mock
    def test_retry_em_5xx_ate_dar_certo(self) -> None:
        rota = respx.get(URL).mock(
            side_effect=[httpx.Response(503), httpx.Response(500), httpx.Response(200, text="ok")]
        )
        http, _ = novo_http()
        assert http.get(URL).text == "ok"
        assert rota.call_count == 3

    @respx.mock
    def test_404_volta_ao_chamador_sem_retry(self) -> None:
        rota = respx.get(URL).mock(return_value=httpx.Response(404))
        http, _ = novo_http()
        assert http.get(URL).status_code == 404
        assert rota.call_count == 1

    @respx.mock
    def test_respeita_retry_after_no_429(self) -> None:
        respx.get(URL).mock(side_effect=[httpx.Response(429, headers={"Retry-After": "7"}), httpx.Response(200)])
        http, esperas = novo_http()
        assert http.get(URL).status_code == 200
        assert esperas == [7.0]

    @respx.mock
    def test_erro_de_rede_tambem_tem_retry(self) -> None:
        rota = respx.get(URL).mock(side_effect=[httpx.ConnectError("x"), httpx.Response(200)])
        http, _ = novo_http()
        assert http.get(URL).status_code == 200
        assert rota.call_count == 2

    @respx.mock
    def test_disjuntor_abre_depois_de_falhas_seguidas(self) -> None:
        rota = respx.get(URL).mock(return_value=httpx.Response(500))
        http, _ = novo_http()
        for _ in range(BREAKER_LIMIT):
            with pytest.raises(Exception, match="500"):
                http.get(URL)
        chamadas = rota.call_count
        with pytest.raises(CircuitOpenError):
            http.get(URL)
        assert rota.call_count == chamadas  # nem tentou

    @respx.mock
    def test_sucesso_zera_o_disjuntor(self) -> None:
        respx.get(URL).mock(side_effect=[httpx.Response(500)] * 5 + [httpx.Response(200)])
        http, _ = novo_http()
        with pytest.raises(Exception, match="500"):
            http.get(URL)
        assert http.falhas_seguidas == 1
        http.get(URL)
        assert http.falhas_seguidas == 0

    @respx.mock
    def test_proxy_reescreve_a_url(self) -> None:
        rota = respx.get("https://proxy.test/https://exemplo.test/dados").mock(return_value=httpx.Response(200))
        http, _ = novo_http(proxy_base="https://proxy.test/")
        assert http.get(URL).status_code == 200
        assert rota.called

    @respx.mock
    def test_download_em_streaming_grava_so_em_200(self, tmp_path: Path) -> None:
        respx.get(URL).mock(return_value=httpx.Response(200, content=b"abc" * 1000))
        http, _ = novo_http()
        destino = tmp_path / "x" / "arq.zip"
        assert http.download(URL, destino).status_code == 200
        assert destino.read_bytes() == b"abc" * 1000
        assert not destino.with_suffix(".zip.part").exists()

    @respx.mock
    def test_download_404_nao_cria_arquivo(self, tmp_path: Path) -> None:
        respx.get(URL).mock(return_value=httpx.Response(404))
        http, _ = novo_http()
        destino = tmp_path / "arq.zip"
        assert http.download(URL, destino).status_code == 404
        assert not destino.exists()


class TestIo:
    def test_json_deterministico_e_sem_escrita_se_igual(self, tmp_path: Path) -> None:
        p = tmp_path / "a.json"
        assert pio.write_json(p, {"b": 1, "a": "ação"}, 2) is True
        bytes1 = p.read_bytes()
        assert pio.write_json(p, {"a": "ação", "b": 1}, 2) is False  # mesmo conteúdo, ordem diferente
        assert p.read_bytes() == bytes1
        assert bytes1.endswith(b"\n") and "ação".encode() in bytes1  # ensure_ascii=False
        assert list(json.loads(bytes1)) == ["a", "b"]

    def test_nao_deixa_temporarios(self, tmp_path: Path) -> None:
        pio.write_json(tmp_path / "a.json", {"x": 1})
        assert [p.name for p in tmp_path.iterdir()] == ["a.json"]

    def test_csv_com_ponto_e_virgula_bom_e_lf(self, tmp_path: Path) -> None:
        pio.write_csv(tmp_path / "a.csv", ["x", "y"], [["a;b", None], ["ç", 2]])
        bruto = (tmp_path / "a.csv").read_bytes()
        assert bruto.startswith(b"\xef\xbb\xbf") and b"\r" not in bruto
        assert bruto.decode("utf-8-sig") == 'x;y\n"a;b";\nç;2\n'

    def test_csv_gz_e_deterministico(self, tmp_path: Path) -> None:
        p = tmp_path / "a.csv.gz"
        assert pio.write_csv_gz(p, ["x"], [["1"], ["2"]]) is True
        assert pio.write_csv_gz(p, ["x"], [["1"], ["2"]]) is False
        assert pio.read_csv_gz(p) == [{"x": "1"}, {"x": "2"}]

    def test_jsonl_so_acrescenta_e_e_idempotente(self, tmp_path: Path) -> None:
        p = tmp_path / "ev" / "2026.jsonl"
        assert pio.append_jsonl(p, [{"b": 1, "a": 2}]) == 1
        assert pio.append_jsonl(p, [{"a": 2, "b": 1}, {"a": 3}]) == 1
        assert p.read_text(encoding="utf-8").splitlines() == ['{"a": 2, "b": 1}', '{"a": 3}']


class TestState:
    def test_roundtrip(self, tmp_path: Path) -> None:
        s = State("x", tmp_path)
        s.set("etag", "abc")
        assert s.save() is True
        assert State("x", tmp_path).get("etag") == "abc"
        assert State("x", tmp_path).get("nada", 5) == 5
        assert s.save() is False


class TestQuality:
    def test_queda_acima_do_limite_reprova(self) -> None:
        rel = quality.Relatorio("t")
        quality.checar_queda(rel, 85, 100, 0.10)
        assert not rel.ok and rel.erros[0].codigo == "queda"

    def test_queda_dentro_do_limite_passa(self) -> None:
        rel = quality.Relatorio("t")
        quality.checar_queda(rel, 91, 100, 0.10)
        assert rel.ok

    def test_vazio_sempre_reprova_e_primeira_execucao_passa(self) -> None:
        rel = quality.Relatorio("t")
        quality.checar_queda(rel, 0, 100)
        assert not rel.ok
        rel = quality.Relatorio("t")
        quality.checar_queda(rel, 5, None)
        assert rel.ok

    def test_obrigatorios_e_unicos(self) -> None:
        rel = quality.Relatorio("t")
        quality.checar_obrigatorios(rel, [{"k": "1", "v": ""}, {"k": "2", "v": "x"}], ["v"], "k")
        quality.checar_unicos(rel, ["A", "A", "B"], "ticker")
        assert {i.codigo for i in rel.erros} == {"campo_obrigatorio", "duplicado"}

    def test_cnpj_invalido_tolerancia(self) -> None:
        regs = [{"id": "1", "c": "11.111.111/0001-11"}, {"id": "2", "c": "00.000.000/0001-91"}]
        rel = quality.Relatorio("t")
        quality.checar_cnpjs(rel, regs, "c", "id", tolerancia=1)
        assert rel.ok and len(rel.avisos) == 1
        rel = quality.Relatorio("t")
        quality.checar_cnpjs(rel, regs, "c", "id", tolerancia=0)
        assert not rel.ok

    def test_datas_futuras_e_invalidas(self) -> None:
        rel = quality.Relatorio("t")
        quality.checar_datas(
            rel,
            [{"k": "a", "d": "2026-12-01"}, {"k": "b", "d": "2026-13-45"}, {"k": "c", "d": "2026-01-01"}],
            ["d"],
            "k",
            dt.date(2026, 10, 29),
        )
        assert {i.codigo for i in rel.erros} == {"data_futura", "data_invalida"}

    def test_volume_negativo(self) -> None:
        rel = quality.Relatorio("t")
        quality.checar_nao_negativos(rel, [("A", 1.0), ("B", -1.0)], "volume")
        assert not rel.ok and "B" in rel.erros[0].mensagem

    def test_markdown(self) -> None:
        rel = quality.Relatorio("acoes")
        assert "sem problemas" in rel.markdown()
        rel.erro("x", "ruim")
        assert "1 erro" in rel.markdown()


class TestDiff:
    HOJE = dt.date(2026, 10, 29)

    @staticmethod
    def acao(
        escr_cvm: str = "A", escr_b3: str = "A", tickers: tuple[str, ...] = ("X3",), seg: str = "NM", div: bool = False
    ) -> dict:
        return {
            "pregao": "X",
            "escriturador_cvm": {"atual": escr_cvm},
            "escriturador_b3": {"on": escr_b3, "pn": None},
            "divergente_b3_cvm": div,
            "tickers": [{"ticker": t} for t in tickers],
            "segmento": seg,
            "detalhe_b3": True,
        }

    def tipos(self, antes: dict, depois: dict) -> list[tuple[str, str]]:
        return [(e["tipo"], e["chave"]) for e in diff.diff_acoes(antes, depois, self.HOJE)]

    def test_primeira_publicacao_nao_gera_eventos(self) -> None:
        assert diff.diff_acoes({}, {"1": self.acao()}, self.HOJE) == []

    def test_listagem_e_deslistagem(self) -> None:
        assert self.tipos({"1": self.acao()}, {"2": self.acao()}) == [("nova_listagem", "2"), ("deslistagem", "1")]

    def test_troca_de_escriturador_na_cvm_e_na_b3(self) -> None:
        r = diff.diff_acoes({"1": self.acao()}, {"1": self.acao(escr_cvm="B", escr_b3="C")}, self.HOJE)
        assert [(e["tipo"], e["fonte"], e["de"], e["para"]) for e in r] == [
            ("troca_escriturador", "CVM", "A", "B"),
            ("troca_escriturador", "B3", "A", "C"),
        ]

    def test_divergencia_nova_tickers_e_segmento(self) -> None:
        antes = {"1": self.acao()}
        depois = {"1": self.acao(tickers=("Y3",), seg="N2", div=True)}
        assert self.tipos(antes, depois) == [
            ("divergencia_b3_cvm", "1"), ("ticker_novo", "1"), ("ticker_removido", "1"), ("mudanca_segmento", "1"),
        ]  # fmt: skip

    def test_sem_mudanca_sem_eventos(self) -> None:
        assert self.tipos({"1": self.acao()}, {"1": self.acao()}) == []

    def test_bdrs(self) -> None:
        a = {"AAAA34": {"nome": "A", "depositaria": "Não identificado", "fonte_depositaria": ""}}
        d = {
            "AAAA34": {"nome": "A", "depositaria": "Banco B3", "fonte_depositaria": "x"},
            "BBBB34": {"nome": "B", "depositaria": "Banco B3", "fonte_depositaria": "x"},
        }
        # depositária que passou de "Não identificado" para identificada não é uma troca de verdade
        assert [e["tipo"] for e in diff.diff_bdrs(a, d, self.HOJE)] == ["novo_bdr"]
        d["AAAA34"]["depositaria"] = "Banco Bradesco"
        a["AAAA34"]["depositaria"] = "Banco B3"
        assert [e["tipo"] for e in diff.diff_bdrs(a, d, self.HOJE)] == ["novo_bdr", "troca_depositaria"]

    def test_ultimos_ordena_do_mais_novo_e_limita(self) -> None:
        evs = [{"data": f"2026-10-{d:02d}", "dataset": "acoes", "tipo": "t", "chave": str(d)} for d in range(1, 6)]
        assert [e["chave"] for e in diff.ultimos(evs, 2)] == ["5", "4"]
