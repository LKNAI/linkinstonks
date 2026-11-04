"""Versão compacta dos snapshots para o site (item 8.6). Critérios e limites: ADR 0011.

Um mês é "real" quando há `data/history/snapshots/AAAA-MM/`. Os demais são reconstituídos e sempre marcados:
ações pelo histórico de escrituradores da CVM; BDRs pelo volume do COTAHIST, com depositária e tipo do primeiro snapshot.
"""

from __future__ import annotations

import calendar
import re
from collections.abc import Mapping, Sequence
from typing import Any

RX_TICKER = re.compile(r"[A-Z0-9]+")


def compactar(doc: Mapping[str, Any], lista: str) -> dict[str, Any]:
    """Grava `lista` como colunas + linhas, sem repetir os nomes dos campos: o site expande na leitura (orçamento)."""
    registros = doc[lista]
    colunas = sorted(registros[0]) if registros else []
    return {
        **{k: v for k, v in doc.items() if k != lista},
        "colunas": colunas,
        "linhas": [[r[c] for c in colunas] for r in registros],
    }


def fim_do_mes(mes: str) -> str:
    ano, m = int(mes[:4]), int(mes[5:7])
    return f"{mes}-{calendar.monthrange(ano, m)[1]:02d}"


def acoes_real(
    linhas: Sequence[Mapping[str, str]], atuais: Sequence[Mapping[str, Any]], mes: str, coletado_em: str, versao: str
) -> dict[str, Any]:
    """Do `acoes.csv.gz` do snapshot. Classe do ticker e `inicio_aproximado` não estão no CSV: vêm do cadastro atual."""
    classes = {t["ticker"]: t["classe"] for c in atuais for t in c["tickers"]}
    aprox = {c["codigo_cvm"]: bool((c["escriturador_cvm"] or {}).get("inicio_aproximado")) for c in atuais}
    companhias = []
    for x in linhas:
        cvm = x["escriturador_cvm"] or None
        companhias.append(
            {
                "cnpj": x["cnpj"],
                "codigo_cvm": x["codigo_cvm"],
                "emissor": x["codigo_emissor"],
                "escriturador": x["escriturador_b3"] or None,
                "escriturador_cvm": (
                    {
                        "anterior": x["escriturador_anterior"] or None,
                        "anterior_fim": x["anterior_fim"] or None,
                        "anterior_inicio": x["anterior_inicio"] or None,
                        "atual": cvm,
                        "inicio": x["escriturador_desde"],
                        "inicio_aproximado": aprox.get(x["codigo_cvm"], False),
                    }
                    if cvm
                    else None
                ),
                "pregao": x["pregao"],
                "razao_social": x["razao_social"],
                "segmento": x["segmento"],
                "setor": x["setor"],
                "tickers": [{"classe": classes.get(t, "Outros"), "ticker": t} for t in RX_TICKER.findall(x["tickers"])],
            }
        )
    return {
        "coletado_em": coletado_em,
        "companhias": companhias,
        "mes": mes,
        "reconstituido": False,
        "schema_version": versao,
    }


def _passagem_em(passagens: Sequence[Mapping[str, Any]], dia: str) -> Mapping[str, Any] | None:
    vigentes = [p for p in passagens if p["inicio"] and p["inicio"] <= dia and (not p["fim"] or p["fim"] >= dia)]
    return max(vigentes, key=lambda p: p["inicio"]) if vigentes else None


def acoes_reconstituido(
    atuais: Sequence[Mapping[str, Any]], historico: Mapping[str, Sequence[Mapping[str, Any]]], mes: str, versao: str
) -> dict[str, Any]:
    """Só companhias do cadastro atual com escriturador conhecido na data: quem saiu da bolsa antes de hoje não aparece."""
    dia = fim_do_mes(mes)
    companhias = []
    for c in atuais:
        passagens = historico.get(c["codigo_cvm"], [])
        p = _passagem_em(passagens, dia)
        desde = (c.get("listagem") or {}).get("desde")
        if p is None or (desde and desde > dia):
            continue
        anteriores = [q for q in passagens if q["inicio"] and q["inicio"] < p["inicio"]]
        ant = max(anteriores, key=lambda q: q["inicio"]) if anteriores else None
        companhias.append(
            {
                "cnpj": c["cnpj"],
                "codigo_cvm": c["codigo_cvm"],
                "emissor": c["emissor"],
                "escriturador": p["instituicao"],
                "escriturador_cvm": {
                    "anterior": ant["instituicao"] if ant else None,
                    "anterior_fim": ant["fim"] if ant else None,
                    "anterior_inicio": ant["inicio"] if ant else None,
                    "atual": p["instituicao"],
                    "inicio": p["inicio"],
                    "inicio_aproximado": p["inicio_aproximado"],
                },
                "pregao": c["pregao"],
                "razao_social": c["razao_social"],
                "segmento": c["segmento"],
                "setor": c["setor"],
                "tickers": [{"classe": t["classe"], "ticker": t["ticker"]} for t in c["tickers"]],
            }
        )
    return {"coletado_em": None, "companhias": companhias, "mes": mes, "reconstituido": True, "schema_version": versao}


def bdrs_do_mes(
    particoes: Mapping[str, Mapping[str, Any]],
    meses: Sequence[str],
    cadastro: Sequence[Mapping[str, str]],
    mes: str,
    reconstituido: bool,
    coletado_em: str | None,
    versao: str,
) -> dict[str, Any]:
    """Volume sempre das partições; `cadastro` é a lista de BDRs do snapshot (do próprio mês, se real, ou do primeiro)."""
    por_ticker = {b["ticker"]: b for b in cadastro}
    bdrs = []
    for tk in sorted({t for m in meses for t in particoes[m]["tickers"]}):
        serie = [particoes[m]["tickers"].get(tk) for m in meses]
        volumes = [s["volume"] if s else 0 for s in serie]
        presentes = [s for s in serie if s]
        ultimo = presentes[-1]
        cad = por_ticker.get(tk, {})
        bdrs.append(
            {
                "categoria": cad.get("categoria", ""),
                "depositaria": cad.get("depositaria", "Não identificado"),
                "fonte_depositaria": cad.get("fonte_depositaria", ""),
                "isin": ultimo.get("isin", ""),
                "negocios_24m": sum(s["negocios"] for s in presentes),
                "nome": cad.get("nome") or ultimo.get("nome", tk),
                "primeiro_pregao": presentes[0].get("primeiro_pregao"),
                "qualificado": cad.get("qualificado") == "1",
                "ticker": tk,
                "tipo": cad.get("tipo") or ultimo.get("tipo") or "DRN",
                "ultimo_pregao": ultimo.get("ultimo_pregao", ""),
                "ultimo_preco": ultimo.get("ultimo_preco", 0),
                "volume_24m": sum(volumes),
                "volume_mensal": volumes,
            }
        )
    return {
        "bdrs": bdrs,
        "coletado_em": coletado_em,
        "mes": mes,
        "meses": list(meses),
        "reconstituido": reconstituido,
        "schema_version": versao,
    }
