"""Dataset `acoes`: companhias com ações listadas na B3 + escriturador (B3) + histórico (CVM/FCA).

Entradas: lista e detalhes da B3, histórico FCA (`data/history/fca`), cadastro CVM, registro de instituições.
Saída: `acoes.json`, `acoes_historico_escrituradores.json` e `downloads/acoes.csv` (seção 10 do prompt).
"""

from __future__ import annotations

import datetime as dt
import re
from collections.abc import Mapping, Sequence
from typing import Any

import yaml

from painel_etl import paths
from painel_etl.core import quality
from painel_etl.datasets.escrituradores import Historico, derivar
from painel_etl.normalize import cnpj as cnpj_mod
from painel_etl.normalize.instituicoes import Registro
from painel_etl.normalize.tickers import ticker_class
from painel_etl.sources.b3_listed import CompanyDetail, ListedCompany
from painel_etl.sources.cvm_fca import FcaRow

SCHEMA_VERSION = 1
TIPO_ACOES = "1"
ROTACAO_DIAS = 7
SEGMENTO_SEM_DADOS = "?"
NOME_NAO_INFORMADO = "Não informado"
CSV_COLUNAS = [
    "pregao", "razao_social", "codigo_emissor", "cnpj", "codigo_cvm", "segmento", "setor", "escriturador_b3",
    "escriturador_cvm", "escriturador_desde", "escriturador_anterior", "anterior_inicio", "anterior_fim",
    "trocas_registradas", "tickers",
]  # fmt: skip


def segmento_por_indicador() -> dict[str, str]:
    cfg = yaml.safe_load((paths.config_dir() / "sources.yaml").read_text(encoding="utf-8"))
    return {str(k): v for k, v in cfg["sources"]["b3_listed"]["segmento_por_marketIndicator"].items()}


def _chave_ticker(t: str) -> tuple[str, int, str]:
    m = re.match(r"^([A-Z0-9]{4})(\d+)(.*)$", t)
    return (m.group(1), int(m.group(2)), m.group(3)) if m else (t, 0, "")


def tickers_de(detalhe: CompanyDetail | None) -> list[dict[str, str]]:
    """Tickers de ações. Códigos com hífen (`PETR-DEB62`) são debêntures e ficam de fora."""
    codigos = {c.code for c in (detalhe.other_codes or []) if "-" not in c.code} if detalhe else set()
    return [{"ticker": t, "classe": ticker_class(t)} for t in sorted(codigos, key=_chave_ticker)]


def codigos_para_detalhe(
    listadas: Sequence[ListedCompany], previo: Mapping[str, Mapping[str, Any]], hoje: dt.date, dias: int = ROTACAO_DIAS
) -> list[str]:
    """Novas ou alteradas na lista, mais o rodízio de 1/N (todas são revisitadas a cada `dias` dias)."""
    escolhidos = []
    for c in listadas:
        p = previo.get(c.codigo_cvm)
        mudou = p is None or (
            p["pregao"], p["razao_social"], p["emissor"], p["setor"], p.get("indicador_mercado"),
        ) != (c.pregao, c.razao_social, c.emissor, c.setor, c.market_indicator)  # fmt: skip
        if mudou or int(c.codigo_cvm) % dias == hoje.toordinal() % dias:
            escolhidos.append(c.codigo_cvm)
    return escolhidos


def _b3(c: ListedCompany, detalhe: CompanyDetail | None, reg: Registro, seg_map: Mapping[str, str]) -> dict[str, Any]:
    razao = " ".join(c.razao_social.split())

    def entidade(bruto: str) -> str | None:
        if not bruto:
            return None
        res = reg.resolver(bruto, empresa_nome=razao)
        return reg.nome_curto(res.id, bruto.title())

    on_bruto = detalhe.institution_common if detalhe else ""
    pn_bruto = detalhe.institution_preferred if detalhe else ""
    return {
        "segmento": seg_map.get(c.market_indicator, SEGMENTO_SEM_DADOS) if detalhe else SEGMENTO_SEM_DADOS,
        "tickers": tickers_de(detalhe),
        "escriturador_b3": {
            "on": entidade(on_bruto),
            "pn": entidade(pn_bruto),
            "bruto_on": on_bruto,
            "bruto_pn": pn_bruto,
        },
        "detalhe_b3": detalhe is not None,
    }


def _cvm(h: Historico | None) -> dict[str, Any] | None:
    if h is None:
        return None
    a = h.anterior
    return {
        "atual": h.atual.nome,
        "inicio": h.inicio,
        "inicio_aproximado": h.inicio_aproximado,
        "anterior": a.nome if a else None,
        "anterior_inicio": (a.inicio_primeiro or None) if a else None,
        "anterior_fim": (a.fim or None) if a else None,
        "anterior_ultimo_ano": a.ultimo_ano if a else None,
        "n_escrituradores": h.n,
    }


