"""Item 8.5: valores mobiliários do FCA, com as fixtures reais da Etapa 8.0."""

from __future__ import annotations

import datetime as dt
import io
import zipfile
from pathlib import Path

import pytest

from painel_etl.datasets import acoes as ds_acoes
from painel_etl.datasets import valores_mobiliarios as ds
from painel_etl.indicadores import carregar
from painel_etl.sources import cvm_fca
from painel_etl.sources.cvm_fca import ValorMobiliarioRow

CFG = carregar().fca_valor_mobiliario
BB = "00000000000191"
ENERGISA = "00864214000106"


def ler(fixtures: Path, nome: str, tmp_path: Path) -> list[ValorMobiliarioRow]:
    bruto = (fixtures / "cvm_fca" / nome).read_bytes()
    destino = tmp_path / f"{nome}.zip"
    with zipfile.ZipFile(destino, "w") as z:
        z.writestr("fca_cia_aberta_valor_mobiliario_2026.csv", bruto)
    return list(cvm_fca.parse_valor_mobiliario(destino))


def linha(**kw: str) -> ValorMobiliarioRow:
    padrao = {
        "cnpj": "1", "referencia": "2026-01-01", "versao": 1, "valor_mobiliario": "Ações Ordinárias", "ticker": "ABCD3",
        "mercado": "Bolsa", "entidade": "B3", "inicio_negociacao": "2020-01-01", "fim_negociacao": "",
        "segmento": "Novo Mercado", "inicio_listagem": "2019-01-01", "fim_listagem": "",
    }  # fmt: skip
    return ValorMobiliarioRow.model_validate({**padrao, **kw})


class TestParse:
    def test_fixture_real_so_acoes_e_units_na_maior_versao(self, fixtures: Path, tmp_path: Path) -> None:
        linhas = ler(fixtures, "fca_cia_aberta_valor_mobiliario_2026_extrato.csv", tmp_path)
        assert linhas and all(x.valor_mobiliario.startswith(("Ações", "Units")) for x in linhas)
        bb = [x for x in linhas if x.cnpj == BB]
        assert [(x.ticker, x.versao, x.segmento) for x in bb] == [("BBAS3", 3, "Novo Mercado")]
        assert (bb[0].inicio_negociacao, bb[0].inicio_listagem) == ("2006-05-31", "1977-07-20")

    def test_descarta_versoes_antigas(self, tmp_path: Path) -> None:
        cab = (
            "CNPJ_Companhia;Data_Referencia;Versao;Valor_Mobiliario;Codigo_Negociacao;Mercado;Entidade_Administradora;"
            "Data_Inicio_Negociacao;Data_Fim_Negociacao;Segmento;Data_Inicio_Listagem;Data_Fim_Listagem\n"
        )
        v1 = "00.000.000/0001-91;2026-01-01;1;Ações Ordinárias;BBAS3;Bolsa;B3;;;Básico;;\n"
        v2 = "00.000.000/0001-91;2026-01-01;2;Ações Ordinárias;BBAS3;Bolsa;B3;;;Novo Mercado;;\n"
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as z:
            z.writestr("fca_cia_aberta_valor_mobiliario_2026.csv", (cab + v1 + v2).encode("iso-8859-1"))
        arq = tmp_path / "f.zip"
        arq.write_bytes(buf.getvalue())
        assert [x.segmento for x in cvm_fca.parse_valor_mobiliario(arq)] == ["Novo Mercado"]

    def test_particao_e_deterministica_e_volta_igual(self, tmp_path: Path) -> None:
        linhas = [linha(ticker="ABCD4", cnpj="2"), linha(ticker="ABCD3", cnpj="1")]
        assert cvm_fca.salvar_valores_mobiliarios(2026, linhas, tmp_path) is True
        assert cvm_fca.salvar_valores_mobiliarios(2026, list(reversed(linhas)), tmp_path) is False
        assert [x.ticker for x in cvm_fca.carregar_valores_mobiliarios(tmp_path)["1"]] == ["ABCD3"]


class TestLinhaDoTempo:
    def test_serie_real_do_banco_do_brasil(self, fixtures: Path, tmp_path: Path) -> None:
        todas = ler(fixtures, "fca_cia_aberta_valor_mobiliario_serie_extrato.csv", tmp_path)
        bb = [x for x in todas if x.cnpj == BB and x.referencia >= f"{CFG.ano_inicial}"]
        tempo = ds.linha_do_tempo(bb)
        assert [t["segmento"] for t in tempo][-1] == "Novo Mercado"
        assert all(t["data_aproximada"] is True and t["fonte"] == "CVM FCA" for t in tempo)

    def test_mudanca_usa_a_primeira_referencia(self) -> None:
        linhas = [
            linha(referencia="2024-01-01", segmento="Básico"),
            linha(referencia="2025-01-01", segmento="Básico"),
            linha(referencia="2026-01-01", segmento="Novo Mercado"),
        ]
        assert [(t["segmento"], t["desde"]) for t in ds.linha_do_tempo(linhas)] == [
            ("Básico", "2024-01-01"), ("Novo Mercado", "2026-01-01"),
        ]  # fmt: skip

    def test_serie_real_comeca_na_primeira_referencia_com_ticker(self, fixtures: Path, tmp_path: Path) -> None:
        """O BB aparece como Nível 1 e sem ticker em 2018 (rótulo antigo); a série começa em 2019, já correta."""
        todas = ler(fixtures, "fca_cia_aberta_valor_mobiliario_serie_extrato.csv", tmp_path)
        tempo = ds.linha_do_tempo([x for x in todas if x.cnpj == BB and x.referencia >= "2018"])
        assert [(t["segmento"], t["desde"]) for t in tempo] == [("Novo Mercado", "2019-01-01")]

    def test_ignora_linha_encerrada_e_fora_de_bolsa(self) -> None:
        linhas = [
            linha(segmento="Novo Mercado"),
            linha(segmento="Básico", ticker="ABCD4", fim_negociacao="2025-01-01"),
            linha(segmento="Nível 2 de Governança Corporativa", mercado="Balcão Organizado"),
        ]
        assert [t["segmento"] for t in ds.linha_do_tempo(linhas)] == ["Novo Mercado"]


