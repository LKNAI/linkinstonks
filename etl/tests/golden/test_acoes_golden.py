"""Golden: o pipeline de ações, sobre dados reais congelados em 2026-10-29, reproduz o seed (23/10/2026).

Entradas congeladas (`etl/tests/golden/`): lista e detalhes da B3 (568 companhias) e as partições do FCA.
Meta do prompt (seção 14): 568 companhias; escriturador atual e anterior iguais em >= 99%.
Divergências conhecidas e justificadas estão em `docs/paridade.md`.
"""

from __future__ import annotations

import datetime as dt
import gzip
import json
from pathlib import Path
from typing import Any

import pytest

from painel_etl import paths
from painel_etl.datasets import acoes
from painel_etl.normalize.instituicoes import Registro
from painel_etl.sources.b3_listed import CompanyDetail, ListedCompany
from painel_etl.sources.cvm_fca import carregar_historico

pytestmark = pytest.mark.golden
GOLDEN = Path(__file__).parent
SEED = paths.repo_root() / "seed" / "data" / "acoes.json"


@pytest.fixture(scope="module")
def resultado() -> dict[str, dict[str, Any]]:
    g = json.loads(gzip.decompress((GOLDEN / "b3_acoes_2026-10-29.json.gz").read_bytes()))
    listadas = [ListedCompany.model_validate(x) for x in g["listadas"]]
    detalhes = {k: (CompanyDetail.model_validate(v) if v else None) for k, v in g["detalhes"].items()}
    fca = carregar_historico(GOLDEN / "fca")
    companhias, _, _ = acoes.construir(listadas, detalhes, fca, {}, Registro.carregar())
    return {c["codigo_cvm"]: c for c in companhias}


@pytest.fixture(scope="module")
def seed() -> dict[str, dict[str, Any]]:
    return {c["v"]: c for c in json.loads(SEED.read_text(encoding="utf-8"))["companies"]}


def _taxa(
    resultado: dict[str, dict[str, Any]], seed: dict[str, dict[str, Any]], igual: Any, so_com_fca: bool = False
) -> float:
    pares = [(resultado[k], seed[k]) for k in seed if k in resultado and (not so_com_fca or seed[k]["f"])]
    return sum(1 for novo, velho in pares if igual(novo, velho)) / len(pares)


def test_568_companhias_mesmo_conjunto(resultado, seed):
    assert len(resultado) == 568
    assert set(resultado) == set(seed)


def test_escriturador_b3_igual_ao_seed(resultado, seed):
    taxa = _taxa(resultado, seed, lambda n, s: acoes.principal_b3(n["escriturador_b3"]) == s["b"])
    assert taxa >= 0.99, taxa
    assert _taxa(resultado, seed, lambda n, s: n["escriturador_b3"]["bruto_on"] == s["onr"]) == 1.0


def test_escriturador_cvm_atual_igual_ao_seed(resultado, seed):
    taxa = _taxa(resultado, seed, lambda n, s: n["escriturador_cvm"]["atual"] == s["f"]["cur"], so_com_fca=True)
    assert taxa >= 0.99, taxa


def test_escriturador_cvm_anterior_igual_ao_seed(resultado, seed):
    taxa = _taxa(
        resultado, seed, lambda n, s: (n["escriturador_cvm"]["anterior"] or "") == s["f"]["prev"], so_com_fca=True
    )
    assert taxa >= 0.99, taxa


def test_datas_e_contagem_do_historico(resultado, seed):
    ini = _taxa(resultado, seed, lambda n, s: n["escriturador_cvm"]["inicio"] == s["f"]["ini"], so_com_fca=True)
    aprox = _taxa(
        resultado, seed, lambda n, s: n["escriturador_cvm"]["inicio_aproximado"] == s["f"]["ax"], so_com_fca=True
    )
    n = _taxa(resultado, seed, lambda n, s: n["escriturador_cvm"]["n_escrituradores"] == s["f"]["n"], so_com_fca=True)
    assert ini >= 0.99 and aprox >= 0.99 and n >= 0.99, (ini, aprox, n)


def test_quem_tem_fca_e_o_mesmo(resultado, seed):
    assert {k for k, c in resultado.items() if c["escriturador_cvm"]} == {k for k, c in seed.items() if c["f"]}


def test_divergencia_b3_cvm_igual_ao_seed(resultado, seed):
    taxa = _taxa(
        resultado,
        seed,
        lambda n, s: n["divergente_b3_cvm"] == bool(s["f"] and s["f"]["cur"] != s["b"]),
        so_com_fca=True,
    )
    assert taxa >= 0.99, taxa


def test_tickers_so_diferem_nos_casos_conhecidos(resultado, seed):
    """Só BIOMM (BIOM12) e EMAE (EMAE3/EMAE4) mudaram entre a coleta do seed (23/10) e a da API (29/10)."""
    difere = {k for k in seed if {t["ticker"] for t in resultado[k]["tickers"]} != {t for t, _ in seed[k]["t"]}}
    assert difere == {"19305", "16993"}


def test_segmento_so_difere_no_helbor(resultado, seed):
    """HELBOR passou de Novo Mercado para Tradicional (decisão da Fase 0: mudança real)."""
    difere = {k for k in seed if resultado[k]["segmento"] != seed[k]["m"]}
    assert difere == {"20877"}


def test_debentures_ficam_de_fora(resultado):
    assert not [t for c in resultado.values() for t in c["tickers"] if "-" in t["ticker"]]


def test_qualidade_passa_sobre_o_golden(resultado):
    rel = acoes.validar(list(resultado.values()), anterior=568, hoje=dt.date(2026, 10, 29))
    assert rel.ok, rel.markdown()
