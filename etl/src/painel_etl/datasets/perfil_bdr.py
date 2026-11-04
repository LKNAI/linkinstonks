"""Faixa de ticket médio dos BDRs (item 8.3). Descreve o tamanho dos negócios; não identifica investidores.

BDRs não têm mercado fracionário (ADR 0005), então o indicador usa só o ticket médio: por mês, as faixas vêm dos quartis
entre os BDRs com negócios suficientes. Definição em `docs/metodologia.md`; parâmetros em `config/indicadores.yaml`.
"""

from __future__ import annotations

import statistics
from collections.abc import Mapping, Sequence
from typing import Any

from painel_etl.indicadores import PerfilBdr

BAIXO = "ticket_baixo"
INTERMEDIARIO = "intermediario"
ALTO = "ticket_alto"
INSUFICIENTE = "dados_insuficientes"
FAIXAS = (BAIXO, INTERMEDIARIO, ALTO, INSUFICIENTE)
MINIMO_PARA_QUARTIS = 4
CASAS = 2


def quartis_do_mes(pontos: Mapping[str, Mapping[str, Any]], cfg: PerfilBdr) -> dict[str, Any] | None:
    """1º e 3º quartis do ticket médio entre os BDRs com pelo menos `min_negocios_mes` negócios no mês."""
    tickets = [v["volume"] / v["negocios"] for v in pontos.values() if v["negocios"] >= cfg.min_negocios_mes]
    if len(tickets) < MINIMO_PARA_QUARTIS:
        return None
    q1, _, q3 = statistics.quantiles(tickets, n=4, method="inclusive")
    return {"bdrs": len(tickets), "q1": round(q1, CASAS), "q3": round(q3, CASAS)}


def faixa(volume: int, negocios: int, quartis: Mapping[str, Any] | None, cfg: PerfilBdr) -> str:
    if quartis is None or negocios < cfg.min_negocios_mes:
        return INSUFICIENTE
    ticket = round(volume / negocios, CASAS)
    if ticket <= quartis["q1"]:
        return BAIXO
    return ALTO if ticket > quartis["q3"] else INTERMEDIARIO


def perfil(
    volumes: Sequence[int],
    negocios: Sequence[int],
    meses: Sequence[str],
    quartis: Mapping[str, Mapping[str, Any] | None],
    cfg: PerfilBdr,
) -> dict[str, Any]:
    """Resumo da janela: a faixa do último mês fechado e o ticket médio do período."""
    j = cfg.janela_resumo_meses
    volume_total, negocios_total = sum(volumes[-j:]), sum(negocios[-j:])
    return {
        "faixa": faixa(volumes[-1], negocios[-1], quartis.get(meses[-1]), cfg) if meses else INSUFICIENTE,
        "negocios_janela": negocios_total,
        "ticket_medio_janela": round(volume_total / negocios_total, CASAS) if negocios_total else None,
    }