class TestListagem:
    def test_fca_tem_prioridade_e_divergencia_e_so_selo(self) -> None:
        r = ds.listagem([linha(segmento="Básico")], "NM", "01/01/2024", CFG)
        assert r == {
            "desde": "2019-01-01", "desde_incerto": False, "fonte_desde": "CVM FCA", "mercado": "Bolsa",
            "segmento_cvm": "Básico", "segmento_divergente": True,
        }  # fmt: skip

    @pytest.mark.parametrize("segmento_b3", ["?", "BN", "SO"])
    def test_segmento_sem_equivalente_nao_diverge(self, segmento_b3: str) -> None:
        r = ds.listagem([linha()], segmento_b3, "", CFG)
        assert r and r["segmento_divergente"] is False

    def test_data_padrao_fica_marcada_como_incerta(self) -> None:
        r = ds.listagem([linha(inicio_listagem="1977-07-20")], "NM", "", CFG)
        assert r and r["desde"] == "1977-07-20" and r["desde_incerto"] is True

    def test_sem_fca_usa_a_data_da_b3_marcada_e_ignora_a_sentinela(self) -> None:
        r = ds.listagem([], "NM", "05/08/2026", CFG)
        assert r and (r["desde"], r["fonte_desde"], r["desde_incerto"]) == ("2026-08-05", "B3", True)
        assert ds.listagem([], "NM", "31/12/9999", CFG) is None

    def test_negociacao_desde_prefere_a_linha_ativa(self) -> None:
        linhas = [
            linha(inicio_negociacao="2007-07-27", fim_negociacao="2021-07-15"),
            linha(inicio_negociacao="2021-07-16"),
        ]
        assert ds.negociacao_desde(linhas) == {"ABCD3": "2021-07-16"}

    @pytest.mark.parametrize(
        ("desde", "esperado"),
        [("2026-09-15", True), ("2026-05-01", False), (None, False), ("2026-08-04", True), ("2026-08-03", False)],
    )
    def test_listada_ha_menos_de(self, desde: str | None, esperado: bool) -> None:
        assert ds.listada_ha_menos_de(desde, 3, dt.date(2026, 11, 3)) is esperado


class TestTickersHistoricos:
    def test_atribui_pelo_cnpj_e_deixa_de_fora_o_ambiguo(self) -> None:
        por_cnpj = {
            "1": [linha(ticker="ELET3"), linha(ticker="AXIA3"), linha(ticker="00"), linha(ticker="DUPL3")],
            "2": [linha(cnpj="2", ticker="DUPL3")],
            "3": [linha(cnpj="3", ticker="FORA3")],  # CNPJ fora do cadastro
        }
        mapa, ambiguos = ds.tickers_historicos(por_cnpj, {"1": "2437", "2": "99"}, {"AXIA3"})
        assert mapa == {"ELET3": "2437"} and ambiguos == ["DUPL3"]

    def test_curadoria_manual_resolve_e_o_cadastro_atual_vence(self) -> None:
        por_cnpj = {"1": [linha(ticker="DUPL3")], "2": [linha(cnpj="2", ticker="DUPL3")]}
        mapa, ambiguos = ds.tickers_historicos(
            por_cnpj, {"1": "1", "2": "2"}, {"AXIA3"}, {"DUPL3": "2", "JBSS3": "5", "AXIA3": "7"}
        )
        assert mapa == {"DUPL3": "2", "JBSS3": "5"} and ambiguos == []

    def test_csv_de_curadoria_comeca_vazio(self) -> None:
        assert ds.ler_overrides_tickers() == {}


def test_historico_segmentos_por_companhia() -> None:
    cias = [{"codigo_cvm": "1", "cnpj": "00.000.000/0001-91"}, {"codigo_cvm": "2", "cnpj": "00.864.214/0001-06"}]
    h = ds_acoes.historico_segmentos(cias, {BB: [linha(cnpj=BB)]})
    assert list(h) == ["1"] and h["1"][0]["segmento"] == "Novo Mercado"
    assert ENERGISA not in h
