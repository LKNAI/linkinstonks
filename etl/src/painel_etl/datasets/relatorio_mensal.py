"""Relatório mensal (item 8.7): modelos determinísticos de texto, sem modelo de linguagem, com frases neutras de registro.

Entradas: log de eventos, partições do COTAHIST e registro de falhas de coleta. Mesma entrada, mesmo texto.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

SEM_OCORRENCIA = "Nenhuma ocorrência no mês."

SEGMENTOS = {
    "NM": "Novo Mercado", "N2": "Nível 2", "N1": "Nível 1", "MP": "Bovespa Mais", "B": "Tradicional",
    "SO": "Balcão organizado (SOMA)", "BN": "Balcão não organizado", "?": "Sem dados",
}  # fmt: skip
CATEGORIAS = {
    "sem_ticker": "sem código de negociação", "listagem_recente": "listagem recente",
    "sem_cotacao_no_periodo": "sem cotação no período", "sem_negocios": "sem negócios",
    "presenca_baixa": "presença baixa", "presenca_media": "presença média", "presenca_alta": "presença alta",
}  # fmt: skip
# Espelha NOME_FONTE de web/lib/rotulos.ts; tests/golden/test_relatorio_golden.py confere.
FONTES = {
    "b3_listed": "B3 · Empresas listadas", "b3_bdr_api": "B3 · BDRs (API)",
    "b3_cotahist": "B3 · Cotações de BDRs (COTAHIST)", "b3_cotahist_acoes": "B3 · Cotações de ações (COTAHIST)",
    "b3_finservices": "Banco B3 · programas de BDR", "bradesco": "Bradesco Custódia",
    "cvm_fca": "CVM · Formulário Cadastral", "cvm_cad": "CVM · Cadastro de companhias",
}  # fmt: skip
MESES = (
    "janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro",
    "dezembro",
)  # fmt: skip


def nome_do_mes(mes: str) -> str:
    return f"{MESES[int(mes[5:7]) - 1]} de {mes[:4]}"


def mes_anterior(mes: str) -> str:
    ano, m = int(mes[:4]), int(mes[5:7])
    return f"{ano - 1}-12" if m == 1 else f"{ano}-{m - 1:02d}"


def _data(iso: str) -> str:
    return f"{iso[8:10]}/{iso[5:7]}/{iso[:4]}"


def _inteiro(n: int) -> str:
    return f"{n:,}".replace(",", ".")


def dinheiro(reais: float) -> str:
    """Mesmo formato compacto das telas: R$ 1,2 bi; R$ 350 mi; R$ 90 mil."""
    for limite, sufixo in ((1e12, "tri"), (1e9, "bi"), (1e6, "mi")):
        if abs(reais) >= limite:
            return f"R$ {reais / limite:.1f}".replace(".", ",") + f" {sufixo}"
    return f"R$ {round(reais / 1000)} mil"


def _percentual(atual: float, anterior: float) -> str:
    v = (atual / anterior - 1) * 100
    sinal = "+" if v >= 0 else "−"  # noqa: RUF001 (sinal de menos tipográfico, como nas telas)
    return f"{sinal}{abs(v):.1f}%".replace(".", ",")


def _variacao(atual: float, anterior: float) -> str:
    return f"{_percentual(atual, anterior)} contra o mês anterior" if anterior else "sem base de comparação"


def _nome(e: Mapping[str, Any], nomes: Mapping[str, str]) -> str:
    if e["dataset"] != "acoes":
        return str(e["chave"])
    # só na deslistagem `de` é o nome da companhia; nos demais eventos é o valor anterior (banco, segmento)
    return nomes.get(e["chave"]) or (e["tipo"] == "deslistagem" and e.get("de")) or f"CVM {e['chave']}"


def _href(e: Mapping[str, Any], nomes: Mapping[str, str]) -> str | None:
    if e["dataset"] != "acoes":
        return f"/bdrs/{e['chave']}/"
    return f"/acoes/{e['chave']}/" if e["chave"] in nomes else None


def _item(texto: str, href: str | None = None) -> dict[str, Any]:
    return {"href": href, "texto": texto}


def _frase(e: Mapping[str, Any], nomes: Mapping[str, str]) -> str:
    n, d, fonte = _nome(e, nomes), _data(e["data"]), e["fonte"]
    de, para = e.get("de") or "não informado", e.get("para") or "não informado"
    match e["tipo"]:
        case "troca_escriturador":
            return f"{n}: escriturador passou de {de} para {para}, registrado em {d} (fonte: {fonte})."
        case "troca_depositaria":
            return f"{n}: depositária passou de {de} para {para}, registrado em {d} (fonte: {fonte})."
        case "nova_listagem":
            return f"{n}: nova listagem, registrada em {d} (fonte: {fonte})."
        case "deslistagem":
            return f"{n}: saiu da lista de companhias em {d} (fonte: {fonte})."
        case "novo_bdr":
            return f"{n}: novo BDR, registrado em {d} (fonte: {fonte})."
        case "bdr_cancelado":
            return f"{n}: BDR saiu da lista em {d} (fonte: {fonte})."
        case "mudanca_segmento":
            a, b = SEGMENTOS.get(de, de), SEGMENTOS.get(para, para)
            return f"{n}: segmento passou de {a} para {b}, registrado em {d} (fonte: {fonte})."
        case _:
            a, b = CATEGORIAS.get(de, de), CATEGORIAS.get(para, para)
            return f"{n}: categoria de negociação passou de {a} para {b}, registrado em {d} (fonte: {fonte})."


def _secao_eventos(
    sid: str, titulo: str, tipos: Sequence[str], eventos: Sequence[Mapping[str, Any]], nomes: Mapping[str, str]
) -> dict[str, Any]:
    escolhidos = sorted((e for e in eventos if e["tipo"] in tipos), key=lambda e: (e["data"], _nome(e, nomes)))
    return {
        "id": sid,
        "itens": [_item(_frase(e, nomes), _href(e, nomes)) for e in escolhidos],
        "titulo": titulo,
        "vazio": SEM_OCORRENCIA,
    }


def _soma(particao: Mapping[str, Any] | None) -> int:
    return sum(t["volume"] for t in particao["tickers"].values()) if particao else 0


def variacoes_bdr(
    atual: Mapping[str, Any] | None, anterior: Mapping[str, Any] | None, volume_minimo: int, quantidade: int
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Maiores altas e quedas. Os dois meses precisam atingir o mínimo: base pequena só produz ruído percentual."""
    if not atual or not anterior:
        return [], []
    v = []
    for tk, t in atual["tickers"].items():
        base = anterior["tickers"].get(tk)
        if base and t["volume"] >= volume_minimo and base["volume"] >= volume_minimo:
            v.append(
                {"anterior": base["volume"], "atual": t["volume"], "razao": t["volume"] / base["volume"], "ticker": tk}
            )
    altas = sorted((x for x in v if x["razao"] > 1), key=lambda x: (-x["razao"], x["ticker"]))[:quantidade]
    quedas = sorted((x for x in v if x["razao"] < 1), key=lambda x: (x["razao"], x["ticker"]))[:quantidade]
    return altas, quedas


