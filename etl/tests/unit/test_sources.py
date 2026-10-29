from __future__ import annotations

import base64
import datetime as dt
import io
import json
import zipfile
from pathlib import Path

import httpx
import pytest
import respx

from painel_etl.core.http import Http
from painel_etl.core.state import State
from painel_etl.sources import b3_cotahist, b3_finservices, bradesco_bdr, cvm_cad, cvm_fca
from painel_etl.sources.b3_listed import BASE, B3Listed, encode_params, unwrap


def http() -> Http:
    return Http("t", wait=lambda _s: 0.0, sleep=lambda _s: None)


# ------------------------------------------------------------------------------------------ B3 Listadas
class TestB3Listed:
    def test_parametros_em_base64_sem_quebra_de_linha(self) -> None:
        p = {"language": "pt-br", "pageNumber": 1, "pageSize": 120}
        enc = encode_params(p)
        assert "\n" not in enc
        assert json.loads(base64.b64decode(enc)) == p

    def test_unwrap_decodifica_json_dentro_de_string(self) -> None:
        assert unwrap('"{\\"a\\": 1}"') == {"a": 1}
        assert unwrap('{"a": 1}') == {"a": 1}
        assert unwrap('"{}"') == {}

    @respx.mock
    def test_listar_le_todas_as_paginas(self, fixtures: Path) -> None:
        j = json.loads((fixtures / "b3_listed" / "GetInitialCompanies_p1.json").read_bytes())
        j["page"]["totalPages"] = 2
        respx.get(url__startswith=BASE + "GetInitialCompanies/").mock(return_value=httpx.Response(200, json=j))
        b3 = B3Listed(http(), sleep=lambda _s: None)
        listadas = b3.listar()
        assert len(listadas) == 2 * len(j["results"])
        primeira = listadas[0]
        assert (primeira.codigo_cvm, primeira.emissor) == (
            j["results"][0]["codeCVM"],
            j["results"][0]["issuingCompany"],
        )

    @respx.mock
    def test_detalhe_com_dupla_codificacao_e_vazio(self, fixtures: Path) -> None:
        sanb = (fixtures / "b3_listed" / "GetDetail_acao_SANB.json").read_bytes()
        vazio = (fixtures / "b3_listed" / "GetDetail_acao_EUROFARMA_vazio.json").read_bytes()
        respx.get(url__startswith=BASE + "GetDetail/").mock(
            side_effect=[httpx.Response(200, content=sanb), httpx.Response(200, content=vazio)]
        )
        b3 = B3Listed(http(), sleep=lambda _s: None)
        d = b3.detalhe("20532")
        assert (
            d
            and d.institution_common == "SANTANDER"
            and {c.code for c in d.other_codes or []} == {"SANB3", "SANB4", "SANB11"}
        )
        assert b3.detalhe("26700") is None  # sem detalhe: nunca erro fatal

    @respx.mock
    def test_categorias_e_etfs(self, fixtures: Path) -> None:
        cat = (fixtures / "b3_listed" / "GetCategoryBDRETF.json").read_bytes()
        respx.get(url__startswith=BASE + "GetCategoryBDRETF/").mock(return_value=httpx.Response(200, content=cat))
        assert B3Listed(http()).categorias() == {
            "28": "Renda Fixa",
            "29": "Renda Variável",
            "30": "Commodities",
            "43": "Moeda",
        }
        j = json.loads((fixtures / "b3_listed" / "GetCompaniesBDR_p1.json").read_bytes())
        j["page"]["totalPages"] = 1
        respx.get(url__startswith=BASE + "GetCompaniesBDR/").mock(return_value=httpx.Response(200, json=j))
        etfs = B3Listed(http()).etfs()
        assert etfs and etfs[0].type_bdr == "DRE" and etfs[0].categoria

    @respx.mock
    def test_detalhes_em_paralelo_devolve_todos(self, fixtures: Path) -> None:
        sanb = (fixtures / "b3_listed" / "GetDetail_acao_SANB.json").read_bytes()
        respx.get(url__startswith=BASE + "GetDetail/").mock(return_value=httpx.Response(200, content=sanb))
        out = B3Listed(http(), sleep=lambda _s: None).detalhes(["1", "2", "3", "4", "5"])
        assert sorted(out) == ["1", "2", "3", "4", "5"] and all(out.values())


