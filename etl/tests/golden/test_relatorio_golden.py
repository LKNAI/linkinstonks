"""Relatório mensal: log de eventos fixo produz exatamente o texto esperado (item 8.7)."""

from __future__ import annotations

from pathlib import Path

from painel_etl.datasets import relatorio_mensal as r

EVENTOS = [
    {"chave": "9512", "data": "2026-10-15", "dataset": "acoes", "de": "Banco Bradesco", "fonte": "B3", "para": "Itaú Corretora", "tipo": "troca_escriturador"},
    {"chave": "26611", "data": "2026-10-30", "dataset": "acoes", "de": "MNLT SA", "fonte": "B3", "para": None, "tipo": "deslistagem"},
    {"chave": "9512", "data": "2026-10-20", "dataset": "acoes", "de": "NM", "fonte": "B3", "para": "N2", "tipo": "mudanca_segmento"},
    {"chave": "TSLA34", "data": "2026-10-05", "dataset": "bdrs", "de": None, "fonte": "B3", "para": None, "tipo": "novo_bdr"},
    {"chave": "TSLA34", "data": "2026-10-06", "dataset": "bdrs", "de": "Banco B3", "fonte": "B3", "para": "Itaú Unibanco", "tipo": "troca_depositaria"},
    {"chave": "9512", "data": "2026-10-07", "dataset": "acoes", "de": "presenca_media", "fonte": "COTAHIST", "para": "presenca_baixa", "tipo": "entrou_presenca_baixa"},
    {"chave": "9512", "data": "2026-09-30", "dataset": "acoes", "de": "A", "fonte": "B3", "para": "B", "tipo": "troca_escriturador"},
]  # fmt: skip


def _part(**volumes: int) -> dict:
    return {"pregoes": ["2026-10-01", "2026-10-02"], "tickers": {k: {"volume": v} for k, v in volumes.items()}}


def _gerar() -> dict:
    return r.construir(
        "2026-10",
        EVENTOS,
        {"9512": "PETROBRAS"},
        567,
        1152,
        (_part(PETR4=885_600_000_000), _part(PETR4=800_000_000_000)),
        (_part(TSLA34=30_000_000, AAPL34=20_000_000, MINI34=5_000_000), _part(TSLA34=10_000_000, AAPL34=40_000_000, MINI34=1_000)),
        [
            {"data": "2026-10-09", "fonte": "b3_listed", "status": "erro"},
            {"data": "2026-10-10", "fonte": "b3_listed", "status": "erro"},
        ],
        ["2026-10-01"],
        10_000_000,
        5,
        "2026-01",
        "1.0",
    )  # fmt: skip


ESPERADO = {
    "resumo": [
        "567 companhias e 1.152 BDRs no cadastro.",
        "Volume de ações no mês: R$ 885,6 bi (+10,7% contra o mês anterior).",
        "Volume de BDRs no mês: R$ 55,0 mi (+10,0% contra o mês anterior).",
    ],
    "escrituradores": [
        "PETROBRAS: escriturador passou de Banco Bradesco para Itaú Corretora, registrado em 15/10/2026 (fonte: B3)."
    ],
    "listagens": ["MNLT SA: saiu da lista de companhias em 30/10/2026 (fonte: B3)."],
    "segmentos": ["PETROBRAS: segmento passou de Novo Mercado para Nível 2, registrado em 20/10/2026 (fonte: B3)."],
    "bdrs": ["TSLA34: novo BDR, registrado em 05/10/2026 (fonte: B3)."],
    "depositarias": [
        "TSLA34: depositária passou de Banco B3 para Itaú Unibanco, registrado em 06/10/2026 (fonte: B3)."
    ],
    "altas": ["TSLA34: R$ 30,0 mi no mês, contra R$ 10,0 mi no mês anterior (+200,0%)."],
    "quedas": ["AAPL34: R$ 20,0 mi no mês, contra R$ 40,0 mi no mês anterior (−50,0%)."],  # noqa: RUF001
    "negociacao": [
        "PETROBRAS: categoria de negociação passou de presença média para presença baixa, registrado em 07/10/2026 (fonte: COTAHIST)."
    ],
    "qualidade": [
        "B3 · Empresas listadas: falha ou atraso de coleta em 2 dia(s), o último em 10/10/2026.",
        "1 pregão(ões) sem atualização diária, cobertos depois pelo arquivo mensal: 02/10/2026.",
    ],
}


