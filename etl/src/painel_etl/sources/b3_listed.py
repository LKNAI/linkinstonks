"""B3: API Empresas Listadas (`docs/fontes.md`, seção 1).

O parâmetro é um JSON em base64 na URL. `GetDetail` e `GetCategoryBDRETF` devolvem JSON dentro de uma
string (dupla codificação). Detalhe vazio (`"{}"`) significa "sem detalhe", nunca erro fatal.
"""

from __future__ import annotations

import base64
import json
import random
import time
from collections.abc import Callable, Sequence
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from painel_etl.core.http import Http

BASE = "https://sistemaswebb3-listados.b3.com.br/listedCompaniesProxy/CompanyCall/"
PAGE_SIZE = 120
CONCORRENCIA = 3
PAUSA_MS = (300, 800)


class _Modelo(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)


class ListedCompany(_Modelo):
    """Linha de `GetInitialCompanies`."""

    codigo_cvm: str = Field(alias="codeCVM")
    emissor: str = Field(alias="issuingCompany")
    razao_social: str = Field(alias="companyName")
    pregao: str = Field(alias="tradingName")
    cnpj: str = ""
    market_indicator: str = Field("", alias="marketIndicator")
    type_bdr: str = Field("", alias="typeBDR")
    status: str = ""
    setor: str = Field("", alias="segment")
    tipo: str = Field(alias="type")
    mercado: str = Field("", alias="market")


class OtherCode(_Modelo):
    code: str
    isin: str = ""


class CompanyDetail(_Modelo):
    """Campos úteis de `GetDetail`. Escriturador/depositária chegam como texto cru da B3."""

    codigo_cvm: str = Field("", alias="codeCVM")
    institution_common: str = Field("", alias="institutionCommon")
    institution_preferred: str = Field("", alias="institutionPreferred")
    code: str | None = None
    other_codes: list[OtherCode] | None = Field(None, alias="otherCodes")
    market: str = ""
    market_indicator: str = Field("", alias="marketIndicator")
    industry_classification: str = Field("", alias="industryClassification")


class EtfRow(_Modelo):
    """Linha de `GetCompaniesBDR` (BDRs de ETF)."""

    codigo_cvm: str = Field(alias="codeCVM")
    emissor: str = Field(alias="issuingCompany")
    nome: str = Field(alias="companyName")
    categoria_id: str = Field("", alias="codeCategoryBVMF")
    categoria: str = Field("", alias="describleCategoryBVMF")
    type_bdr: str = Field("", alias="typeBDR")


def encode_params(params: dict[str, Any]) -> str:
    """JSON compacto UTF-8 em base64, sem quebras de linha."""
    return base64.b64encode(json.dumps(params).encode("utf-8")).decode("ascii")


def unwrap(texto: str) -> Any:
    """Decodifica a resposta; se vier JSON dentro de string, decodifica de novo."""
    valor = json.loads(texto)
    return json.loads(valor) if isinstance(valor, str) else valor


class B3Listed:
    nome = "b3_listed"

    def __init__(
        self,
        http: Http,
        *,
        sleep: Callable[[float], None] = time.sleep,
        pausa_ms: tuple[int, int] = PAUSA_MS,
        concorrencia: int = CONCORRENCIA,
    ) -> None:
        self.http = http
        self._sleep = sleep
        self._pausa = pausa_ms
        self._conc = concorrencia

    def _chamar(self, metodo: str, params: dict[str, Any]) -> Any:
        r = self.http.get(f"{BASE}{metodo}/{encode_params(params)}")
        r.raise_for_status()
        return unwrap(r.text)

    def _pausar(self) -> None:
        self._sleep(random.uniform(*self._pausa) / 1000)

    def _paginas(self, metodo: str, extra: dict[str, Any]) -> list[dict[str, Any]]:
        linhas: list[dict[str, Any]] = []
        pagina, total = 1, 1
        while pagina <= total:
            j = self._chamar(metodo, {"language": "pt-br", "pageNumber": pagina, "pageSize": PAGE_SIZE, **extra})
            total = int(j["page"]["totalPages"])
            linhas += j["results"]
            pagina += 1
            if pagina <= total:
                self._pausar()
        return linhas

    def listar(self) -> list[ListedCompany]:
        """Todas as companhias (ações, BDRs, balcão...). Filtre por `tipo`/`type_bdr`."""
        return [ListedCompany.model_validate(x) for x in self._paginas("GetInitialCompanies", {})]

    def etfs(self) -> list[EtfRow]:
        extra = {"codeCategoryBVMF": -1, "company": ""}
        return [EtfRow.model_validate(x) for x in self._paginas("GetCompaniesBDR", extra)]

    def categorias(self) -> dict[str, str]:
        return {str(c["id"]): c["describle"] for c in self._chamar("GetCategoryBDRETF", {"language": "pt-br"})}

    def detalhe(self, codigo_cvm: str) -> CompanyDetail | None:
        dados = self._chamar("GetDetail", {"codeCVM": codigo_cvm, "language": "pt-br"})
        if not dados:
            return None
        return CompanyDetail.model_validate(dados)

    def detalhes(self, codigos: Sequence[str]) -> dict[str, CompanyDetail | None]:
        """`GetDetail` de várias companhias: no máximo 3 em paralelo, com pausa e jitter."""

        def um(codigo: str) -> tuple[str, CompanyDetail | None]:
            self._pausar()
            return codigo, self.detalhe(codigo)

        with ThreadPoolExecutor(max_workers=self._conc) as pool:
            return dict(pool.map(um, codigos))