# ------------------------------------------------------------------------------------------ CVM
def zip_fca(linhas: list[list[str]]) -> bytes:
    cab = "CNPJ_Companhia;Data_Referencia;Versao;ID_Documento;Nome_Empresarial;Escriturador;CNPJ_Escriturador;Data_Inicio_Atuacao;Data_Fim_Atuacao"
    corpo = "\n".join(";".join(x) for x in linhas)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("fca_cia_aberta_escriturador_2026.csv", (cab + "\n" + corpo + "\n").encode("iso-8859-1"))
        z.writestr("fca_cia_aberta_auditor_2026.csv", b"x;y\n")
    return buf.getvalue()


class TestCvmFca:
    def test_so_a_maior_versao_de_cada_documento_e_iso_8859_1(self, tmp_path: Path) -> None:
        c = "11.222.333/0001-81"
        zbytes = zip_fca(
            [
                [c, "2026-01-01", "1", "10", "Zeta", "Itaú Corretora", "61.194.353/0001-64", "2020-01-01", ""],
                [c, "2026-01-01", "2", "11", "Zeta", "Banco Bradesco S.A.", "60.746.948/0001-12", "2021-05-05", ""],
                [
                    c,
                    "2026-01-01",
                    "2",
                    "11",
                    "Zeta",
                    "Itaú Corretora",
                    "61.194.353/0001-64",
                    "2020-01-01",
                    "2021-05-04",
                ],
            ]
        )
        p = tmp_path / "fca.zip"
        p.write_bytes(zbytes)
        linhas = list(cvm_fca.parse_zip(p))
        assert {x.versao for x in linhas} == {2}
        assert {x.escriturador for x in linhas} == {"Banco Bradesco S.A.", "Itaú Corretora"}
        assert linhas[0].cnpj == "11222333000181" and linhas[0].ano == 2026

    def test_particao_ordenada_e_roundtrip(self, tmp_path: Path) -> None:
        r = cvm_fca.FcaRow(
            cnpj="1",
            referencia="2026-01-01",
            versao=2,
            empresa="Z",
            escriturador="A",
            cnpj_escriturador="2",
            inicio="",
            fim="",
        )
        assert cvm_fca.salvar_particao(2026, [r], tmp_path) is True
        assert cvm_fca.salvar_particao(2026, [r], tmp_path) is False  # idempotente
        assert cvm_fca.carregar_historico(tmp_path)["1"] == [r]

    @respx.mock
    def test_so_baixa_quando_o_etag_muda(self, tmp_path: Path) -> None:
        url = cvm_fca.url_ano(2026)
        corpo = zip_fca([["11.222.333/0001-81", "2026-01-01", "1", "1", "Z", "A", "1", "", ""]])
        respx.head(url).mock(return_value=httpx.Response(200, headers={"etag": '"v1"'}))
        baixa = respx.get(url).mock(return_value=httpx.Response(200, content=corpo, headers={"etag": '"v1"'}))
        state = State("fca", tmp_path / "state")
        a = cvm_fca.fetch_ano(http(), 2026, state=state, cache=tmp_path)
        assert a and a.mudou and baixa.call_count == 1
        assert cvm_fca.fetch_ano(http(), 2026, state=state, cache=tmp_path) is None  # mesmo ETag
        assert baixa.call_count == 1
        respx.head(url).mock(return_value=httpx.Response(200, headers={"etag": '"v2"'}))
        a2 = cvm_fca.fetch_ano(http(), 2026, state=state, cache=tmp_path)
        assert a2 and not a2.mudou and baixa.call_count == 2  # ETag novo, conteúdo igual: pula o parse

    def test_cad(self, fixtures: Path) -> None:
        dados = cvm_cad.parse((fixtures / "cvm_cad" / "cad_cia_aberta_head40.csv").read_bytes())
        assert len(dados) == 37  # 40 linhas; 3 CNPJs aparecem duplicados (cópias exatas)
        d = dados["08773135000100"]  # 2W Ecobank
        assert d["codigo_cvm"] == "25224" and d["situacao"].startswith("SUSPENSO")


