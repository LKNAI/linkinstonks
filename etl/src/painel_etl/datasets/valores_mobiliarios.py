"""Valores mobiliários do FCA (item 8.5): listagem, início de negociação e linha do tempo de segmento.

Entrada: `data/history/fca_valor_mobiliario/AAAA.csv.gz`, com ações e units da maior versão de cada documento, a partir
da referência de 2018 (antes disso não há ticker e o segmento não é confiável; `docs/fase8-etapa0.md`).

A CVM e a B3 nunca são corrigidas uma pela outra: divergência de segmento vira só um selo informativo.
"""

from __future__ import annotations

import csv
import datetime as dt
import re
from collections import Counter
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from painel_etl import paths
from painel_etl.indicadores import FcaValorMobiliario
from painel_etl.sources.cvm_fca import ValorMobiliarioRow

MERCADO_BOLSA = "Bolsa"
FONTE_CVM = "CVM FCA"
FONTE_B3 = "B3"
DATA_B3_NAO_INFORMADA = "9999"
TICKER_RX = re.compile(r"^[A-Z0-9]{4}[0-9]{1,2}[A-Z]?$")


def _ultima_referencia(linhas: Sequence[ValorMobiliarioRow]) -> list[ValorMobiliarioRow]:
    if not linhas:
        return []
    ref = max(x.referencia for x in linhas)
    return [x for x in linhas if x.referencia == ref]


def _data_b3(texto: str) -> str | None:
    """`dd/mm/aaaa` da lista da B3 em ISO. A B3 usa 31/12/9999 quando não informa."""
    partes = texto.split("/")
    if len(partes) != 3 or partes[2] == DATA_B3_NAO_INFORMADA:
        return None
    return f"{partes[2]}-{partes[1]}-{partes[0]}"


def _segmento_da_referencia(linhas: Sequence[ValorMobiliarioRow]) -> str | None:
    """Segmento numa referência: o mais frequente entre as ações ativas em bolsa; empate, em ordem alfabética.

    Só conta linha com ticker: em 2018 as linhas sem ticker ainda trazem os rótulos antigos, deslocados (Etapa 8.0).
    """
    contagem = Counter(
        x.segmento
        for x in linhas
        if x.mercado == MERCADO_BOLSA and x.ativo and x.segmento and TICKER_RX.match(x.ticker)
    )
    if not contagem:
        return None
    return sorted(contagem.items(), key=lambda kv: (-kv[1], kv[0]))[0][0]


def linha_do_tempo(linhas: Sequence[ValorMobiliarioRow]) -> list[dict[str, Any]]:
    """Mudanças de segmento da companhia. A data é a da primeira referência em que o segmento aparece, sempre aproximada."""
    saida: list[dict[str, Any]] = []
    for ref in sorted({x.referencia for x in linhas}):
        segmento = _segmento_da_referencia([x for x in linhas if x.referencia == ref])
        if segmento and (not saida or saida[-1]["segmento"] != segmento):
            saida.append({"data_aproximada": True, "desde": ref, "fonte": FONTE_CVM, "segmento": segmento})
    return saida


def negociacao_desde(linhas: Sequence[ValorMobiliarioRow]) -> dict[str, str]:
    """Ticker -> início de negociação na referência mais recente, preferindo a linha sem data de fim."""
    saida: dict[str, str] = {}
    for x in sorted(_ultima_referencia(linhas), key=lambda x: (x.ativo, x.inicio_negociacao)):
        if x.ticker and x.inicio_negociacao:
            saida[x.ticker] = x.inicio_negociacao
    return saida


def listagem(
    linhas: Sequence[ValorMobiliarioRow], segmento_b3: str, data_b3: str, cfg: FcaValorMobiliario
) -> dict[str, Any] | None:
    """Bloco `listagem` de `acoes.json`. O FCA tem prioridade; a data da B3 só preenche quando o FCA não informa."""
    atuais = _ultima_referencia(linhas)
    ativas = [x for x in atuais if x.ativo]
    datas = sorted(x.inicio_listagem for x in ativas if x.inicio_listagem)
    desde, fonte = (datas[0], FONTE_CVM) if datas else (_data_b3(data_b3), FONTE_B3)
    segmento = _segmento_da_referencia(atuais)
    mercados = sorted({x.mercado for x in ativas if x.mercado})
    mercado = MERCADO_BOLSA if MERCADO_BOLSA in mercados else (mercados[0] if mercados else None)
    if desde is None and segmento is None and mercado is None:
        return None
    equivalente = cfg.segmento_cvm_para_b3.get(segmento or "")
    return {
        "desde": desde,
        "desde_incerto": fonte == FONTE_B3 or desde in cfg.datas_listagem_incertas,
        "fonte_desde": fonte if desde else None,
        "mercado": mercado,
        "segmento_cvm": segmento,
        # Só compara o que tem equivalente nos dois lados: `?`, `SO` e `BN` não existem no FCA.
        "segmento_divergente": bool(equivalente and segmento_b3 in cfg.segmento_cvm_para_b3.values())
        and equivalente != segmento_b3,
    }


def listada_ha_menos_de(desde: str | None, meses: int, hoje: dt.date) -> bool:
    if not desde:
        return False
    a, m = hoje.year, hoje.month - meses
    while m <= 0:
        a, m = a - 1, m + 12
    limite = hoje.replace(year=a, month=m, day=min(hoje.day, 28))
    return dt.date.fromisoformat(desde) > limite


def ler_overrides_tickers(caminho: Path | None = None) -> dict[str, str]:
    """Curadoria manual, sempre com fonte: `config/overrides/tickers_historicos.csv`."""
    caminho = caminho or paths.config_dir() / "overrides" / "tickers_historicos.csv"
    if not caminho.exists():
        return {}
    with caminho.open(encoding="utf-8-sig", newline="") as f:
        return {r["ticker"]: r["codigo_cvm"] for r in csv.DictReader(f, delimiter=";")}


def tickers_historicos(
    por_cnpj: Mapping[str, Sequence[ValorMobiliarioRow]],
    companhia_por_cnpj: Mapping[str, str],
    atuais: set[str],
    overrides: Mapping[str, str] | None = None,
) -> tuple[dict[str, str], list[str]]:
    """Ticker antigo -> código CVM, pelo FCA. Devolve também os que apontam para mais de uma companhia, sem atribuí-los."""
    candidatos: dict[str, set[str]] = {}
    for cnpj, linhas in por_cnpj.items():
        cvm = companhia_por_cnpj.get(cnpj)
        if cvm is None:
            continue
        for x in linhas:
            if TICKER_RX.match(x.ticker) and x.ticker not in atuais:
                candidatos.setdefault(x.ticker, set()).add(cvm)
    mapa = {t: next(iter(c)) for t, c in candidatos.items() if len(c) == 1}
    ambiguos = sorted(t for t, c in candidatos.items() if len(c) > 1)
    for t, cvm in (overrides or {}).items():
        if t not in atuais:
            mapa[t] = cvm
    return dict(sorted(mapa.items())), [t for t in ambiguos if t not in (overrides or {})]
