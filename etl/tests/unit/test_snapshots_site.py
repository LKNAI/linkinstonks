from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

import pytest

from painel_etl import pipeline
from painel_etl.core import io as pio
from painel_etl.core import schema
from painel_etl.datasets import snapshots_site as s

COMPANHIA = {
    "cnpj": "33.000.167/0001-01", "codigo_cvm": "9512", "emissor": "PETR", "pregao": "PETROBRAS",
    "razao_social": "PETROLEO BRASILEIRO S.A.", "segmento": "N2", "setor": "Petróleo",
    "tickers": [{"classe": "ON", "ticker": "PETR3", "negociacao_desde": None}],
    "listagem": {"desde": "2000-01-01"},
    "escriturador_cvm": {"inicio_aproximado": True},
}  # fmt: skip
HIST = {
    "9512": [
        {"inicio": "2015-01-01", "fim": "2024-06-30", "instituicao": "Banco Bradesco", "inicio_aproximado": False},
        {"inicio": "2024-07-01", "fim": None, "instituicao": "Itaú Corretora", "inicio_aproximado": False},
    ]
}


@pytest.mark.parametrize(
    ("mes", "esperado", "anterior"),
    [("2024-06", "Banco Bradesco", None), ("2024-07", "Itaú Corretora", "Banco Bradesco"), ("2026-09", "Itaú Corretora", "Banco Bradesco")],
)  # fmt: skip
def test_reconstitui_o_escriturador_do_fim_do_mes(mes: str, esperado: str, anterior: str | None) -> None:
    doc = s.acoes_reconstituido([COMPANHIA], HIST, mes, "1.0")
    c = doc["companhias"][0]
    assert doc["reconstituido"] is True and doc["coletado_em"] is None
    assert c["escriturador"] == esperado and c["escriturador_cvm"]["anterior"] == anterior
    assert not schema.erros("snapshot_acoes", doc)


def test_fora_quem_nao_tinha_escriturador_ou_nao_era_listada() -> None:
    assert s.acoes_reconstituido([COMPANHIA], HIST, "2014-12", "1.0")["companhias"] == []
    tardia = {**COMPANHIA, "listagem": {"desde": "2026-01-01"}}
    assert s.acoes_reconstituido([tardia], HIST, "2025-12", "1.0")["companhias"] == []


def test_real_usa_o_csv_guardado_e_nao_e_marcado_como_reconstituido() -> None:
    linha = {
        "cnpj": "1", "codigo_cvm": "9512", "codigo_emissor": "PETR", "escriturador_b3": "Banco Bradesco",
        "escriturador_cvm": "", "escriturador_desde": "", "escriturador_anterior": "", "anterior_inicio": "",
        "anterior_fim": "", "pregao": "PETROBRAS", "razao_social": "P", "segmento": "N2", "setor": "X",
        "tickers": "PETR3 NOVO4",
    }  # fmt: skip
    doc = s.acoes_real([linha], [COMPANHIA], "2026-09", "2026-10-29", "1.0")
    assert doc["reconstituido"] is False and doc["coletado_em"] == "2026-10-29"
    assert doc["companhias"][0]["escriturador_cvm"] is None
    assert doc["companhias"][0]["tickers"] == [
        {"classe": "ON", "ticker": "PETR3"},
        {"classe": "Outros", "ticker": "NOVO4"},
    ]
    assert not schema.erros("snapshot_acoes", doc)


def test_bdrs_alinham_volume_aos_meses_e_marcam_sem_cadastro() -> None:
    t = {"isin": "X", "negocios": 3, "nome": "NOME", "primeiro_pregao": "2026-08-03", "tipo": "DRN", "ultimo_preco": 1.5, "ultimo_pregao": "2026-08-31", "volume": 100}  # fmt: skip
    part = {"2026-08": {"tickers": {"AAA34": t}}, "2026-09": {"tickers": {"BBB34": {**t, "volume": 7}}}}
    cad = [{"ticker": "AAA34", "nome": "Aaa", "tipo": "DRN", "depositaria": "Banco B3", "fonte_depositaria": "F", "categoria": "", "qualificado": "1"}]  # fmt: skip
    doc = s.bdrs_do_mes(part, ["2026-08", "2026-09"], cad, "2026-09", True, None, "1.0")
    a, b = doc["bdrs"]
    assert a["volume_mensal"] == [100, 0] and a["qualificado"] is True and a["depositaria"] == "Banco B3"
    assert b["volume_mensal"] == [0, 7] and b["depositaria"] == "Não identificado"
    assert not schema.erros("snapshot_bdrs", doc)


