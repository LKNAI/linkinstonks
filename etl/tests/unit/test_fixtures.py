"""Valida as fixtures gravadas na Fase 0 e as peculiaridades documentadas em docs/fontes.md."""

from __future__ import annotations

import base64
import csv
import io
import json
import re
from pathlib import Path

import pytest

from painel_etl.probe import BDR_RX, unwrap


def test_parametro_b3_e_base64_de_json() -> None:
    p = {"language": "pt-br", "pageNumber": 1, "pageSize": 120}
    enc = base64.b64encode(json.dumps(p).encode()).decode()
    assert "\n" not in enc
    assert json.loads(base64.b64decode(enc)) == p


def test_getdetail_tem_dupla_codificacao(fixtures: Path) -> None:
    raw = (fixtures / "b3_listed" / "GetDetail_acao_SANB.json").read_bytes()
    assert isinstance(json.loads(raw), str)  # JSON dentro de string
    d = unwrap(raw)
    assert d["issuingCompany"] == "SANB"
    assert {c["code"] for c in d["otherCodes"]} == {"SANB3", "SANB4", "SANB11"}


def test_getdetail_vazio_nao_e_erro(fixtures: Path) -> None:
    assert unwrap((fixtures / "b3_listed" / "GetDetail_acao_EUROFARMA_vazio.json").read_bytes()) == {}


def test_etf_traz_depositaria_e_patrocinado_tambem(fixtures: Path) -> None:
    etf = unwrap((fixtures / "b3_listed" / "GetDetail_bdr_etf_CBTC.json").read_bytes())
    spo = unwrap((fixtures / "b3_listed" / "GetDetail_bdr_patrocinado_AURA.json").read_bytes())
    assert etf["institutionPreferred"] == "BANCO B3 S.A."
    assert spo["institutionPreferred"] == "BRADESCO"


def test_lista_b3_tem_tipo_1_e_typebdr(fixtures: Path) -> None:
    j = json.loads((fixtures / "b3_listed" / "GetInitialCompanies_p1.json").read_bytes())
    assert j["page"]["totalPages"] == 30
    assert all(r["status"] == "A" for r in j["results"])
    assert {"codeCVM", "cnpj", "marketIndicator", "type", "typeBDR"} <= set(j["results"][0])


def test_categorias_de_etf_da_api(fixtures: Path) -> None:
    cats = unwrap((fixtures / "b3_listed" / "GetCategoryBDRETF.json").read_bytes())  # também dupla codificação
    assert {c["id"]: c["describle"] for c in cats} == {
        28: "Renda Fixa",
        29: "Renda Variável",
        30: "Commodities",
        43: "Moeda",
    }


def test_cotahist_layout_posicional(fixtures: Path) -> None:
    raw = (fixtures / "b3_cotahist" / "COTAHIST_D28102026_bdr_extrato.txt").read_bytes().decode("iso-8859-1")
    lines = [ln for ln in raw.split("\r\n") if ln]
    assert lines[0][:2] == "00" and lines[-1][:2] == "99"
    body = lines[1:-1]
    assert len(body) == 601
    assert all(len(ln) == 245 and ln[:2] == "01" for ln in body)
    assert all(BDR_RX.match(ln[12:24].strip()) for ln in body)
    first = body[0]
    assert first[2:10] == "20261028"
    assert int(first[108:121]) / 100 > 0  # PREULT com 2 casas implícitas


def test_fca_iso_8859_1_e_documentos_com_mais_de_uma_linha(fixtures: Path) -> None:
    raw = (fixtures / "cvm_fca" / "fca_cia_aberta_escriturador_2026.csv").read_bytes()
    with pytest.raises(UnicodeDecodeError):
        raw.decode("utf-8")
    rows = list(csv.DictReader(io.StringIO(raw.decode("iso-8859-1")), delimiter=";"))
    assert len(rows) == 530
    docs: dict[tuple[str, str, str], int] = {}
    for r in rows:
        k = (r["CNPJ_Companhia"], r["Data_Referencia"], r["Versao"])
        docs[k] = docs.get(k, 0) + 1
    assert len(docs) == 466  # documentos = (companhia, referência, versão)
    assert sum(1 for n in docs.values() if n > 1) == 61  # achado da Fase 0 (docs/fontes.md)


def test_finservices_asteriscos_de_investidor_qualificado(fixtures: Path) -> None:
    t = (fixtures / "b3_finservices" / "programas_etf_tabela.html").read_text(encoding="utf-8")
    nomes = re.findall(r'table-bdr__result-one">([^<]*)<', t)
    assert len(nomes) == 309
    assert sum(1 for n in nomes if n.endswith("*")) == 10


def test_bradesco_graphql_so_tem_nome(fixtures: Path) -> None:
    j = json.loads((fixtures / "bradesco" / "bdr_graphql.json").read_bytes())
    items = j["data"]["bradescoCustodiaArquivoList"]["items"]
    assert len(items) == 44
    assert all(not re.search(r"[A-Z0-9]{4}3[1-59]", i["link_title"] or "") for i in items)


def test_itau_fixture_documenta_o_bloqueio(fixtures: Path) -> None:
    assert b"Access Denied" in (fixtures / "itau" / "bdr_resposta.html").read_bytes()
