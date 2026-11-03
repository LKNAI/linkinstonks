"""CVM: Formulário Cadastral (FCA), escriturador (`docs/fontes.md`, seção 2).

`fca_cia_aberta_{AAAA}.zip` existe de 2010 ao ano corrente. O ano corrente é checado todo dia por
`HEAD`/ETag e só é baixado se mudou; anos fechados só no backfill. O que importa de cada arquivo
(a maior `Versao` de cada documento) é gravado em `data/history/fca/AAAA.csv.gz`, que vira a entrada do
dataset `acoes` sem depender de novos downloads.
"""

from __future__ import annotations

import csv
import io
import zipfile
from collections.abc import Iterator
from pathlib import Path

from pydantic import BaseModel

from painel_etl import paths
from painel_etl.core import io as pio
from painel_etl.core.cache import RawArtifact, raw_path, sha256_file
from painel_etl.core.http import Http
from painel_etl.core.state import State
from painel_etl.normalize import cnpj as cnpj_mod

BASE = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/FCA/DADOS"
ANO_INICIAL = 2010
COLUNAS = ["cnpj", "referencia", "versao", "empresa", "escriturador", "cnpj_escriturador", "inicio", "fim"]
COLUNAS_VM = [
    "cnpj", "referencia", "versao", "valor_mobiliario", "ticker", "mercado", "entidade", "inicio_negociacao",
    "fim_negociacao", "segmento", "inicio_listagem", "fim_listagem",
]  # fmt: skip
PREFIXOS_ACAO = ("Ações", "Units")  # debêntures, notas comerciais e bônus ficam de fora


class FcaRow(BaseModel):
    cnpj: str  # companhia, 14 dígitos
    referencia: str  # AAAA-MM-DD
    versao: int
    empresa: str
    escriturador: str
    cnpj_escriturador: str
    inicio: str
    fim: str

    @property
    def ano(self) -> int:
        return int(self.referencia[:4])


class ValorMobiliarioRow(BaseModel):
    """Ação ou unit de `fca_cia_aberta_valor_mobiliario_{AAAA}.csv`, na maior versão do documento."""

    cnpj: str  # companhia, 14 dígitos
    referencia: str  # AAAA-MM-DD; há uma referência por ano (AAAA-01-01)
    versao: int
    valor_mobiliario: str
    ticker: str
    mercado: str
    entidade: str
    inicio_negociacao: str
    fim_negociacao: str
    segmento: str
    inicio_listagem: str
    fim_listagem: str

    @property
    def ativo(self) -> bool:
        return not self.fim_negociacao and not self.fim_listagem


def url_ano(ano: int) -> str:
    return f"{BASE}/fca_cia_aberta_{ano}.zip"


def historico_dir() -> Path:
    return paths.data_dir() / "history" / "fca"


def fetch_ano(
    http: Http, ano: int, *, state: State, cache: Path | None = None, forcar: bool = False
) -> RawArtifact | None:
    """Baixa o ZIP do ano se o ETag mudou. Devolve None se não mudou (e não é `forcar`)."""
    url = url_ano(ano)
    chave = f"fca_{ano}"
    anterior = state.get(chave, {})
    head = http.head(url)
    head.raise_for_status()
    etag, lm = head.headers.get("etag"), head.headers.get("last-modified")
    if not forcar and etag and anterior.get("etag") == etag and raw_path("cvm_fca", f"fca_{ano}.zip", cache).exists():
        return None
    destino = raw_path("cvm_fca", f"fca_{ano}.zip", cache)
    r = http.download(url, destino)
    r.raise_for_status()
    sha = sha256_file(destino)
    mudou = anterior.get("sha256") != sha
    state.set(chave, {"etag": etag, "last_modified": lm, "sha256": sha})
    return RawArtifact("cvm_fca", f"fca_{ano}.zip", destino, sha, url, etag, lm, mudou)


def parse_zip(path: Path) -> Iterator[FcaRow]:
    """Linhas do CSV de escriturador (`;`, ISO-8859-1), só a maior versão de cada documento."""
    with zipfile.ZipFile(path) as z:
        nome = next(n for n in z.namelist() if "escriturador" in n)
        texto = io.TextIOWrapper(io.BytesIO(z.read(nome)), encoding="iso-8859-1", newline="")
        linhas = list(csv.DictReader(texto, delimiter=";"))
    maior: dict[tuple[str, str], int] = {}
    for r in linhas:
        k = (r["CNPJ_Companhia"], r["Data_Referencia"])
        maior[k] = max(maior.get(k, 0), int(r["Versao"] or 0))
    for r in linhas:
        if int(r["Versao"] or 0) != maior[(r["CNPJ_Companhia"], r["Data_Referencia"])]:
            continue
        yield FcaRow(
            cnpj=cnpj_mod.digits(r["CNPJ_Companhia"]),
            referencia=r["Data_Referencia"],
            versao=int(r["Versao"] or 0),
            empresa=r["Nome_Empresarial"].strip(),
            escriturador=r["Escriturador"].strip(),
            cnpj_escriturador=cnpj_mod.digits(r["CNPJ_Escriturador"]),
            inicio=r["Data_Inicio_Atuacao"].strip(),
            fim=r["Data_Fim_Atuacao"].strip(),
        )


