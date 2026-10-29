from __future__ import annotations

import datetime as dt
from pathlib import Path

import pytest

from painel_etl.datasets import acoes, bdrs
from painel_etl.normalize.instituicoes import Registro
from painel_etl.sources.b3_finservices import Programa
from painel_etl.sources.b3_listed import CompanyDetail, EtfRow, ListedCompany


@pytest.fixture(scope="module")
def reg() -> Registro:
    return Registro.carregar()


def listada(codigo: str, pregao: str = "ACME", **kw: str) -> ListedCompany:
    base = {
        "codeCVM": codigo, "issuingCompany": "ACME", "companyName": "ACME S.A.", "tradingName": pregao,
        "cnpj": "11222333000181", "marketIndicator": "18", "segment": "Bancos", "type": "1",
    }  # fmt: skip
    return ListedCompany.model_validate({**base, **kw})


def detalhe(**kw: object) -> CompanyDetail:
    return CompanyDetail.model_validate(
        {"institutionCommon": "BRADESCO", "institutionPreferred": "BRADESCO", "otherCodes": [{"code": "ACME3"}], **kw}
    )


class TestAcoes:
    def test_tickers_ordenacao_natural_classe_e_sem_debentures(self) -> None:
        d = detalhe(
            otherCodes=[
                {"code": "SANB11"},
                {"code": "SANB4"},
                {"code": "SANB3"},
                {"code": "SANB-DEB72"},
                {"code": "TAEE11"},
            ]
        )
        assert [(t["ticker"], t["classe"]) for t in acoes.tickers_de(d)] == [
            ("SANB3", "ON"), ("SANB4", "PN"), ("SANB11", "Units"), ("TAEE11", "Units"),
        ]  # fmt: skip
        assert acoes.tickers_de(None) == []

    def test_rodizio_cobre_todas_em_7_dias_e_inclui_novas_e_alteradas(self) -> None:
        todas = [listada(str(c)) for c in range(100, 114)]
        previo = {
            c.codigo_cvm: {
                "pregao": c.pregao,
                "razao_social": c.razao_social,
                "emissor": c.emissor,
                "setor": c.setor,
                "indicador_mercado": c.market_indicator,
            }
            for c in todas
        }
        vistas: set[str] = set()
        for dia in range(7):
            sel = acoes.codigos_para_detalhe(todas, previo, dt.date(2026, 10, 26) + dt.timedelta(days=dia))
            assert len(sel) <= 3  # 14 companhias / 7 dias
            vistas |= set(sel)
        assert vistas == {c.codigo_cvm for c in todas}
        nova = [*todas, listada("999")]
        assert "999" in acoes.codigos_para_detalhe(nova, previo, dt.date(2026, 10, 26))
        mudou = [listada("100", pregao="OUTRO"), *todas[1:]]
        assert "100" in acoes.codigos_para_detalhe(mudou, previo, dt.date(2026, 10, 26))

    def test_segmento_pelo_indicador_e_sem_detalhe_vira_interrogacao(self, reg: Registro) -> None:
        cs = [listada("1", marketIndicator="18"), listada("2", marketIndicator="1"), listada("3", marketIndicator="18")]
        out, _, _ = acoes.construir(cs, {"1": detalhe(), "2": detalhe(), "3": None}, {}, {}, reg)
        assert {c["codigo_cvm"]: c["segmento"] for c in out} == {"1": "NM", "2": "B", "3": "?"}
        assert next(c for c in out if c["codigo_cvm"] == "3")["detalhe_b3"] is False

    def test_companhia_nao_revisitada_mantem_o_que_ja_se_sabia(self, reg: Registro) -> None:
        c = listada("1")
        primeiro, _, _ = acoes.construir([c], {"1": detalhe()}, {}, {}, reg)
        de_novo, _, _ = acoes.construir([c], {}, {}, {}, reg, previo={"1": primeiro[0]})
        assert de_novo[0]["escriturador_b3"] == primeiro[0]["escriturador_b3"]
        assert de_novo[0]["tickers"] == primeiro[0]["tickers"]

    def test_escriturador_b3_bruto_normalizado_e_propria_empresa(self, reg: Registro) -> None:
        out, _, _ = acoes.construir(
            [listada("1")], {"1": detalhe(institutionCommon="EMPRESA", institutionPreferred="")}, {}, {}, reg
        )
        b3 = out[0]["escriturador_b3"]
        assert (b3["on"], b3["pn"], b3["bruto_on"]) == ("Própria empresa", None, "EMPRESA")
        assert acoes.principal_b3(b3) == "Própria empresa"
        assert acoes.principal_b3({"on": None, "pn": None}) == "Não informado"

    def test_qualidade_detecta_ticker_duplicado_e_cnpj_ruim(self, reg: Registro) -> None:
        a, b = listada("1"), listada("2", cnpj="11111111000111")
        out, _, _ = acoes.construir([a, b], {"1": detalhe(), "2": detalhe()}, {}, {}, reg)
        rel = acoes.validar(out, None, dt.date(2026, 10, 29))
        assert {i.codigo for i in rel.erros} == {"duplicado"}  # ACME3 nas duas
        assert [i.codigo for i in rel.avisos] == ["cnpj_invalido"]  # dentro da tolerância

    def test_csv_tem_o_mesmo_cabecalho_do_seed(self, reg: Registro) -> None:
        cab = (
            (Path(__file__).parents[3] / "seed" / "data" / "acoes.csv").read_text(encoding="utf-8-sig").splitlines()[0]
        )
        assert ";".join(acoes.CSV_COLUNAS) == cab


