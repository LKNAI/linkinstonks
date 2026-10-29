"""`painel-etl seed-import`: converte `seed/` (somente leitura) no formato novo de `data/public/` (carga inicial).

Serve para o site funcionar desde o primeiro deploy e como régua de paridade. Um `run` normal, com as fontes
vivas, substitui estes arquivos. O seed não tem o histórico completo de escrituradores nem o mês parcial.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from painel_etl import paths
from painel_etl.core import io as pio
from painel_etl.core import schema
from painel_etl.sources import b3_cotahist

SCHEMA_VERSION = 1
# O seed usa rótulos próprios; decisão da Fase 0: valem os da API da B3.
CATEGORIA = {"Renda variável": "Renda Variável", "Renda fixa": "Renda Fixa", "Commodities / cripto": "Commodities"}
INDICADOR = {"NM": "18", "N2": "17", "N1": "16", "MP": "32", "B": "1", "SO": "7", "BN": "8", "?": ""}


def _nulo(v: str) -> str | None:
    return v or None


def acoes_do_seed(seed: Path) -> dict[str, Any]:
    brutas = json.loads((seed / "data" / "acoes.json").read_text(encoding="utf-8"))["companies"]
    saida = []
    for c in brutas:
        f = c["f"]
        b = c["b"]
        cvm = (
            None
            if not f
            else {
                "atual": f["cur"],
                "inicio": f["ini"],
                "inicio_aproximado": f["ax"],
                "anterior": _nulo(f["prev"]),
                "anterior_inicio": _nulo(f["pini"]),
                "anterior_fim": _nulo(f["pfim"]),
                "anterior_ultimo_ano": int(f["plast"]) if f["plast"] else None,
                "n_escrituradores": f["n"],
            }
        )
        saida.append(
            {
                "codigo_cvm": c["v"],
                "pregao": c["p"],
                "razao_social": c["r"],
                "emissor": c["e"],
                "cnpj": c["c"],
                "setor": c["s"],
                "indicador_mercado": INDICADOR[c["m"]],
                "segmento": c["m"],
                "tickers": [{"ticker": t, "classe": k} for t, k in c["t"]],
                "escriturador_b3": {
                    "on": b if c["onr"] else None,
                    "pn": _nulo(c["pn"]),
                    "bruto_on": c["onr"],
                    "bruto_pn": c["pnr"],
                },
                "detalhe_b3": c["m"] != "?",
                "escriturador_cvm": cvm,
                "divergente_b3_cvm": bool(f and f["cur"] != b),
                "situacao_cvm": None,
            }
        )
    return {"companhias": sorted(saida, key=lambda x: (x["pregao"], x["codigo_cvm"])), "schema_version": SCHEMA_VERSION}


def bdrs_do_seed(seed: Path) -> dict[str, Any]:
    j = json.loads((seed / "data" / "bdrs.json").read_text(encoding="utf-8"))
    saida = []
    for d in j["bdrs"]:
        saida.append(
            {
                "ticker": d["t"],
                "nome": d["n"],
                "tipo": d["k"],
                "isin": d["i"],
                "depositaria": d["d"],
                "fonte_depositaria": d["s"],
                "categoria": CATEGORIA.get(d["c"], d["c"]),
                "qualificado": bool(d["q"]),
                "primeiro_pregao": d["f"],
                "ultimo_pregao": d["l"],
                "ultimo_preco": d["p"],
                "negocios_24m": d["g"],
                "volume_24m": sum(d["v"]) * 1000,  # o seed guarda R$ mil
                "volume_mensal": [v * 1000 for v in d["v"]],
                "volume_mes_parcial": None,
            }
        )
    meses = j["meta"]["months"]
    return {
        "bdrs": sorted(saida, key=lambda x: x["ticker"]),
        # Premissa só da carga inicial: os 24 meses do seed são fechados e vêm do COTAHIST mensal. A primeira
        # coleta real regrava isto a partir das partições, com a fonte efetiva de cada mês.
        "fontes_volume": {m: b3_cotahist.fonte_do_mes(m, {"fonte": "mensal", "pregoes": []}) for m in meses},
        "mes_parcial": None,
        "meses": meses,
        "pagina_fonte": b3_cotahist.PAGINA_FONTE,
        "schema_version": SCHEMA_VERSION,
    }


def importar(seed: Path | None = None, destino: Path | None = None) -> dict[str, int]:
    seed = seed or paths.repo_root() / "seed"
    destino = destino or paths.data_dir() / "public"
    acoes, bdrs = acoes_do_seed(seed), bdrs_do_seed(seed)
    schema.validar("acoes", acoes)
    schema.validar("bdrs", bdrs)
    pio.write_json(destino / "acoes.json", acoes, 0)
    pio.write_json(destino / "bdrs.json", bdrs, 0)
    return {"acoes": len(acoes["companhias"]), "bdrs": len(bdrs["bdrs"])}