# ------------------------------------------------------------------------------------------ COTAHIST
def linha_cot(
    data: str,
    cod: str,
    mercado: str = "010",
    nome: str = "ACME INC",
    especi: str = "DRN",
    preco: int = 1000,
    neg: int = 10,
    vol: int = 100000,
    isin: str = "BRACMEBDR001",
) -> str:
    c = [" "] * 245

    def poe(ini: int, txt: str) -> None:
        c[ini : ini + len(txt)] = list(txt)

    poe(0, "01")
    poe(2, data)
    poe(10, "36")
    poe(12, cod.ljust(12))
    poe(24, mercado)
    poe(27, nome.ljust(12))
    poe(39, especi.ljust(10))
    poe(108, f"{preco:013d}")
    poe(147, f"{neg:05d}")
    poe(170, f"{vol:018d}")
    poe(230, isin)
    return "".join(c)


class TestCotahist:
    def test_layout_real_da_fixture(self, fixtures: Path) -> None:
        txt = (fixtures / "b3_cotahist" / "COTAHIST_D28102026_bdr_extrato.txt").read_bytes().decode("iso-8859-1")
        linhas = [x for x in txt.split("\r\n") if x]
        cotacoes = [c for c in map(b3_cotahist.parse_linha, linhas) if c]
        assert len(cotacoes) > 500 and all(c.data == "2026-10-28" for c in cotacoes)
        assert {c.mercado for c in cotacoes} <= {"010", "020"}
        assert (
            b3_cotahist.parse_linha(linhas[0]) is None and b3_cotahist.parse_linha(linhas[-1]) is None
        )  # header/trailer

    def test_campos_e_casas_decimais(self) -> None:
        c = b3_cotahist.parse_linha(linha_cot("20261028", "AAPL34", preco=12345, neg=7, vol=987654))
        assert c
        assert (c.codneg, c.preco, c.negocios, c.volume_centavos, c.isin, c.nome) == (
            "AAPL34",
            123.45,
            7,
            987654,
            "BRACMEBDR001",
            "ACME INC",
        )

    @pytest.mark.parametrize(
        "kw",
        [dict(cod="PETR4"), dict(mercado="070"), dict(mercado="030"), dict(especi="DRN UNT"), dict(cod="AAPL36")],
    )
    def test_filtros_excluem_nao_bdr_opcoes_termo_e_units(self, kw: dict) -> None:
        assert b3_cotahist.parse_linha(linha_cot("20261028", **{"cod": "AAPL34", **kw})) is None

    def test_agregacao_soma_fracionario_no_ticker_base(self) -> None:
        linhas = iter(
            [
                linha_cot("20261001", "AAPL34", vol=1000, neg=1, preco=100),
                linha_cot("20261001", "AAPL34F", mercado="020", vol=500, neg=2, preco=101),
                linha_cot("20261002", "AAPL34", vol=2000, neg=3, preco=102),
                linha_cot("20261102", "AAPL34", vol=700, neg=4, preco=103),
            ]
        )
        meses = b3_cotahist.agregar(linhas)
        out = meses["2026-10"]["AAPL34"]
        assert (out.volume_centavos, out.negocios, out.primeiro, out.ultimo, out.preco) == (
            3500,
            6,
            "2026-10-01",
            "2026-10-02",
            1.02,
        )
        assert meses["2026-11"]["AAPL34"].volume_centavos == 700

    def test_preco_no_mesmo_dia_e_o_da_vista(self) -> None:
        meses = b3_cotahist.agregar(
            iter(
                [linha_cot("20261001", "AAPL34F", mercado="020", preco=101), linha_cot("20261001", "AAPL34", preco=100)]
            )
        )
        assert meses["2026-10"]["AAPL34"].preco == 1.0

    def test_meses_entre_e_dias_uteis(self) -> None:
        assert b3_cotahist.meses_entre("2025-11", "2026-02") == [(2025, 11), (2025, 12), (2026, 1), (2026, 2)]
        assert b3_cotahist.dias_uteis(dt.date(2026, 10, 23), dt.date(2026, 10, 27)) == [
            dt.date(2026, 10, 23),
            dt.date(2026, 10, 26),
            dt.date(2026, 10, 27),
        ]
        assert b3_cotahist.url_diario(dt.date(2026, 10, 28)).endswith("COTAHIST_D28102026.ZIP")
        assert b3_cotahist.url_mensal(2026, 9).endswith("COTAHIST_M092026.ZIP")

    @staticmethod
    def zip_dia(*linhas: str) -> bytes:
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as z:
            z.writestr("COTAHIST.TXT", "\r\n".join(["00COTAHIST", *linhas, "99COTAHIST"]) + "\r\n")
        return buf.getvalue()

    @respx.mock
    def test_diario_404_em_dia_util_espera_3_dias_e_nao_conta_duas_vezes(self, tmp_path: Path) -> None:
        seg, ter, qua = dt.date(2026, 10, 26), dt.date(2026, 10, 27), dt.date(2026, 10, 28)
        respx.get(b3_cotahist.url_diario(seg)).mock(
            return_value=httpx.Response(200, content=self.zip_dia(linha_cot("20261026", "AAPL34", vol=100)))
        )
        respx.get(b3_cotahist.url_diario(ter)).mock(return_value=httpx.Response(404))
        respx.get(b3_cotahist.url_diario(qua)).mock(
            return_value=httpx.Response(200, content=self.zip_dia(linha_cot("20261028", "AAPL34", vol=300)))
        )
        pasta, cache = tmp_path / "bdr_volume", tmp_path / "cache"
        state = State("cotahist", tmp_path / "state")
        state.set("inicio", seg.isoformat())

        r = b3_cotahist.processar_diario(http(), state, qua, cache=cache, pasta=pasta)
        assert r["novos"] == ["2026-10-26", "2026-10-28"] and r["pendentes"] == ["2026-10-27"] and r["sem_pregao"] == []
        parte = b3_cotahist.ler_particao("2026-10", pasta)
        assert parte and parte["fonte"] == "diario" and parte["tickers"]["AAPL34"]["volume"] == 4

        # rodar de novo no mesmo dia não soma de novo
        b3_cotahist.processar_diario(http(), state, qua, cache=cache, pasta=pasta)
        assert b3_cotahist.ler_particao("2026-10", pasta)["tickers"]["AAPL34"]["volume"] == 4  # type: ignore[index]

        # sábado 31: a terça (27) está há 3 dias sem arquivo => feriado confirmado; quinta/sexta ainda pendentes
        qui, sex = dt.date(2026, 10, 29), dt.date(2026, 10, 30)
        respx.get(b3_cotahist.url_diario(qui)).mock(return_value=httpx.Response(404))
        respx.get(b3_cotahist.url_diario(sex)).mock(return_value=httpx.Response(404))
        r = b3_cotahist.processar_diario(http(), state, dt.date(2026, 10, 31), cache=cache, pasta=pasta)
        assert r["sem_pregao"] == ["2026-10-27"]
        assert r["pendentes"] == ["2026-10-29", "2026-10-30"]
        assert state.get("processados") == ["2026-10-26", "2026-10-28"]

    @respx.mock
    def test_mensal_substitui_o_diario_e_mede_a_diferenca(self, tmp_path: Path) -> None:
        pasta, cache = tmp_path / "bdr_volume", tmp_path / "cache"
        antes = b3_cotahist.Agregado("ACME", "DRN", "X", 100000, 5, "2026-09-01", "2026-09-02", 1.0)
        b3_cotahist.gravar_particao("2026-09", {"AAPL34": antes}, "diario", ["2026-09-01"], pasta)
        mensal = self.zip_dia(linha_cot("20260901", "AAPL34", vol=100000), linha_cot("20260902", "AAPL34", vol=100000))
        respx.get(b3_cotahist.url_mensal(2026, 9)).mock(return_value=httpx.Response(200, content=mensal))
        r = b3_cotahist.processar_mensal(http(), 2026, 9, cache=cache, pasta=pasta)
        assert r["status"] == "ok" and r["alerta"] is True  # 1000 contra 2000 reais: > 0,5%
        assert b3_cotahist.ler_particao("2026-09", pasta)["fonte"] == "mensal"  # type: ignore[index]

    @respx.mock
    def test_mensal_ainda_nao_publicado(self, tmp_path: Path) -> None:
        respx.get(b3_cotahist.url_mensal(2026, 10)).mock(return_value=httpx.Response(404))
        assert b3_cotahist.processar_mensal(http(), 2026, 10, cache=tmp_path)["status"] == "indisponivel"


