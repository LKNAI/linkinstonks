"""Item 8.3: faixas de ticket médio dos BDRs."""

from __future__ import annotations

from painel_etl.datasets import bdrs as ds_bdrs
from painel_etl.datasets import perfil_bdr as ds
from painel_etl.indicadores import carregar

CFG = carregar().perfil_bdr


def ponto(volume: int, negocios: int) -> dict[str, int]:
    return {"volume": volume, "negocios": negocios}


def test_quartis_so_com_quem_tem_negocios_suficientes() -> None:
    pontos = {f"T{i}": ponto(100 * i * 30, 30) for i in range(1, 6)} | {"RARO": ponto(10_000_000, 29)}
    q = ds.quartis_do_mes(pontos, CFG)
    assert q == {"bdrs": 5, "q1": 200.0, "q3": 400.0}


def test_sem_bdrs_suficientes_nao_ha_quartis() -> None:
    assert ds.quartis_do_mes({"A": ponto(100, 30), "B": ponto(200, 30)}, CFG) is None


def test_faixas_nos_limites() -> None:
    q = {"bdrs": 5, "q1": 200.0, "q3": 400.0}
    assert ds.faixa(200 * 30, 30, q, CFG) == ds.BAIXO
    assert ds.faixa(201 * 30, 30, q, CFG) == ds.INTERMEDIARIO
    assert ds.faixa(400 * 30, 30, q, CFG) == ds.INTERMEDIARIO
    assert ds.faixa(401 * 30, 30, q, CFG) == ds.ALTO
    assert ds.faixa(1_000_000, 29, q, CFG) == ds.INSUFICIENTE
    assert ds.faixa(1_000_000, 30, None, CFG) == ds.INSUFICIENTE


def test_resumo_da_janela() -> None:
    meses = [f"2026-{m:02d}" for m in range(1, 13)]
    quartis = {m: {"bdrs": 5, "q1": 10.0, "q3": 20.0} for m in meses}
    volumes = [300] * 6 + [900] * 6
    negocios = [30] * 6 + [30] * 5 + [0]
    r = ds.perfil(volumes, negocios, meses, quartis, CFG)
    assert r["faixa"] == ds.INSUFICIENTE  # o último mês não teve negócios
    assert r["negocios_janela"] == 330 and r["ticket_medio_janela"] == round(7200 / 330, 2)


def test_sem_negocio_na_janela_ticket_nulo() -> None:
    meses = ["2026-01", "2026-02"]
    r = ds.perfil([0, 0], [0, 0], meses, {}, CFG)
    assert r["ticket_medio_janela"] is None and r["faixa"] == ds.INSUFICIENTE


def test_nao_ha_rotulo_de_tipo_de_investidor() -> None:
    assert not any("fisica" in f or "institucional" in f for f in ds.FAIXAS)


def test_mes_sem_bdrs_suficientes_fica_de_fora_dos_quartis() -> None:
    part = {
        "2026-09": {"tickers": {"A": ponto(100, 1)}},
        "2026-10": {"tickers": {f"T{i}": ponto(100 * i * 30, 30) for i in range(1, 6)}},
    }
    assert list(ds_bdrs.quartis_por_mes(part, ["2026-09", "2026-10"], CFG)) == ["2026-10"]