def _texto_var(x: Mapping[str, Any]) -> str:
    return (
        f"{x['ticker']}: {dinheiro(x['atual'])} no mês, contra {dinheiro(x['anterior'])} no mês anterior "
        f"({_percentual(x['atual'], x['anterior'])})."
    )


def _secao_qualidade(
    mes: str,
    falhas: Sequence[Mapping[str, Any]],
    pregoes: Sequence[str],
    processados: Sequence[str] | None,
    registro_desde: str,
) -> dict[str, Any]:
    itens = []
    if mes < registro_desde:
        itens.append(
            _item(f"Falhas de coleta: sem registro neste mês. O registro começa em {nome_do_mes(registro_desde)}.")
        )
    por_fonte: dict[str, set[str]] = {}
    for f in falhas:
        por_fonte.setdefault(f["fonte"], set()).add(f["data"])
    for fonte, dias in sorted(por_fonte.items()):
        itens.append(
            _item(
                f"{FONTES.get(fonte, fonte)}: falha ou atraso de coleta em {len(dias)} dia(s), o último em {_data(max(dias))}."
            )
        )
    if processados is None:
        itens.append(_item("Atualização diária dos pregões: sem registro para este mês."))
    else:
        faltando = sorted(set(pregoes) - set(processados))
        if faltando:
            itens.append(
                _item(
                    f"{len(faltando)} pregão(ões) sem atualização diária, cobertos depois pelo arquivo mensal: "
                    + ", ".join(_data(d) for d in faltando)
                    + "."
                )
            )
    return {"id": "qualidade", "itens": itens, "titulo": "Qualidade dos dados no mês", "vazio": SEM_OCORRENCIA}


