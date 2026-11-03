"""Dataset `acoes_liquidez` (itens 8.1 e 8.2): liquidez por ticker e por companhia e categorias de negociação.

Sem fonte nova: os mesmos arquivos COTAHIST dos BDRs, lidos numa só passada. Definições e fórmulas estão em
`docs/metodologia.md`; os limiares, em `config/indicadores.yaml`.

Ausência de registro no COTAHIST significa ausência de negócio: nos 25 meses verificados não há nenhum registro com
`TOTNEG` zero. A linguagem é factual: o critério descreve o dado, sem julgar a ação.
"""

from __future__ import annotations

import datetime as dt
from collections.abc import Mapping, Sequence
from typing import Any

from painel_etl.core import quality
from painel_etl.datasets.valores_mobiliarios import listada_ha_menos_de
from painel_etl.indicadores import Liquidez

METRICAS = (
    "dias_com_negocio", "negocios", "presenca", "quantidade", "ticket_medio", "volume", "volume_fracionario",
    "volume_medio_diario",
)  # fmt: skip
CATEGORIAS = (
    "sem_ticker", "listagem_recente", "sem_cotacao_no_periodo", "sem_negocios", "presenca_baixa", "presenca_media",
    "presenca_alta",
)  # fmt: skip
CASAS_PRESENCA = 4
CASAS_TICKET = 2
LIMITE_NAO_ATRIBUIDO = 0.10


def _razao(a: float, b: float, casas: int) -> float | None:
    return round(a / b, casas) if b else None


def _data_br(iso: str) -> str:
    return f"{iso[8:10]}/{iso[5:7]}/{iso[:4]}"


def pregoes_por_mes(particoes: Mapping[str, Mapping[str, Any]], meses: Sequence[str]) -> list[int]:
    return [len(particoes[m]["pregoes"]) for m in meses]


def _ponto(v: Mapping[str, Any] | None, pregoes: int) -> dict[str, Any]:
    """Métricas de um ticker num mês. Sem registro, tudo zero e razões nulas (ticket só quando houve negócio)."""
    v = v or {}
    volume, negocios, dias = v.get("volume", 0), v.get("negocios", 0), v.get("dias_com_negocio", 0)
    return {
        "dias_com_negocio": dias,
        "negocios": negocios,
        "presenca": _razao(dias, pregoes, CASAS_PRESENCA),
        "quantidade": v.get("quantidade", 0),
        "ticket_medio": _razao(volume, negocios, CASAS_TICKET),
        "volume": volume,
        "volume_fracionario": v.get("volume_fracionario", 0),
        "volume_medio_diario": round(volume / pregoes) if pregoes else 0,
    }


def _serie(pontos: Sequence[Mapping[str, Any]]) -> dict[str, list[Any]]:
    return {m: [p[m] for p in pontos] for m in METRICAS}


def _agregado(pontos: Sequence[Mapping[str, Any]], pregoes: Sequence[int]) -> dict[str, Any]:
    """Soma de uma janela. A presença é a soma dos dias sobre a soma dos pregões, não a média das razões mensais."""
    dias, total = sum(p["dias_com_negocio"] for p in pontos), sum(pregoes)
    volume, negocios = sum(p["volume"] for p in pontos), sum(p["negocios"] for p in pontos)
    return {
        "dias_com_negocio": dias,
        "negocios": negocios,
        "pregoes": total,
        "presenca": _razao(dias, total, CASAS_PRESENCA),
        "quantidade": sum(p["quantidade"] for p in pontos),
        "ticket_medio": _razao(volume, negocios, CASAS_TICKET),
        "volume": volume,
        "volume_fracionario": sum(p["volume_fracionario"] for p in pontos),
        "volume_medio_diario": round(volume / total) if total else 0,
    }


