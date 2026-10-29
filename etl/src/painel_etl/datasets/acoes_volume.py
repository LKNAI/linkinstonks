"""Dataset `acoes_volume`: volume financeiro mensal de cada companhia (soma dos seus tickers de ações).

É o exemplo de escalabilidade da seção 13 do prompt: **nenhuma fonte nova**. Os arquivos COTAHIST que o dataset
`bdrs` já baixa são lidos com outro filtro (`b3_cotahist.ACAO`), as partições ficam em `data/history/acoes_volume/`
e o volume de cada ticker é atribuído à companhia pelo cadastro publicado em `acoes.json`.

O que não se consegue atribuir a uma companhia (ticker fora do cadastro atual, por exemplo de empresa já
deslistada) não é descartado em silêncio: vai para `nao_atribuido`, de modo que a soma das companhias mais o não
atribuído reproduz o total do mercado nos arquivos da B3.
"""

from __future__ import annotations

import datetime as dt
from collections.abc import Mapping, Sequence
from typing import Any

from painel_etl.core import quality
from painel_etl.datasets.bdrs import JANELA_MESES, meses_fechados
from painel_etl.sources import b3_cotahist

__all__ = ["JANELA_MESES", "construir", "csv_cabecalho", "csv_linhas", "fontes_volume", "meses_fechados", "validar"]

LIMITE_NAO_ATRIBUIDO = 0.10  # acima disto, avisa: o cadastro de tickers pode estar defasado


def construir(
    particoes: Mapping[str, Mapping[str, Any]],
    meses: Sequence[str],
    parcial: str | None,
    companhias: Sequence[Mapping[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Devolve (companhias com volume, ordenadas por código CVM; resumo do volume não atribuído)."""
    de_quem = {t["ticker"]: c["codigo_cvm"] for c in companhias for t in c["tickers"]}
    pregao = {c["codigo_cvm"]: c["pregao"] for c in companhias}
    todos = [*meses, *([parcial] if parcial else [])]
    por_cia: dict[str, dict[str, Any]] = {}
    sem_dono = {"tickers": set(), "mensal": dict.fromkeys(meses, 0)}  # type: dict[str, Any]
    for m in todos:
        for ticker, v in (particoes[m]["tickers"] if m in particoes else {}).items():
            cvm = de_quem.get(ticker)
            if cvm is None:
                if m in sem_dono["mensal"]:
                    sem_dono["mensal"][m] += v["volume"]
                    sem_dono["tickers"].add(ticker)
                continue
            c = por_cia.setdefault(cvm, {"tickers": set(), "mensal": dict.fromkeys(todos, 0), "negocios": 0})
            c["mensal"][m] += v["volume"]
            if m in meses:
                c["negocios"] += v["negocios"]
            if v["volume"]:
                c["tickers"].add(ticker)
    saida = []
    for cvm in sorted(por_cia):
        c = por_cia[cvm]
        mensal = [c["mensal"][m] for m in meses]
        if not any(mensal) and not (parcial and c["mensal"][parcial]):
            continue
        saida.append(
            {
                "codigo_cvm": cvm,
                "negocios_24m": c["negocios"],
                "pregao": pregao[cvm],
                "tickers": sorted(c["tickers"]),
                "volume_24m": sum(mensal),
                "volume_mensal": mensal,
                "volume_mes_parcial": c["mensal"][parcial] if parcial else None,
            }
        )
    nao = {"tickers": len(sem_dono["tickers"]), "volume_mensal": [sem_dono["mensal"][m] for m in meses]}
    return saida, nao


def fontes_volume(
    particoes: Mapping[str, Mapping[str, Any]], meses: Sequence[str], parcial: str | None
) -> dict[str, dict[str, Any]]:
    """Mês -> arquivos oficiais da B3 que sustentam o volume (o mesmo critério de rastreabilidade dos BDRs)."""
    return {m: b3_cotahist.fonte_do_mes(m, dict(particoes[m])) for m in [*meses, *([parcial] if parcial else [])]}


def validar(
    cias: Sequence[Mapping[str, Any]], nao_atribuido: Mapping[str, Any], anterior: int | None, hoje: dt.date
) -> quality.Relatorio:
    rel = quality.Relatorio("acoes_volume")
    quality.checar_queda(rel, len(cias), anterior, 0.10)
    quality.checar_obrigatorios(rel, cias, ["codigo_cvm", "pregao"], "codigo_cvm")
    quality.checar_unicos(rel, (c["codigo_cvm"] for c in cias), "codigo_cvm")
    quality.checar_nao_negativos(rel, ((c["codigo_cvm"], min(c["volume_mensal"], default=0)) for c in cias), "volume")
    total = sum(c["volume_24m"] for c in cias)
    perdido = sum(nao_atribuido["volume_mensal"])
    if total + perdido and perdido / (total + perdido) > LIMITE_NAO_ATRIBUIDO:
        rel.aviso(
            "volume_sem_companhia",
            f"{perdido / (total + perdido):.1%} do volume em 24 meses não casa com nenhuma companhia do cadastro "
            f"({nao_atribuido['tickers']} tickers)",
        )
    return rel


def csv_cabecalho(meses: Sequence[str]) -> list[str]:
    return ["codigo_cvm", "pregao", "tickers", "negocios_24m", "volume_24m_rs_mil", *[f"vol_{m}_rs_mil" for m in meses]]


def csv_linhas(cias: Sequence[Mapping[str, Any]]) -> list[list[Any]]:
    return [
        [
            c["codigo_cvm"], c["pregao"], " ".join(c["tickers"]), c["negocios_24m"], round(c["volume_24m"] / 1000),
            *[round(v / 1000) for v in c["volume_mensal"]],
        ]
        for c in cias
    ]  # fmt: skip
