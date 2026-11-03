"""Parâmetros dos indicadores (`config/indicadores.yaml`). Definições e fórmulas: `docs/metodologia.md`."""

from __future__ import annotations

from functools import cache
from pathlib import Path

import yaml
from pydantic import BaseModel

from painel_etl import paths


class Liquidez(BaseModel):
    especies_acao: list[str]
    complementos_excluidos: list[str]
    janelas_agregados_meses: list[int]
    janela_sem_negocios_meses: int
    janela_presenca_meses: int
    listagem_recente_meses: int
    presenca_baixa_abaixo_de: float
    presenca_alta_acima_de: float
    tolerancia_filtros: float


class PerfilBdr(BaseModel):
    min_negocios_mes: int
    janela_resumo_meses: int


class EstouroNegocios(BaseModel):
    limite_campo: int
    negocios_esperados_min: int
    dias_minimos_mes: int
    negocios_tipicos_min: int


class FcaValorMobiliario(BaseModel):
    ano_inicial: int
    datas_listagem_incertas: list[str]
    segmento_cvm_para_b3: dict[str, str]


class Orcamento(BaseModel):
    data_public_mb: int


class Indicadores(BaseModel):
    liquidez: Liquidez
    perfil_bdr: PerfilBdr
    estouro_negocios: EstouroNegocios
    fca_valor_mobiliario: FcaValorMobiliario
    orcamento: Orcamento


@cache
def _ler(caminho: Path) -> Indicadores:
    return Indicadores.model_validate(yaml.safe_load(caminho.read_text(encoding="utf-8")))


def carregar(raiz: Path | None = None) -> Indicadores:
    return _ler((raiz or paths.config_dir()) / "indicadores.yaml")
