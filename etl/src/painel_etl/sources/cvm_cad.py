"""CVM: cadastro de companhias abertas (`docs/fontes.md`, seção 3).

Ponte CNPJ -> código CVM e situação do registro. Semanal. A projeção fica em `data/state/cvm_cad.json`,
porque o dataset `acoes` a consulta em toda execução diária.
"""

from __future__ import annotations

import csv
import io
from typing import Any

from painel_etl.core.http import Http
from painel_etl.core.state import State
from painel_etl.normalize import cnpj as cnpj_mod

URL = "https://dados.cvm.gov.br/dados/CIA_ABERTA/CAD/DADOS/cad_cia_aberta.csv"


def parse(conteudo: bytes) -> dict[str, dict[str, str]]:
    """CNPJ (14 dígitos) -> {codigo_cvm, situacao, data_cancelamento}."""
    texto = io.StringIO(conteudo.decode("iso-8859-1"), newline="")
    saida: dict[str, dict[str, str]] = {}
    for r in csv.DictReader(texto, delimiter=";"):
        c = cnpj_mod.digits(r["CNPJ_CIA"])
        if c:
            saida[c] = {
                "codigo_cvm": r["CD_CVM"].strip().lstrip("0"),
                "situacao": r["SIT"].strip(),
                "data_cancelamento": r["DT_CANCEL"].strip(),
            }
    return saida


def atualizar(http: Http, state: State) -> dict[str, Any]:
    r = http.get(URL, read_timeout=120)
    r.raise_for_status()
    dados = parse(r.content)
    state.set("companhias", dados)
    state.set("etag", r.headers.get("etag"))
    return dados