def parse_valor_mobiliario(path: Path) -> Iterator[ValorMobiliarioRow]:
    """Linhas de ações e units do CSV de valores mobiliários, só a maior versão de cada documento."""
    with zipfile.ZipFile(path) as z:
        nome = next(n for n in z.namelist() if "valor_mobiliario" in n)
        texto = io.TextIOWrapper(io.BytesIO(z.read(nome)), encoding="iso-8859-1", newline="")
        linhas = list(csv.DictReader(texto, delimiter=";"))
    maior: dict[tuple[str, str], int] = {}
    for r in linhas:
        k = (r["CNPJ_Companhia"], r["Data_Referencia"])
        maior[k] = max(maior.get(k, 0), int(r["Versao"] or 0))
    for r in linhas:
        if int(r["Versao"] or 0) != maior[(r["CNPJ_Companhia"], r["Data_Referencia"])]:
            continue
        if not r["Valor_Mobiliario"].startswith(PREFIXOS_ACAO):
            continue
        yield ValorMobiliarioRow(
            cnpj=cnpj_mod.digits(r["CNPJ_Companhia"]),
            referencia=r["Data_Referencia"],
            versao=int(r["Versao"] or 0),
            valor_mobiliario=r["Valor_Mobiliario"].strip(),
            ticker=r["Codigo_Negociacao"].strip(),
            mercado=r["Mercado"].strip(),
            entidade=r["Entidade_Administradora"].strip(),
            inicio_negociacao=r["Data_Inicio_Negociacao"].strip(),
            fim_negociacao=r["Data_Fim_Negociacao"].strip(),
            segmento=r["Segmento"].strip(),
            inicio_listagem=r["Data_Inicio_Listagem"].strip(),
            fim_listagem=r["Data_Fim_Listagem"].strip(),
        )


def valores_mobiliarios_dir(raiz: Path | None = None) -> Path:
    return (raiz or paths.data_dir()) / "history" / "fca_valor_mobiliario"


def salvar_valores_mobiliarios(ano: int, linhas: list[ValorMobiliarioRow], pasta: Path) -> bool:
    """`data/history/fca_valor_mobiliario/AAAA.csv.gz`, ordenado de forma estável."""
    ordenadas = sorted(linhas, key=lambda x: (x.cnpj, x.referencia, x.valor_mobiliario, x.ticker, x.inicio_negociacao))
    return pio.write_csv_gz(
        pasta / f"{ano}.csv.gz", COLUNAS_VM, ([getattr(x, c) for c in COLUNAS_VM] for x in ordenadas)
    )


def carregar_valores_mobiliarios(pasta: Path) -> dict[str, list[ValorMobiliarioRow]]:
    """Todas as partições, agrupadas por CNPJ da companhia. Pasta vazia ou ausente devolve vazio."""
    saida: dict[str, list[ValorMobiliarioRow]] = {}
    for arq in sorted(pasta.glob("*.csv.gz")):
        for r in pio.read_csv_gz(arq):
            row = ValorMobiliarioRow.model_validate({**r, "versao": int(r["versao"])})
            saida.setdefault(row.cnpj, []).append(row)
    return saida


def salvar_particao(ano: int, linhas: list[FcaRow], pasta: Path | None = None) -> bool:
    """`data/history/fca/AAAA.csv.gz`, ordenado de forma estável."""
    ordenadas = sorted(linhas, key=lambda x: (x.cnpj, x.referencia, x.fim == "", x.inicio, x.escriturador))
    destino = (pasta or historico_dir()) / f"{ano}.csv.gz"
    return pio.write_csv_gz(destino, COLUNAS, ([getattr(x, c) for c in COLUNAS] for x in ordenadas))


def carregar_historico(pasta: Path | None = None) -> dict[str, list[FcaRow]]:
    """Todas as partições, agrupadas por CNPJ da companhia."""
    saida: dict[str, list[FcaRow]] = {}
    for arq in sorted((pasta or historico_dir()).glob("*.csv.gz")):
        for r in pio.read_csv_gz(arq):
            row = FcaRow(
                cnpj=r["cnpj"],
                referencia=r["referencia"],
                versao=int(r["versao"]),
                empresa=r["empresa"],
                escriturador=r["escriturador"],
                cnpj_escriturador=r["cnpj_escriturador"],
                inicio=r["inicio"],
                fim=r["fim"],
            )
            saida.setdefault(row.cnpj, []).append(row)
    return saida