def _agregados(
    pontos: Sequence[Mapping[str, Any]], pregoes: Sequence[int], janelas: Sequence[int]
) -> dict[str, dict[str, Any]]:
    return {f"{j}m": _agregado(pontos[-j:], pregoes[-j:]) for j in janelas}


def _pontos_companhia(
    tickers: Sequence[str], particoes: Mapping[str, Mapping[str, Any]], meses: Sequence[str]
) -> tuple[list[dict[str, Any]], list[str | None]]:
    """Soma os tickers em cada mês; os dias e a presença são os do ticker mais negociado naquele mês."""
    pontos, principais = [], []
    for m in meses:
        dados = particoes[m]["tickers"]
        presentes = {t: dados[t] for t in tickers if t in dados}
        pregoes = len(particoes[m]["pregoes"])
        p = _ponto(None, pregoes)
        topo = None
        if presentes:
            topo = sorted(presentes, key=lambda t: (-presentes[t]["volume"], t))[0]
            somas = {
                campo: sum(v.get(campo, 0) for v in presentes.values())
                for campo in ("negocios", "quantidade", "volume", "volume_fracionario")
            }
            p = _ponto({**somas, "dias_com_negocio": presentes[topo].get("dias_com_negocio", 0)}, pregoes)
        pontos.append(p)
        principais.append(topo)
    return pontos, principais


def _ticker_principal(
    tickers: Sequence[str], pontos_ticker: Mapping[str, Sequence[Mapping[str, Any]]], janela: int
) -> str | None:
    """O mais negociado nos últimos `janela` meses; sem negócio neles, nos 24; empate, em ordem alfabética."""
    for corte in (-janela, 0):
        volumes = {t: sum(p["volume"] for p in pontos_ticker[t][corte:]) for t in tickers if t in pontos_ticker}
        if any(volumes.values()):
            return sorted(volumes, key=lambda t: (-volumes[t], t))[0]
    return None


def classificar(
    tickers_atuais: Sequence[str],
    tickers: Sequence[str],
    desde: str | None,
    particoes: Mapping[str, Mapping[str, Any]],
    meses: Sequence[str],
    hoje: dt.date,
    cfg: Liquidez,
) -> dict[str, str]:
    """Categoria da companhia e o critério em texto. Precedência em `CATEGORIAS`."""
    if not tickers_atuais:
        return {"categoria": "sem_ticker", "criterio_texto": "A B3 não informa código de negociação."}
    if listada_ha_menos_de(desde, cfg.listagem_recente_meses, hoje):
        return {
            "categoria": "listagem_recente",
            "criterio_texto": f"Listada em {_data_br(desde or '')}, há menos de {cfg.listagem_recente_meses} meses.",
        }
    registros = [(m, particoes[m]["tickers"][t]) for m in meses for t in tickers if t in particoes[m]["tickers"]]
    if not registros:
        return {
            "categoria": "sem_cotacao_no_periodo",
            "criterio_texto": f"Sem registro no COTAHIST nos últimos {len(meses)} meses.",
        }
    recentes = set(meses[-cfg.janela_sem_negocios_meses :])
    if not any(m in recentes for m, _ in registros):
        ultimo = max(v["ultimo_pregao"] for _, v in registros)
        return {
            "categoria": "sem_negocios",
            "criterio_texto": (
                f"Nenhum negócio nos últimos {cfg.janela_sem_negocios_meses} meses fechados; "
                f"último pregão em {_data_br(ultimo)}."
            ),
        }
    janela = meses[-cfg.janela_presenca_meses :]
    pontos, _ = _pontos_companhia(tickers, particoes, janela)
    dias, pregoes = sum(p["dias_com_negocio"] for p in pontos), sum(len(particoes[m]["pregoes"]) for m in janela)
    presenca = dias / pregoes if pregoes else 0.0
    if presenca < cfg.presenca_baixa_abaixo_de:
        categoria = "presenca_baixa"
    elif presenca > cfg.presenca_alta_acima_de:
        categoria = "presenca_alta"
    else:
        categoria = "presenca_media"
    return {
        "categoria": categoria,
        "criterio_texto": f"Negociou em {dias} de {pregoes} pregões nos últimos {cfg.janela_presenca_meses} meses.",
    }


