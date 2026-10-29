from __future__ import annotations

import pytest

from painel_etl.normalize import cnpj
from painel_etl.normalize.instituicoes import NAO_INFORMADO, NAO_MAPEADO, PROPRIA, Registro
from painel_etl.normalize.text import fold
from painel_etl.normalize.tickers import base_ticker, is_bdr_ticker, ticker_class


class TestCnpj:
    def test_valido_e_invalido(self) -> None:
        assert cnpj.is_valid("00.000.000/0001-91")  # Banco do Brasil
        assert cnpj.is_valid("60746948000112")
        assert not cnpj.is_valid("60746948000113")
        assert not cnpj.is_valid("00000000000000")
        assert not cnpj.is_valid("0")  # ETFs vêm com cnpj "0"
        assert not cnpj.is_valid(None)

    def test_zeros_a_esquerda_e_mascara(self) -> None:
        assert cnpj.digits("8773135000100") == "08773135000100"  # a B3 omite o zero inicial
        assert cnpj.format_cnpj("8773135000100") == "08.773.135/0001-00"
        assert cnpj.format_cnpj("") == ""

    def test_raiz_une_matriz_e_filial(self) -> None:
        assert cnpj.root("30.306.294/0001-45") == cnpj.root("30.306.294/0002-26") == "30306294"


class TestTickers:
    @pytest.mark.parametrize(
        ("ticker", "classe"),
        [("PETR3", "ON"), ("PETR4", "PN"), ("ITUB4", "PN"), ("TAEE11", "Units"), ("ABCB5", "PNA"), ("XPTO9", "Outros")],
    )
    def test_classe(self, ticker: str, classe: str) -> None:
        assert ticker_class(ticker) == classe

    @pytest.mark.parametrize("t", ["AAPL34", "A1AP34", "BIVB39", "XPBR31", "AURA33", "JBSS32", "AAPL34F"])
    def test_bdr(self, t: str) -> None:
        assert is_bdr_ticker(t)

    @pytest.mark.parametrize("t", ["PETR4", "PETR4F", "ABCB10", "HYPE3", "AAPL36", "AAPL34ED"])
    def test_nao_bdr(self, t: str) -> None:
        assert not is_bdr_ticker(t)

    def test_fracionario_soma_no_ticker_base(self) -> None:
        assert base_ticker("AAPL34F") == "AAPL34"
        assert base_ticker("AAPL34") == "AAPL34"


class TestFold:
    def test_sem_acento_caixa_ou_pontuacao(self) -> None:
        assert fold("Itaú  Corretora, S.A.") == "itau corretora s a"
        assert fold(None) == ""


class TestRegistro:
    @pytest.fixture
    def reg(self) -> Registro:
        return Registro.carregar()

    def test_cnpjs_do_yaml_tem_digitos_verificadores_validos(self, reg: Registro) -> None:
        todos = [c for i in reg.itens for c in i.cnpjs]
        assert todos and all(cnpj.is_valid(c) for c in todos)

    @pytest.mark.parametrize(
        ("bruto", "esperado"),
        [
            ("ITAU CORRETORA ACOES", "itau-corretora"),
            ("ITAU CORRETORA DEBENTURES", "itau-corretora"),
            ("ITAUBANCO - ACOES", "itau-unibanco"),
            ("BRADESCO - DEBENT.", "banco-bradesco"),
            ("BRASIL", "banco-do-brasil"),
            ("BTG PACTUAL SERVIÇOS FINANC. S.A. DTVM", "btg-pactual"),
            ("VORTX DTVM LTDA.", "vortx-dtvm"),
            ("ID CTVM S.A.", "id-ctvm"),
            ("BANCO MERCANTIL DO BRASIL S.A.", "banco-mercantil-do-brasil"),
            ("BANCO DO NORDESTE DO BRASIL S.A.", "banco-do-nordeste"),
            ("SAFRA SERVIÇOS DE ADMINISTRAÇÃO FIDUCIÁR", "banco-safra"),
            ("BANCO B3 S.A.", "banco-b3"),
            ("Bradesco S.A. CTVM", "bradesco-ctvm"),
        ],
    )
    def test_textos_crus_da_b3_e_do_fca(self, reg: Registro, bruto: str, esperado: str) -> None:
        assert reg.resolver(bruto).id == esperado

    def test_literal_empresa_e_propria_empresa(self, reg: Registro) -> None:
        assert reg.resolver("EMPRESA").id == PROPRIA

    def test_vazio_e_nao_informado(self, reg: Registro) -> None:
        assert reg.resolver("").id == NAO_INFORMADO

    def test_nome_da_propria_companhia(self, reg: Registro) -> None:
        r = reg.resolver("CEMIG DISTRIBUICAO S.A.", empresa_nome="CEMIG DISTRIBUICAO S.A.")
        assert r.id == PROPRIA

    def test_mesmo_cnpj_da_companhia_e_propria_empresa(self, reg: Registro) -> None:
        r = reg.resolver("Fulano S/A", cnpj="12.345.678/0001-95", empresa_nome="Outra", empresa_cnpj="12345678000195")
        assert r.id == PROPRIA

    def test_nome_vence_o_cnpj_quando_divergem(self, reg: Registro) -> None:
        """Decisão da Fase 0: no FCA há "Itaú Corretora" com o CNPJ do Itaú Unibanco (60.701.190/0001-04)."""
        r = reg.resolver("Itaú Corretora de Valores S.A.", cnpj="60.701.190/0001-04", empresa_nome="Zeta")
        assert r.id == "itau-corretora" and r.via == "padrao"

    def test_cnpj_resolve_nome_desconhecido_pela_raiz(self, reg: Registro) -> None:
        r = reg.resolver("Nome Totalmente Novo", cnpj="30.306.294/0002-26", empresa_nome="Zeta")
        assert (r.id, r.via) == ("btg-pactual", "cnpj")

    def test_nao_mapeado_e_reportado_nunca_silencioso(self, reg: Registro) -> None:
        assert (
            reg.resolver("Instituição Inventada XYZ", cnpj="11.222.333/0001-81", empresa_nome="Zeta").id == NAO_MAPEADO
        )

    def test_cores_vem_do_yaml(self, reg: Registro) -> None:
        assert reg.por_id("itau-corretora").cor == "#EC7000"
        assert reg.por_id("itau-unibanco").cor_depositaria == "#EC7000"
        assert reg.nome_curto("banco-b3") == "Banco B3"