def principal_b3(b3: Mapping[str, Any]) -> str:
    """Escriturador que a B3 informa para a companhia: ON, senão PN, senão "Não informado"."""
    return b3["on"] or b3["pn"] or NOME_NAO_INFORMADO


def construir(
    listadas: Sequence[ListedCompany],
    detalhes: Mapping[str, CompanyDetail | None],
    fca: Mapping[str, list[FcaRow]],
    cad: Mapping[str, Mapping[str, str]],
    reg: Registro,
    previo: Mapping[str, Mapping[str, Any]] | None = None,
) -> tuple[list[dict[str, Any]], dict[str, list[dict[str, Any]]], list[str]]:
    """Devolve (companhias, linha do tempo por companhia, nomes de escriturador não mapeados)."""
    previo = previo or {}
    seg_map = segmento_por_indicador()
    companhias, historico, nao_mapeados = [], {}, set()
    for c in sorted((x for x in listadas if x.tipo == TIPO_ACOES), key=lambda x: (x.pregao, x.codigo_cvm)):
        if c.codigo_cvm in detalhes:
            b3 = _b3(c, detalhes[c.codigo_cvm], reg, seg_map)
        elif c.codigo_cvm in previo:  # não revisitada hoje: mantém o que já se sabe da B3
            p = previo[c.codigo_cvm]
            b3 = {k: p[k] for k in ("tickers", "escriturador_b3", "detalhe_b3")}
            b3["segmento"] = (
                seg_map.get(c.market_indicator, SEGMENTO_SEM_DADOS) if p["detalhe_b3"] else SEGMENTO_SEM_DADOS
            )
        else:
            b3 = _b3(c, None, reg, seg_map)
        digitos = cnpj_mod.digits(c.cnpj)
        h = derivar(fca.get(digitos, []), reg)
        if h:
            nao_mapeados |= {p.nome for p in h.passagens if p.nao_mapeado}
        cvm = _cvm(h)
        principal = principal_b3(b3["escriturador_b3"])
        companhias.append(
            {
                "codigo_cvm": c.codigo_cvm,
                "pregao": c.pregao,
                "razao_social": " ".join(c.razao_social.split()),
                "emissor": c.emissor,
                "cnpj": cnpj_mod.format_cnpj(c.cnpj),
                "setor": c.setor,
                "indicador_mercado": c.market_indicator,
                **b3,
                "escriturador_cvm": cvm,
                "divergente_b3_cvm": bool(cvm and cvm["atual"] != principal),
                "situacao_cvm": cad.get(digitos, {}).get("situacao"),
            }
        )
        if h:
            historico[c.codigo_cvm] = [
                {
                    "instituicao": p.nome,
                    "inicio": (h.inicio if p.chave == h.atual.chave else p.inicio_primeiro) or None,
                    "inicio_aproximado": h.inicio_aproximado if p.chave == h.atual.chave else not p.inicio_primeiro,
                    "fim": p.fim or None,
                    "primeiro_ano": p.primeiro_ano,
                    "ultimo_ano": p.ultimo_ano,
                    "fonte": "CVM FCA",
                }
                for p in h.passagens
            ]
    return companhias, historico, sorted(nao_mapeados)


def validar(
    companhias: Sequence[Mapping[str, Any]], anterior: int | None, hoje: dt.date, *, limite_queda: float = 0.10
) -> quality.Relatorio:
    rel = quality.Relatorio("acoes")
    quality.checar_queda(rel, len(companhias), anterior, limite_queda)
    quality.checar_obrigatorios(
        rel, companhias, ["codigo_cvm", "pregao", "razao_social", "cnpj", "emissor"], "codigo_cvm"
    )
    quality.checar_unicos(rel, (c["codigo_cvm"] for c in companhias), "codigo_cvm")
    quality.checar_unicos(rel, (t["ticker"] for c in companhias for t in c["tickers"]), "ticker")
    quality.checar_cnpjs(rel, companhias, "cnpj", "codigo_cvm", tolerancia=5)
    datas = [{"id": c["codigo_cvm"], "inicio": (c["escriturador_cvm"] or {}).get("inicio")} for c in companhias]
    quality.checar_datas(rel, datas, ["inicio"], "id", hoje)
    return rel


def csv_linhas(companhias: Sequence[Mapping[str, Any]]) -> list[list[Any]]:
    linhas = []
    for c in companhias:
        v = c["escriturador_cvm"] or {}
        linhas.append(
            [
                c["pregao"], c["razao_social"], c["emissor"], c["cnpj"], c["codigo_cvm"], c["segmento"], c["setor"],
                principal_b3(c["escriturador_b3"]), v.get("atual"), v.get("inicio"), v.get("anterior"),
                v.get("anterior_inicio"), v.get("anterior_fim"), v.get("n_escrituradores"),
                " ".join(t["ticker"] for t in c["tickers"]),
            ]
        )  # fmt: skip
    return linhas