def tickers_da_companhia(companhia: Mapping[str, Any], historicos: Mapping[str, str]) -> list[str]:
    atuais = [t["ticker"] for t in companhia["tickers"]]
    return atuais + sorted(t for t, cvm in historicos.items() if cvm == companhia["codigo_cvm"] and t not in atuais)


def _meses_suspeitos(
    tickers: Sequence[str], meses: Sequence[str], suspeitos: Mapping[str, Mapping[str, Sequence[str]]]
) -> list[str]:
    return [m for m in meses if any(t in suspeitos.get(m, {}) for t in tickers)]


def construir(
    particoes: Mapping[str, Mapping[str, Any]],
    meses: Sequence[str],
    parcial: str | None,
    companhias: Sequence[Mapping[str, Any]],
    historicos: Mapping[str, str],
    suspeitos: Mapping[str, Mapping[str, Sequence[str]]],
    cfg: Liquidez,
) -> dict[str, Any]:
    """Devolve as listas `tickers` e `companhias`, o não atribuído e os pregões de cada mês."""
    pregoes = pregoes_por_mes(particoes, meses)
    janelas = cfg.janelas_agregados_meses
    dono = {t["ticker"]: c["codigo_cvm"] for c in companhias for t in c["tickers"]} | dict(historicos)
    atuais = {t["ticker"] for c in companhias for t in c["tickers"]}
    com_registro = sorted({t for m in meses for t in particoes[m]["tickers"]})
    sem_dono = 0
    volume_sem_dono = [0] * len(meses)
    pontos_ticker: dict[str, list[dict[str, Any]]] = {}
    for t in com_registro:
        if t not in dono:
            sem_dono += 1
            for i, m in enumerate(meses):
                volume_sem_dono[i] += particoes[m]["tickers"].get(t, {}).get("volume", 0)
            continue
        pontos_ticker[t] = [_ponto(particoes[m]["tickers"].get(t), pregoes[i]) for i, m in enumerate(meses)]

    def _ultimo(tks: Sequence[str]) -> dict[str, Any]:
        registros = [v for m in meses for t in tks if (v := particoes[m]["tickers"].get(t))]
        if not registros:
            return {"ultimo_pregao": None, "ultimo_preco": None}
        r = max(registros, key=lambda v: (v["ultimo_pregao"], v["volume"]))
        return {"ultimo_pregao": r["ultimo_pregao"], "ultimo_preco": r["ultimo_preco"]}

    lista_tickers = [
        {
            "agregados": _agregados(pts, pregoes, janelas),
            "codigo_cvm": dono[t],
            "historico": t not in atuais,
            "mensal": _serie(pts),
            "meses_negocios_suspeitos": _meses_suspeitos([t], meses, suspeitos),
            "ticker": t,
            "volume_mes_parcial": (particoes[parcial]["tickers"].get(t, {}).get("volume", 0))
            if parcial and parcial in particoes
            else None,
            **_ultimo([t]),
        }
        for t, pts in pontos_ticker.items()
    ]
    lista_cias = []
    for c in sorted(companhias, key=lambda x: x["codigo_cvm"]):
        tks = [t for t in tickers_da_companhia(c, historicos) if t in pontos_ticker]
        if not tks:
            continue
        pts, _ = _pontos_companhia(tks, particoes, meses)
        lista_cias.append(
            {
                "agregados": _agregados(pts, pregoes, janelas),
                "codigo_cvm": c["codigo_cvm"],
                "mensal": _serie(pts),
                "meses_negocios_suspeitos": _meses_suspeitos(tks, meses, suspeitos),
                "pregao": c["pregao"],
                "ticker_principal": _ticker_principal(tks, pontos_ticker, max(janelas)),
                "tickers": tks,
                "volume_mes_parcial": sum(particoes[parcial]["tickers"].get(t, {}).get("volume", 0) for t in tks)
                if parcial and parcial in particoes
                else None,
                **_ultimo(tks),
            }
        )
    nao = {"tickers": sem_dono, "volume_mensal": volume_sem_dono}
    return {"companhias": lista_cias, "nao_atribuido": nao, "pregoes_mes": pregoes, "tickers": lista_tickers}


