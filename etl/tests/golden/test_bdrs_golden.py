"""Golden: o pipeline de BDRs, sobre dados reais congelados (COTAHIST dos 24 meses, API da B3, finservices),
reproduz o seed (28/10/2026). Critérios da seção 14 do prompt:

- 1.143 BDRs;
- distribuição de depositárias igual à do seed (Banco B3 1.026, não identificado 56, Bradesco 46, Itaú 15), ±1%;
- volume total de 24 meses com diferença <= 0,1%.
"""

from __future__ import annotations

import datetime as dt
import gzip
import json
from collections import Counter
from pathlib import Path
from typing import Any

import pytest

from painel_etl import paths
from painel_etl.datasets import bdrs
from painel_etl.normalize.instituicoes import Registro
from painel_etl.sources import b3_finservices
from painel_etl.sources.b3_listed import EtfRow

pytestmark = pytest.mark.golden
GOLDEN = Path(__file__).parent
FIXTURES = GOLDEN.parent / "fixtures" / "b3_finservices"
SEED = paths.repo_root() / "seed" / "data" / "bdrs.json"
HOJE = dt.date(2026, 10, 29)


@pytest.fixture(scope="module")
def resultado() -> dict[str, dict[str, Any]]:
    g = json.loads(gzip.decompress((GOLDEN / "b3_bdrs_2026-10-29.json.gz").read_bytes()))
    etf_rows = [EtfRow.model_validate(x) for x in g["etfs"]]
    deps: dict[str, str] = {}
    nomes: dict[str, str] = {}
    for codigo, nome in [(e.codigo_cvm, e.nome) for e in etf_rows] + [
        (p["codeCVM"], p["companyName"]) for p in g["patrocinados"]
    ]:
        det = g["detalhes"][codigo]
        if det and det.get("code"):
            deps[det["code"]] = det.get("institutionPreferred") or ""
            nomes[det["code"]] = nome
    fin = {
        "DRN": b3_finservices.parse((FIXTURES / "programas_drn_tabela.html").read_text(encoding="utf-8")),
        "ETF": b3_finservices.parse((FIXTURES / "programas_etf_tabela.html").read_text(encoding="utf-8")),
    }
    meses = bdrs.meses_fechados(HOJE)
    particoes = {m: json.loads((GOLDEN / "bdr_volume" / f"{m}.json").read_text(encoding="utf-8")) for m in meses}
    lista, _ = bdrs.construir(
        particoes, meses, None,
        etfs={e.emissor: e for e in etf_rows}, deps_api=deps, nomes_api=nomes, finservices=fin,
        overrides=bdrs.ler_overrides(), reg=Registro.carregar(),
    )  # fmt: skip
    return {b["ticker"]: b for b in lista}


@pytest.fixture(scope="module")
def seed() -> dict[str, dict[str, Any]]:
    return {d["t"]: d for d in json.loads(SEED.read_text(encoding="utf-8"))["bdrs"]}


def test_janela_de_24_meses_igual_ao_seed() -> None:
    seed_meses = json.loads(SEED.read_text(encoding="utf-8"))["meta"]["months"]
    assert bdrs.meses_fechados(HOJE) == seed_meses


def test_1143_bdrs_mesmo_conjunto(resultado, seed):
    assert len(resultado) == 1143
    assert set(resultado) == set(seed)


def test_distribuicao_de_depositarias(resultado, seed):
    esperado = {"Banco B3": 1026, "Não identificado": 56, "Banco Bradesco": 46, "Itaú Unibanco": 15}
    assert Counter(d["d"] for d in seed.values()) == Counter(esperado)  # sanidade do próprio seed
    obtido = Counter(b["depositaria"] for b in resultado.values())
    for dep, n in esperado.items():
        assert abs(obtido[dep] - n) <= max(1, round(n * 0.01)), (dep, obtido[dep], n)
    assert set(obtido) <= set(esperado)


def test_depositaria_por_ticker_igual_ao_seed(resultado, seed):
    iguais = sum(1 for t, s in seed.items() if resultado[t]["depositaria"] == s["d"])
    assert iguais / len(seed) >= 0.99, iguais


def test_volume_total_24m_dentro_de_0_1_por_cento(resultado, seed):
    novo = sum(b["volume_24m"] for b in resultado.values())
    velho = sum(sum(s["v"]) for s in seed.values()) * 1000
    assert abs(novo - velho) / velho <= 0.001, (novo, velho)


def test_volume_mensal_por_ticker_igual_ao_seed(resultado, seed):
    """O seed guarda R$ mil arredondado por mês; aceita 1 mil de diferença."""
    ruins = [
        (t, i)
        for t, s in seed.items()
        for i, v in enumerate(s["v"])
        if abs(resultado[t]["volume_mensal"][i] / 1000 - v) > 1
    ]
    assert not ruins, ruins[:5]


def test_negocios_tipo_isin_preco_e_categoria(resultado, seed):
    assert all(resultado[t]["negocios_24m"] == s["g"] for t, s in seed.items())
    assert all(resultado[t]["tipo"] == s["k"] for t, s in seed.items())
    assert all(resultado[t]["isin"] == s["i"] for t, s in seed.items())
    assert all(abs(resultado[t]["ultimo_preco"] - s["p"]) < 0.005 for t, s in seed.items())
    assert all(resultado[t]["ultimo_pregao"] == s["l"] for t, s in seed.items())


def test_categoria_dos_etfs_vem_da_api_com_rotulos_da_api(resultado, seed):
    mapa = {
        "Renda variável": "Renda Variável",
        "Renda fixa": "Renda Fixa",
        "Commodities / cripto": "Commodities",
        "": "",
    }
    ruins = [t for t, s in seed.items() if s["k"] == "DRE" and s["c"] and resultado[t]["categoria"] != mapa[s["c"]]]
    assert not ruins


def test_qualificado_igual_ao_seed(resultado, seed):
    assert all(resultado[t]["qualificado"] == bool(s["q"]) for t, s in seed.items())


def test_qualidade_passa_sobre_o_golden(resultado):
    rel = bdrs.validar(list(resultado.values()), anterior=1143, hoje=HOJE)
    assert rel.ok, rel.markdown()