def test_texto_exato() -> None:
    doc = _gerar()
    assert doc["titulo"] == "Relatório de outubro de 2026"
    assert {s["id"]: [i["texto"] for i in s["itens"]] for s in doc["secoes"]} == ESPERADO
    assert [s["id"] for s in doc["secoes"]] == list(ESPERADO)


def test_links_e_item_sem_pagina() -> None:
    secoes = {s["id"]: s["itens"] for s in _gerar()["secoes"]}
    assert secoes["escrituradores"][0]["href"] == "/acoes/9512/"
    assert secoes["bdrs"][0]["href"] == "/bdrs/TSLA34/"
    assert secoes["listagens"][0]["href"] is None  # a companhia saiu do cadastro: não há página


def test_secao_vazia_diz_nenhuma_ocorrencia() -> None:
    doc = r.construir("2026-10", [], {}, 0, 0, (None, None), (None, None), [], None, 10, 5, "2026-01", "1.0")
    vazias = {s["id"]: s["vazio"] for s in doc["secoes"] if not s["itens"]}
    assert vazias["escrituradores"] == "Nenhuma ocorrência no mês."
    qualidade = next(s for s in doc["secoes"] if s["id"] == "qualidade")
    assert qualidade["itens"][0]["texto"] == "Atualização diária dos pregões: sem registro para este mês."
    assert "sem base de comparação" in doc["secoes"][0]["itens"][1]["texto"]


def test_mes_anterior_ao_registro_nao_afirma_que_nao_houve_falha() -> None:
    doc = r.construir("2026-10", [], {}, 0, 0, (None, None), (None, None), [], ["2026-10-01"], 10, 5, "2026-11", "1.0")
    qualidade = next(s for s in doc["secoes"] if s["id"] == "qualidade")
    assert [i["texto"] for i in qualidade["itens"]] == [
        "Falhas de coleta: sem registro neste mês. O registro começa em novembro de 2026."
    ]


def test_companhia_fora_do_cadastro_nao_recebe_o_nome_do_banco() -> None:
    ev = {"chave": "123", "data": "2026-10-15", "dataset": "acoes", "de": "Banco Safra", "fonte": "B3", "para": "X"}
    doc = r.construir(
        "2026-10", [{**ev, "tipo": "troca_escriturador"}], {}, 0, 0, (None, None), (None, None), [], None, 10, 5,
        "2026-01", "1.0",
    )  # fmt: skip
    item = next(s for s in doc["secoes"] if s["id"] == "escrituradores")["itens"][0]
    assert item["texto"].startswith("CVM 123: escriturador passou de Banco Safra para X")
    assert item["href"] is None


def test_nomes_espelham_os_do_site() -> None:
    raiz = Path(__file__).parents[3]
    rotulos = (raiz / "web" / "lib" / "rotulos.ts").read_text("utf-8")
    assert all(f'{k}: "{v}"' in rotulos for k, v in r.FONTES.items())
    feed = (raiz / "web" / "scripts" / "gen-feed.mjs").read_text("utf-8")
    assert all(f'"{v}"' in feed for v in r.SEGMENTOS.values())


def test_percentual_em_queda_usa_o_sinal_de_menos() -> None:
    assert r.dinheiro(1_500_000) == "R$ 1,5 mi"
    texto = next(s for s in _gerar()["secoes"] if s["id"] == "quedas")["itens"][0]["texto"]
    assert texto.endswith("(" + chr(0x2212) + "50,0%).")


def test_determinismo() -> None:
    assert _gerar() == _gerar()