def test_fim_do_mes_em_ano_bissexto() -> None:
    assert s.fim_do_mes("2024-02") == "2024-02-29"


def _preparar(raiz: Path) -> pipeline.Contexto:
    (raiz / "public").mkdir(parents=True)
    (raiz / "public" / "acoes.json").write_text(json.dumps({"companhias": [COMPANHIA]}), "utf-8")
    (raiz / "public" / "acoes_historico_escrituradores.json").write_text(json.dumps({"companhias": HIST}), "utf-8")
    return pipeline.Contexto(hoje=dt.date(2026, 11, 5), raiz=raiz)


def test_gerar_sem_snapshot_real_reconstitui(tmp_path: Path) -> None:
    ctx = _preparar(tmp_path)
    assert pipeline.gerar_snapshot_site(ctx, "2026-08") == ["acoes"]
    doc = json.loads((tmp_path / "snapshots_site" / "2026-08" / "acoes.json").read_text("utf-8"))
    assert doc["reconstituido"] is True
    assert "codigo_cvm" in doc["colunas"] and doc["linhas"][0][doc["colunas"].index("codigo_cvm")] == "9512"


def test_compactar_preserva_os_registros() -> None:
    doc = s.compactar({"mes": "2026-09", "x": [{"b": 2, "a": 1}, {"a": 3, "b": 4}]}, "x")
    assert doc == {"mes": "2026-09", "colunas": ["a", "b"], "linhas": [[1, 2], [3, 4]]}
    assert s.compactar({"x": []}, "x") == {"colunas": [], "linhas": []}


def test_mes_so_e_real_com_csv_guardado_e_data_de_coleta(tmp_path: Path) -> None:
    ctx = _preparar(tmp_path)
    snap = tmp_path / "history" / "snapshots"
    colunas = [
        "cnpj", "codigo_cvm", "codigo_emissor", "escriturador_b3", "escriturador_cvm", "escriturador_desde",
        "escriturador_anterior", "anterior_inicio", "anterior_fim", "pregao", "razao_social", "segmento", "setor",
        "tickers",
    ]  # fmt: skip
    linha = ["1", "9512", "PETR", "Banco Safra", "", "", "", "", "", "PETROBRAS", "P", "N2", "X", "PETR3"]
    pio.write_csv_gz(snap / "2026-09" / "acoes.csv.gz", colunas, [linha])
    gravado = tmp_path / "snapshots_site" / "2026-09" / "acoes.json"

    pipeline.gerar_snapshot_site(ctx, "2026-09")
    assert json.loads(gravado.read_text("utf-8"))["reconstituido"] is True  # sem data: não se apresenta como foto

    (snap / "datas_coleta.json").write_text('{"2026-09": "2026-10-29"}', "utf-8")
    pipeline.gerar_snapshot_site(ctx, "2026-09")
    doc = json.loads(gravado.read_text("utf-8"))
    assert doc["reconstituido"] is False and doc["coletado_em"] == "2026-10-29"
    assert doc["linhas"][0][doc["colunas"].index("escriturador")] == "Banco Safra"


def test_falha_de_fonte_vai_para_o_registro_e_dia_sem_falha_nao_gera_arquivo(tmp_path: Path) -> None:
    ctx = pipeline.Contexto(hoje=dt.date(2026, 11, 5), raiz=tmp_path)
    ok = pipeline.Resultado("acoes", fontes={"b3_listed": {"status": "ok"}})
    pipeline.registrar_falhas(ctx, [ok])
    assert not (tmp_path / "history" / "qualidade").exists()
    ruim = pipeline.Resultado("acoes", fontes={"b3_listed": {"status": "erro"}})
    pipeline.registrar_falhas(ctx, [ruim])
    pipeline.registrar_falhas(ctx, [ruim])
    linhas = (tmp_path / "history" / "qualidade" / "2026-11.jsonl").read_text("utf-8").splitlines()
    assert [json.loads(x) for x in linhas] == [{"data": "2026-11-05", "fonte": "b3_listed", "status": "erro"}]
