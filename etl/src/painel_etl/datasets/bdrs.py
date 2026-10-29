"""Dataset `bdrs`: BDRs negociados na B3, depositária (e a fonte que a identificou) e volume mensal.

Universo = tickers que negociaram nos últimos 24 meses fechados (ou no mês corrente), vindos do COTAHIST.
Depositária, em ordem de prioridade (seção 7.5, ajustada na Fase 0):

1. API B3 (`GetDetail.institutionPreferred`): patrocinados E ETFs;
2. Banco B3 (finservices): listas de programas DRN e ETF;
3. `config/overrides/depositarias.csv`: curadoria manual (Bradesco, Itaú e nomes), sempre com fonte e data;
4. "Não identificado".
"""

from __future__ import annotations

import csv
import datetime as dt
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from painel_etl import paths
from painel_etl.core import quality
from painel_etl.normalize.instituicoes import NAO_IDENTIFICADO, NAO_MAPEADO, Registro
from painel_etl.sources.b3_finservices import Programa
from painel_etl.sources.b3_listed import EtfRow

JANELA_MESES = 24
FONTE_API = "API B3 (GetDetail)"
FONTE_FINSERVICES = "Banco B3 (finservices)"


def meses_fechados(hoje: dt.date, n: int = JANELA_MESES) -> list[str]:
    """Os `n` meses anteriores ao mês de `hoje`, em ordem cronológica."""
    saida, a, m = [], hoje.year, hoje.month
    for _ in range(n):
        m -= 1
        if m == 0:
            a, m = a - 1, 12
        saida.append(f"{a}-{m:02d}")
    return saida[::-1]


def ler_overrides(caminho: Path | None = None) -> dict[str, dict[str, str]]:
    caminho = caminho or paths.config_dir() / "overrides" / "depositarias.csv"
    if not caminho.exists():
        return {}
    with caminho.open(encoding="utf-8-sig", newline="") as f:
        return {r["ticker"]: r for r in csv.DictReader(f, delimiter=";")}


def _depositaria(
    ticker: str,
    deps_api: Mapping[str, str],
    fin: Mapping[str, Programa],
    overrides: Mapping[str, Mapping[str, str]],
    reg: Registro,
    nao_mapeados: set[str],
) -> tuple[str, str]:
    bruto = deps_api.get(ticker, "")
    if bruto:
        res = reg.resolver(bruto)
        if res.id != NAO_MAPEADO:
            return reg.nome_curto(res.id), FONTE_API
        nao_mapeados.add(bruto)
    if ticker in fin:
        return reg.nome_curto("banco-b3"), FONTE_FINSERVICES
    o = overrides.get(ticker)
    if o and o["depositaria"]:
        return reg.nome_curto(o["depositaria"]), o["fonte"]
    return reg.nome_curto(NAO_IDENTIFICADO), ""


def construir(
    particoes: Mapping[str, Mapping[str, Any]],
    meses: Sequence[str],
    parcial: str | None,
    *,
    etfs: Mapping[str, EtfRow],
    deps_api: Mapping[str, str],
    nomes_api: Mapping[str, str],
    finservices: Mapping[str, Sequence[Programa]],
    overrides: Mapping[str, Mapping[str, str]],
    reg: Registro,
) -> tuple[list[dict[str, Any]], list[str]]:
    """Devolve (BDRs ordenados por ticker, textos de depositária da API que não foram mapeados)."""
    fin = {p.ticker: p for lista in finservices.values() for p in lista}
    todos = [*meses, *([parcial] if parcial else [])]
    tickers = sorted({t for m in todos if m in particoes for t in particoes[m]["tickers"]})
    nao_mapeados: set[str] = set()
    saida = []
    for t in tickers:
        pontos = {m: particoes[m]["tickers"][t] for m in todos if m in particoes and t in particoes[m]["tickers"]}
        ultimo_mes = max(pontos)
        ref = pontos[ultimo_mes]
        janela = [pontos[m] for m in meses if m in pontos]
        dep, fonte = _depositaria(t, deps_api, fin, overrides, reg, nao_mapeados)
        o = overrides.get(t, {})
        nome = o.get("nome") or (fin[t].nome if t in fin else "") or nomes_api.get(t, "").title() or ref["nome"].title()
        saida.append(
            {
                "ticker": t,
                "nome": nome,
                "tipo": ref["tipo"],
                "isin": ref["isin"],
                "depositaria": dep,
                "fonte_depositaria": fonte,
                "categoria": (etfs[t[:4]].categoria if t[:4] in etfs else "") if ref["tipo"] == "DRE" else "",
                "qualificado": bool(t in fin and fin[t].qualificado),
                "primeiro_pregao": min((p["primeiro_pregao"] for p in janela), default=None),
                "ultimo_pregao": max(p["ultimo_pregao"] for p in pontos.values()),
                "ultimo_preco": ref["ultimo_preco"],
                "negocios_24m": sum(p["negocios"] for p in janela),
                "volume_24m": sum(p["volume"] for p in janela),
                "volume_mensal": [pontos[m]["volume"] if m in pontos else 0 for m in meses],
                "volume_mes_parcial": (pontos[parcial]["volume"] if parcial in pontos else 0) if parcial else None,
            }
        )
    return saida, sorted(nao_mapeados)


def validar(
    bdrs: Sequence[Mapping[str, Any]], anterior: int | None, hoje: dt.date, *, limite_queda: float = 0.10
) -> quality.Relatorio:
    rel = quality.Relatorio("bdrs")
    quality.checar_queda(rel, len(bdrs), anterior, limite_queda)
    quality.checar_obrigatorios(rel, bdrs, ["ticker", "nome", "tipo", "isin", "depositaria"], "ticker")
    quality.checar_unicos(rel, (b["ticker"] for b in bdrs), "ticker")
    quality.checar_datas(rel, bdrs, ["primeiro_pregao", "ultimo_pregao"], "ticker", hoje)
    quality.checar_nao_negativos(rel, ((b["ticker"], min(b["volume_mensal"], default=0)) for b in bdrs), "volume")
    sem = [b["ticker"] for b in bdrs if b["depositaria"] == "Não identificado"]
    if sem:
        rel.aviso("sem_depositaria", f"{len(sem)} BDR(s) sem depositária identificada (ver /status): {sem[:8]}")
    return rel


def csv_cabecalho(meses: Sequence[str]) -> list[str]:
    return [
        "ticker", "nome", "tipo", "depositaria", "fonte_depositaria", "categoria", "qualificado", "isin",
        "primeiro_pregao_24m", "ultimo_pregao", "ultimo_preco", "negocios_24m", *[f"vol_{m}_rs_mil" for m in meses],
    ]  # fmt: skip


def csv_linhas(bdrs: Sequence[Mapping[str, Any]]) -> list[list[Any]]:
    return [
        [
            b["ticker"], b["nome"], b["tipo"], b["depositaria"], b["fonte_depositaria"], b["categoria"],
            1 if b["qualificado"] else 0, b["isin"], b["primeiro_pregao"], b["ultimo_pregao"], b["ultimo_preco"],
            b["negocios_24m"], *[round(v / 1000) for v in b["volume_mensal"]],
        ]
        for b in bdrs
    ]  # fmt: skip