def validar(
    doc: Mapping[str, Any],
    particoes: Mapping[str, Mapping[str, Any]],
    anterior: int | None,
    cfg: Liquidez,
) -> quality.Relatorio:
    rel = quality.Relatorio("acoes_liquidez")
    cias, tickers = doc["companhias"], doc["tickers"]
    quality.checar_queda(rel, len(cias), anterior, 0.10)
    quality.checar_unicos(rel, (c["codigo_cvm"] for c in cias), "codigo_cvm")
    quality.checar_unicos(rel, (t["ticker"] for t in tickers), "ticker")
    for item in (*cias, *tickers):
        nome = item.get("ticker") or item["codigo_cvm"]
        m = item["mensal"]
        if any(p is not None and p > 1 for p in m["presenca"]):
            rel.erro("presenca_maior_que_1", f"{nome}: presença acima de 1")
        if any(t is not None and n == 0 for t, n in zip(m["ticket_medio"], m["negocios"], strict=True)):
            rel.erro("ticket_sem_negocio", f"{nome}: ticket médio em mês sem negócios")
    # A soma das companhias e do não atribuído reproduz as partições, mês a mês.
    for i, mes in enumerate(doc["meses"]):
        partes = sum(c["mensal"]["volume"][i] for c in cias) + doc["nao_atribuido"]["volume_mensal"][i]
        total = sum(v["volume"] for v in particoes[mes]["tickers"].values())
        if partes != total:
            rel.erro("soma_mensal", f"{mes}: companhias + não atribuído = {partes}; partição = {total}")
        conf = particoes[mes].get("conferencia")
        if conf and total and abs(total - conf["acoes_filtro_ticker"]) / total > cfg.tolerancia_filtros:
            rel.aviso(
                "filtros_divergem",
                f"{mes}: filtro por espécie {total} e por ticker {conf['acoes_filtro_ticker']} diferem "
                f"mais de {cfg.tolerancia_filtros:.2%}",
            )
    janela = sum(sum(c["mensal"]["volume"]) for c in cias)
    perdido = sum(doc["nao_atribuido"]["volume_mensal"])
    if janela + perdido and perdido / (janela + perdido) > LIMITE_NAO_ATRIBUIDO:
        rel.aviso("volume_sem_companhia", f"{perdido / (janela + perdido):.1%} do volume sem companhia em 24 meses")
    return rel


def csv_cabecalho(janelas: Sequence[int]) -> list[str]:
    colunas = ["codigo_cvm", "pregao", "ticker_principal", "categoria", "ultimo_pregao"]
    for j in janelas:
        colunas += [f"volume_{j}m_rs_mil", f"presenca_{j}m", f"ticket_medio_{j}m_rs"]
    return colunas


def csv_linhas(
    cias: Sequence[Mapping[str, Any]], categorias: Mapping[str, str | None], janelas: Sequence[int]
) -> list[list[Any]]:
    linhas = []
    for c in cias:
        linha = [
            c["codigo_cvm"],
            c["pregao"],
            c["ticker_principal"],
            categorias.get(c["codigo_cvm"]),
            c["ultimo_pregao"],
        ]
        for j in janelas:
            a = c["agregados"][f"{j}m"]
            linha += [round(a["volume"] / 1000), a["presenca"], a["ticket_medio"]]
        linhas.append(linha)
    return linhas
