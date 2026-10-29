"""Regras do histórico de escrituradores (seção 7.2 do prompt, ajustada na Fase 0/2)."""

from __future__ import annotations

import pytest

from painel_etl.datasets.escrituradores import derivar
from painel_etl.normalize.instituicoes import Registro
from painel_etl.sources.cvm_fca import FcaRow

EMPRESA = "Empresa Zeta S.A."
CNPJ = "11222333000181"
ITAU = ("Itaú Corretora de Valores S.A.", "61194353000164")
BRADESCO = ("Banco Bradesco S.A.", "60746948000112")
BTG = ("BTG Pactual Serviços Financeiros S.A. DTVM", "59281253000123")


@pytest.fixture(scope="module")
def reg() -> Registro:
    return Registro.carregar()


def linha(ano: int, inst: tuple[str, str], inicio: str = "", fim: str = "", versao: int = 1) -> FcaRow:
    return FcaRow(
        cnpj=CNPJ,
        referencia=f"{ano}-01-01",
        versao=versao,
        empresa=EMPRESA,
        escriturador=inst[0],
        cnpj_escriturador=inst[1],
        inicio=inicio,
        fim=fim,
    )


def test_sem_troca(reg: Registro) -> None:
    h = derivar([linha(a, ITAU, "2015-03-02") for a in (2020, 2021, 2022)], reg)
    assert h
    assert (h.atual.nome, h.inicio, h.inicio_aproximado, h.anterior, h.n) == (
        "Itaú Corretora",
        "2015-03-02",
        False,
        None,
        1,
    )


def test_uma_troca_com_documento_de_duas_linhas(reg: Registro) -> None:
    """No ano da troca o documento traz o antigo (com fim) e o novo (sem fim): o atual é o sem fim."""
    linhas = [
        linha(2020, BRADESCO, "2010-01-04"),
        linha(2021, BRADESCO, "2010-01-04", "2021-06-30"),
        linha(2021, ITAU, "2021-07-01"),
        linha(2022, ITAU, "2021-07-01"),
    ]
    h = derivar(linhas, reg)
    assert h
    assert h.atual.nome == "Itaú Corretora" and h.inicio == "2021-07-01"
    assert h.anterior and h.anterior.nome == "Banco Bradesco"
    assert (h.anterior.inicio_primeiro, h.anterior.fim, h.anterior.ultimo_ano) == ("2010-01-04", "2021-06-30", 2021)
    assert h.n == 2


def test_varias_trocas_anterior_e_o_ultimo_diferente_do_atual(reg: Registro) -> None:
    linhas = [
        linha(2011, BRADESCO, "2000-01-01"),
        linha(2015, ITAU, "2014-05-05"),
        linha(2020, BTG, "2019-02-02"),
    ]
    h = derivar(linhas, reg)
    assert h
    assert [p.nome for p in h.passagens] == ["Banco Bradesco", "Itaú Corretora", "BTG Pactual"]
    assert (h.atual.nome, h.anterior.nome if h.anterior else None, h.n) == ("BTG Pactual", "Itaú Corretora", 3)


def test_data_de_inicio_ausente_vira_aproximada_pelo_primeiro_ano(reg: Registro) -> None:
    linhas = [linha(2018, BRADESCO), linha(2019, ITAU), linha(2020, ITAU)]
    h = derivar(linhas, reg)
    assert h
    assert h.atual.nome == "Itaú Corretora"
    assert (h.inicio, h.inicio_aproximado) == ("2019-01-01", True)


def test_inicio_do_atual_e_o_mais_recente_e_do_anterior_o_mais_antigo(reg: Registro) -> None:
    linhas = [
        linha(2012, BRADESCO, "2005-01-01"),
        linha(2013, BRADESCO, "2006-06-06"),
        linha(2014, ITAU, "2014-01-02"),
        linha(2015, ITAU, "2014-01-09"),
    ]
    h = derivar(linhas, reg)
    assert h and h.anterior
    assert h.inicio == "2014-01-09"
    assert h.anterior.inicio_primeiro == "2005-01-01"


def test_nome_vence_o_cnpj_trocado_do_grupo(reg: Registro) -> None:
    h = derivar([linha(2022, ("Itaú Corretora de Valores S.A.", "60701190000104"), "2020-01-01")], reg)
    assert h and h.atual.nome == "Itaú Corretora"


def test_escriturador_proprio_da_companhia(reg: Registro) -> None:
    h = derivar([linha(2022, ("Empresa Zeta S.A.", "11222333000181"), "2000-01-01")], reg)
    assert h and h.atual.nome == "Própria empresa"


def test_instituicao_desconhecida_e_marcada_para_o_relatorio(reg: Registro) -> None:
    h = derivar([linha(2022, ("Banco Totalmente Novo", "99999999000191"), "2020-01-01")], reg)
    assert h and h.atual.nao_mapeado and h.atual.nome == "Banco Totalmente Novo"


def test_sem_linhas(reg: Registro) -> None:
    assert derivar([], reg) is None