def construir(
    mes: str,
    eventos: Sequence[Mapping[str, Any]],
    nomes: Mapping[str, str],
    n_companhias: int,
    n_bdrs: int,
    acoes: tuple[Mapping[str, Any] | None, Mapping[str, Any] | None],
    bdrs: tuple[Mapping[str, Any] | None, Mapping[str, Any] | None],
    falhas: Sequence[Mapping[str, Any]],
    processados: Sequence[str] | None,
    volume_minimo_bdr: int,
    maiores_variacoes: int,
    registro_falhas_desde: str,
    schema_version: str,
) -> dict[str, Any]:
    """`acoes` e `bdrs` trazem as partições (mês, mês anterior)."""
    do_mes = [e for e in eventos if e["data"].startswith(mes)]
    va, vaa = _soma(acoes[0]), _soma(acoes[1])
    vb, vba = _soma(bdrs[0]), _soma(bdrs[1])
    resumo = {
        "bdrs": n_bdrs,
        "companhias": n_companhias,
        "volume_acoes": va,
        "volume_acoes_anterior": vaa,
        "volume_bdrs": vb,
        "volume_bdrs_anterior": vba,
    }
    altas, quedas = variacoes_bdr(bdrs[0], bdrs[1], volume_minimo_bdr, maiores_variacoes)
    limite = dinheiro(volume_minimo_bdr)
    secoes = [
        {
            "id": "resumo",
            "itens": [
                _item(f"{_inteiro(n_companhias)} companhias e {_inteiro(n_bdrs)} BDRs no cadastro."),
                _item(f"Volume de ações no mês: {dinheiro(va)} ({_variacao(va, vaa)})."),
                _item(f"Volume de BDRs no mês: {dinheiro(vb)} ({_variacao(vb, vba)})."),
            ],
            "titulo": "Resumo em números",
            "vazio": SEM_OCORRENCIA,
        },
        _secao_eventos("escrituradores", "Trocas de escriturador", ["troca_escriturador"], do_mes, nomes),
        _secao_eventos("listagens", "Novas listagens e deslistagens", ["nova_listagem", "deslistagem"], do_mes, nomes),
        _secao_eventos("segmentos", "Mudanças de segmento", ["mudanca_segmento"], do_mes, nomes),
        _secao_eventos("bdrs", "BDRs novos e cancelados", ["novo_bdr", "bdr_cancelado"], do_mes, nomes),
        _secao_eventos("depositarias", "Trocas de depositária", ["troca_depositaria"], do_mes, nomes),
        {
            "id": "altas",
            "itens": [_item(_texto_var(x), f"/bdrs/{x['ticker']}/") for x in altas],
            "titulo": f"Maiores altas de volume de BDRs (mínimo de {limite} nos dois meses)",
            "vazio": SEM_OCORRENCIA,
        },
        {
            "id": "quedas",
            "itens": [_item(_texto_var(x), f"/bdrs/{x['ticker']}/") for x in quedas],
            "titulo": f"Maiores quedas de volume de BDRs (mínimo de {limite} nos dois meses)",
            "vazio": SEM_OCORRENCIA,
        },
        _secao_eventos(
            "negociacao",
            "Ações que entraram ou saíram das categorias de pouca negociação",
            ["entrou_sem_negocios", "saiu_sem_negocios", "entrou_presenca_baixa", "saiu_presenca_baixa"],
            do_mes,
            nomes,
        ),
        _secao_qualidade(mes, falhas, (acoes[0] or {}).get("pregoes", []), processados, registro_falhas_desde),
    ]
    return {
        "mes": mes,
        "resumo": resumo,
        "schema_version": schema_version,
        "secoes": secoes,
        "titulo": f"Relatório de {nome_do_mes(mes)}",
    }