# ------------------------------------------------------------------------------------------ listas de depositárias
class TestRastreabilidadeDoVolume:
    """Cada volume mensal publicado aponta para o arquivo oficial da B3 que o sustenta."""

    def test_mes_oficial_aponta_para_o_cotahist_mensal(self) -> None:
        f = b3_cotahist.fonte_do_mes("2026-09", {"fonte": "mensal", "pregoes": ["2026-09-01"]})
        assert f == {
            "arquivos": ["https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_M092026.ZIP"],
            "tipo": "mensal",
        }

    def test_mes_parcial_aponta_para_cada_arquivo_diario_somado_em_ordem(self) -> None:
        f = b3_cotahist.fonte_do_mes("2026-10", {"fonte": "diario", "pregoes": ["2026-10-02", "2026-10-01"]})
        assert f["tipo"] == "diario"
        assert f["arquivos"] == [
            "https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_D01102026.ZIP",
            "https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_D02102026.ZIP",
        ]

    def test_as_urls_usam_o_mesmo_padrao_que_o_download(self) -> None:
        assert b3_cotahist.fonte_do_mes("2024-01", {"fonte": "mensal", "pregoes": []})["arquivos"] == [
            b3_cotahist.url_mensal(2024, 1)
        ]
        assert b3_cotahist.PAGINA_FONTE.startswith("https://www.b3.com.br/") and b3_cotahist.PAGINA_FONTE.endswith("/")