class TestBdrs:
    def particao(self, **tickers: dict) -> dict:
        return {"tickers": tickers}

    @staticmethod
    def papel(
        volume: int, preco: float = 10.0, tipo: str = "DRN", nome: str = "ACME INC", ultimo: str = "2026-09-30"
    ) -> dict:
        return {
            "volume": volume,
            "negocios": 3,
            "ultimo_preco": preco,
            "primeiro_pregao": "2026-09-01",
            "ultimo_pregao": ultimo,
            "nome": nome,
            "tipo": tipo,
            "isin": "BRACMEBDR001",
        }

    def test_janela_de_24_meses_atravessa_o_ano(self) -> None:
        m = bdrs.meses_fechados(dt.date(2026, 1, 15))
        assert (m[0], m[-1], len(m)) == ("2024-01", "2025-12", 24)

    def construir(self, reg: Registro, deps_api: dict | None = None, fin: dict | None = None, over: dict | None = None):
        meses = ["2026-08", "2026-09"]
        p = {m: self.particao(AAAA34=self.papel(1000)) for m in meses}
        return bdrs.construir(
            p,
            meses,
            None,
            etfs={},
            deps_api=deps_api or {},
            nomes_api={},
            finservices=fin or {},
            overrides=over or {},
            reg=reg,
        )[0][0]

    def test_ordem_api_depois_finservices_depois_override_depois_nao_identificado(self, reg: Registro) -> None:
        fin = {"DRN": [Programa("AAAA34", "Acme Inc", False)]}
        over = {
            "AAAA34": {
                "nome": "",
                "depositaria": "itau-unibanco",
                "fonte": "Itaú (manual)",
                "ticker": "AAAA34",
                "data": "",
                "observacao": "",
            }
        }
        r = self.construir(reg, {"AAAA34": "BRADESCO"}, fin, over)
        assert (r["depositaria"], r["fonte_depositaria"]) == ("Banco Bradesco", bdrs.FONTE_API)
        r = self.construir(reg, {}, fin, over)
        assert (r["depositaria"], r["fonte_depositaria"]) == ("Banco B3", bdrs.FONTE_FINSERVICES)
        r = self.construir(reg, {}, {}, over)
        assert (r["depositaria"], r["fonte_depositaria"]) == ("Itaú Unibanco", "Itaú (manual)")
        r = self.construir(reg, {}, {}, {})
        assert (r["depositaria"], r["fonte_depositaria"]) == ("Não identificado", "")

    def test_texto_de_depositaria_desconhecido_cai_para_a_proxima_fonte_e_e_reportado(self, reg: Registro) -> None:
        meses = ["2026-09"]
        lista, nao = bdrs.construir(
            {"2026-09": self.particao(AAAA34=self.papel(5))}, meses, None, etfs={}, deps_api={"AAAA34": "BANCO NOVO XYZ"},
            nomes_api={}, finservices={"DRN": [Programa("AAAA34", "Acme", False)]}, overrides={}, reg=reg,
        )  # fmt: skip
        assert lista[0]["depositaria"] == "Banco B3" and nao == ["BANCO NOVO XYZ"]

    def test_etf_categoria_vem_da_api_e_qualificado_do_finservices(self, reg: Registro) -> None:
        etf = EtfRow.model_validate(
            {
                "codeCVM": "1",
                "issuingCompany": "BIVB",
                "companyName": "iShares",
                "codeCategoryBVMF": "29",
                "describleCategoryBVMF": "Renda Variável",
                "typeBDR": "DRE",
            }
        )
        p = {"2026-09": self.particao(BIVB39=self.papel(7, tipo="DRE"))}
        lista, _ = bdrs.construir(
            p,
            ["2026-09"],
            None,
            etfs={"BIVB": etf},
            deps_api={},
            nomes_api={},
            finservices={"ETF": [Programa("BIVB39", "iShares S&P 500", True)]},
            overrides={},
            reg=reg,
        )
        assert (lista[0]["categoria"], lista[0]["qualificado"], lista[0]["nome"]) == (
            "Renda Variável",
            True,
            "iShares S&P 500",
        )

    def test_mes_parcial_so_conta_como_ultimo_pregao_e_volume_parcial(self, reg: Registro) -> None:
        p = {
            "2026-09": self.particao(AAAA34=self.papel(1000)),
            "2026-10": self.particao(
                AAAA34=self.papel(50, preco=11.0, ultimo="2026-10-20"), NOVO34=self.papel(9, ultimo="2026-10-21")
            ),
        }
        lista, _ = bdrs.construir(
            p, ["2026-09"], "2026-10", etfs={}, deps_api={}, nomes_api={}, finservices={}, overrides={}, reg=reg
        )
        a, novo = lista
        assert (a["volume_24m"], a["volume_mes_parcial"], a["ultimo_pregao"], a["ultimo_preco"]) == (
            1000,
            50,
            "2026-10-20",
            11.0,
        )
        assert novo["ticker"] == "NOVO34" and novo["volume_24m"] == 0 and novo["volume_mes_parcial"] == 9

    def test_volume_mensal_alinhado_com_zeros_nos_meses_sem_negocio(self, reg: Registro) -> None:
        p = {"2026-07": self.particao(), "2026-08": self.particao(AAAA34=self.papel(40)), "2026-09": self.particao()}
        lista, _ = bdrs.construir(
            p,
            ["2026-07", "2026-08", "2026-09"],
            None,
            etfs={},
            deps_api={},
            nomes_api={},
            finservices={},
            overrides={},
            reg=reg,
        )
        assert lista[0]["volume_mensal"] == [0, 40, 0]

    def test_overrides_reais_do_seed_sao_lidos(self) -> None:
        o = bdrs.ler_overrides()
        assert o["ACNB34"]["depositaria"] == "banco-bradesco" and o["AMZO34"]["depositaria"] == "itau-unibanco"
        assert o["INBR32"]["fonte"].startswith("Comunicado Inter&Co")

    def test_csv_tem_o_cabecalho_do_seed(self) -> None:
        cab = (
            (Path(__file__).parents[3] / "seed" / "data" / "bdrs.csv")
            .read_text(encoding="utf-8-sig")
            .splitlines()[0]
            .split(";")
        )
        meses = [c[4:11] for c in cab if c.startswith("vol_")]
        esperado = bdrs.csv_cabecalho(meses)
        # o seed chama o 1º/último pregão de "primeiro_pregao_24m"/"ultimo_pregao": mesmos nomes e mesma ordem
        assert esperado == cab


def test_fontes_volume_cobre_todos_os_meses_e_o_parcial() -> None:
    particoes = {
        "2026-08": {"fonte": "mensal", "pregoes": []},
        "2026-09": {"fonte": "mensal", "pregoes": []},
        "2026-10": {"fonte": "diario", "pregoes": ["2026-10-01", "2026-10-02"]},
    }
    f = bdrs.fontes_volume(particoes, ["2026-08", "2026-09"], "2026-10")
    assert list(f) == ["2026-08", "2026-09", "2026-10"]
    assert [v["tipo"] for v in f.values()] == ["mensal", "mensal", "diario"]
    assert len(f["2026-10"]["arquivos"]) == 2
    assert list(bdrs.fontes_volume(particoes, ["2026-08", "2026-09"], None)) == ["2026-08", "2026-09"]
