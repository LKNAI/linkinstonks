"""Diff entre a publicação anterior e a nova => eventos (`data/events/AAAA.jsonl`, append-only)."""

from __future__ import annotations

import datetime as dt
from collections.abc import Mapping, Sequence
from typing import Any

Evento = dict[str, Any]

TIPOS = (
    "nova_listagem", "deslistagem", "troca_escriturador", "divergencia_b3_cvm", "ticker_novo", "ticker_removido",
    "mudanca_segmento", "novo_bdr", "bdr_cancelado", "troca_depositaria",
)  # fmt: skip


def _ev(
    hoje: dt.date, dataset: str, tipo: str, chave: str, de: Any = None, para: Any = None, fonte: str = ""
) -> Evento:
    return {
        "chave": chave,
        "data": hoje.isoformat(),
        "dataset": dataset,
        "de": de,
        "fonte": fonte,
        "para": para,
        "tipo": tipo,
    }


def diff_acoes(
    antes: Mapping[str, Mapping[str, Any]], depois: Mapping[str, Mapping[str, Any]], hoje: dt.date
) -> list[Evento]:
    """`antes`/`depois`: companhias indexadas por `codigo_cvm`. Sem publicação anterior, não há eventos."""
    if not antes:
        return []
    eventos: list[Evento] = []
    for k in sorted(depois.keys() - antes.keys()):
        eventos.append(_ev(hoje, "acoes", "nova_listagem", k, None, depois[k]["pregao"], "B3"))
    for k in sorted(antes.keys() - depois.keys()):
        eventos.append(_ev(hoje, "acoes", "deslistagem", k, antes[k]["pregao"], None, "B3"))
    for k in sorted(depois.keys() & antes.keys()):
        a, d = antes[k], depois[k]
        ca, cd = (a.get("escriturador_cvm") or {}).get("atual"), (d.get("escriturador_cvm") or {}).get("atual")
        if ca != cd and ca and cd:
            eventos.append(_ev(hoje, "acoes", "troca_escriturador", k, ca, cd, "CVM"))
        ba, bd = a["escriturador_b3"], d["escriturador_b3"]
        pa, pd = ba["on"] or ba["pn"], bd["on"] or bd["pn"]
        if pa != pd and pa and pd:
            eventos.append(_ev(hoje, "acoes", "troca_escriturador", k, pa, pd, "B3"))
        if d["divergente_b3_cvm"] and not a["divergente_b3_cvm"]:
            eventos.append(_ev(hoje, "acoes", "divergencia_b3_cvm", k, pd, cd, "B3/CVM"))
        ta, td = {t["ticker"] for t in a["tickers"]}, {t["ticker"] for t in d["tickers"]}
        eventos += [_ev(hoje, "acoes", "ticker_novo", k, None, t, "B3") for t in sorted(td - ta)]
        eventos += [_ev(hoje, "acoes", "ticker_removido", k, t, None, "B3") for t in sorted(ta - td)]
        if a["segmento"] != d["segmento"] and a["detalhe_b3"] and d["detalhe_b3"]:
            eventos.append(_ev(hoje, "acoes", "mudanca_segmento", k, a["segmento"], d["segmento"], "B3"))
    return eventos


def diff_bdrs(
    antes: Mapping[str, Mapping[str, Any]], depois: Mapping[str, Mapping[str, Any]], hoje: dt.date
) -> list[Evento]:
    """`antes`/`depois`: BDRs indexados por ticker."""
    if not antes:
        return []
    eventos = [
        _ev(hoje, "bdrs", "novo_bdr", t, None, depois[t]["nome"], "B3") for t in sorted(depois.keys() - antes.keys())
    ]
    for t in sorted(depois.keys() & antes.keys()):
        da, dd = antes[t]["depositaria"], depois[t]["depositaria"]
        if da != dd and da != "Não identificado":
            eventos.append(_ev(hoje, "bdrs", "troca_depositaria", t, da, dd, depois[t]["fonte_depositaria"]))
    return eventos


def ultimos(eventos: Sequence[Evento], n: int = 500) -> list[Evento]:
    """Os `n` mais recentes, do mais novo para o mais antigo (ordem estável)."""
    ordenados = sorted(eventos, key=lambda e: (e["data"], e["dataset"], e["tipo"], e["chave"]), reverse=True)
    return ordenados[:n]