class TestDepositarias:
    def test_finservices_drn_e_etf(self, fixtures: Path) -> None:
        drn = b3_finservices.parse(
            (fixtures / "b3_finservices" / "programas_drn_tabela.html").read_text(encoding="utf-8")
        )
        etf = b3_finservices.parse(
            (fixtures / "b3_finservices" / "programas_etf_tabela.html").read_text(encoding="utf-8")
        )
        assert (len(drn), len(etf)) == (761, 309)
        assert sum(p.qualificado for p in etf) == 10 and not any(p.qualificado for p in drn)
        bchina = next(p for p in etf if p.ticker == "BCHA39")
        assert bchina.qualificado and not bchina.nome.endswith("*")

    def test_bradesco(self, fixtures: Path) -> None:
        acoes = bradesco_bdr.parse_acoes((fixtures / "bradesco" / "bdr_graphql.json").read_text(encoding="utf-8"))
        assert len(acoes) == 40 and "ACCENTURE PLC" in acoes and not any("Contrato" in a for a in acoes)
        etfs = bradesco_bdr.parse_etfs((fixtures / "bradesco" / "bdr-de-etf.model.json").read_text(encoding="utf-8"))
        assert etfs == ["ANGV39", "BUZZ39", "EMLC39", "GDXB39", "HYEM39", "MOTB39", "PFXF39", "SLXB39"]
