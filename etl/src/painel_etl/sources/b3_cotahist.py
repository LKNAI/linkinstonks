"""B3: séries históricas COTAHIST (`docs/fontes.md`, seção 4).

Três granularidades: diário (`D`), mensal (`M`, ~90 MB descompactado) e anual (`A`). Layout posicional de 245
colunas, ISO-8859-1, `\\r\\n`. Tudo em streaming, linha a linha: nunca se carrega um arquivo inteiro na memória.

Estratégia (seção 7.4):

- diário: processa os pregões ainda não vistos e acumula na partição do mês corrente;
- mensal: quando sai o arquivo do mês fechado, reconcilia (substitui) a partição; diferença > 0,5% vira alerta;
- um 404 em dia útil não é erro: tenta de novo nos 3 dias seguintes e só então considera "sem pregão".
"""

from __future__ import annotations

import datetime as dt
import zipfile
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from painel_etl import paths
from painel_etl.core import io as pio
from painel_etl.core.http import READ_TIMEOUT_COTAHIST, Http
from painel_etl.core.state import State
from painel_etl.normalize.tickers import base_ticker, is_acao_ticker, is_bdr_ticker

BASE = "https://bvmf.bmfbovespa.com.br/InstDados/SerHist"
#: Página oficial da B3 onde os arquivos COTAHIST são listados (para o leitor conferir a origem do volume).
PAGINA_FONTE = (
    "https://www.b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/market-data/historico/"
    "mercado-a-vista/series-historicas/"
)
TIPOS_MERCADO = {"010": 1, "020": 0}  # vista (preço de referência) e fracionário
TOLERANCIA_RECONCILIACAO = 0.005
DIAS_DE_ESPERA = 3


@dataclass(frozen=True)
class Categoria:
    """Um recorte do COTAHIST que vira um dataset (BDRs, ações...): o que entra, onde ficam as partições e o estado.

    Os arquivos da B3 são os mesmos para todas as categorias; só muda o filtro. Acrescentar uma categoria é
    declarar uma `Categoria` aqui (ver `docs/adicionar-dataset.md`).
    """

    nome: str
    fonte: str  # chave em `meta.fontes`
    pasta: str  # data/history/<pasta>/AAAA-MM.json
    estado: str  # data/state/<estado>.json
    aceita: Callable[[str, str], bool]  # (CODNEG, ESPECI) -> entra?


BDR = Categoria("bdr", "b3_cotahist", "bdr_volume", "cotahist", lambda c, e: is_bdr_ticker(c) and "UNT" not in e)
ACAO = Categoria("acao", "b3_cotahist_acoes", "acoes_volume", "cotahist_acoes", is_acao_ticker)


@dataclass(frozen=True)
class Cotacao:
    data: str  # AAAA-MM-DD
    codneg: str
    mercado: str
    nome: str
    especi: str
    preco: float
    negocios: int
    volume_centavos: int
    isin: str


def url_diario(d: dt.date) -> str:
    return f"{BASE}/COTAHIST_D{d:%d%m%Y}.ZIP"


def url_mensal(ano: int, mes: int) -> str:
    return f"{BASE}/COTAHIST_M{mes:02d}{ano}.ZIP"


def url_anual(ano: int) -> str:
    return f"{BASE}/COTAHIST_A{ano}.ZIP"


def fonte_do_mes(mes: str, particao: dict[str, Any]) -> dict[str, Any]:
    """Arquivos oficiais da B3 de onde veio o volume de um mês (rastreabilidade): o `M` oficial, ou os `D` somados."""
    if particao["fonte"] == "mensal":
        ano, m = (int(x) for x in mes.split("-"))
        return {"arquivos": [url_mensal(ano, m)], "tipo": "mensal"}
    return {"arquivos": [url_diario(dt.date.fromisoformat(d)) for d in sorted(particao["pregoes"])], "tipo": "diario"}


def parse_linha(linha: str, cat: Categoria = BDR) -> Cotacao | None:
    """Cotação da categoria (vista ou fracionário), ou None. Posições 1-indexadas e inclusivas da seção 7.4."""
    if linha[:2] != "01":
        return None
    mercado = linha[24:27]
    codneg = linha[12:24].strip()
    especi = linha[39:49].strip()
    if mercado not in TIPOS_MERCADO or not cat.aceita(codneg, especi):
        return None
    d = linha[2:10]
    return Cotacao(
        data=f"{d[:4]}-{d[4:6]}-{d[6:8]}",
        codneg=codneg,
        mercado=mercado,
        nome=linha[27:39].strip(),
        especi=especi,
        preco=int(linha[108:121]) / 100,
        negocios=int(linha[147:152]),
        volume_centavos=int(linha[170:188]),
        isin=linha[230:242].strip(),
    )


def linhas_do_zip(path: Path) -> Iterator[str]:
    """Registros do arquivo, um a um (streaming)."""
    with zipfile.ZipFile(path) as z, z.open(z.namelist()[0]) as f:
        for bruto in f:
            yield bruto.decode("iso-8859-1").rstrip("\r\n")


@dataclass
class Agregado:
    nome: str = ""
    tipo: str = ""
    isin: str = ""
    volume_centavos: int = 0
    negocios: int = 0
    primeiro: str = ""
    ultimo: str = ""
    preco: float = 0.0
    _chave_preco: tuple[str, int] = ("", -1)

    def somar(self, c: Cotacao) -> None:
        self.volume_centavos += c.volume_centavos
        self.negocios += c.negocios
        self.primeiro = min(self.primeiro or c.data, c.data)
        self.ultimo = max(self.ultimo, c.data)
        chave = (c.data, TIPOS_MERCADO[c.mercado])
        if chave > self._chave_preco:  # último pregão; no mesmo dia, o preço da vista
            self._chave_preco, self.preco = chave, c.preco
            self.nome, self.tipo, self.isin = c.nome, c.especi.split()[0], c.isin or self.isin

    def como_dict(self) -> dict[str, Any]:
        return {
            "isin": self.isin,
            "negocios": self.negocios,
            "nome": self.nome,
            "primeiro_pregao": self.primeiro,
            "tipo": self.tipo,
            "ultimo_pregao": self.ultimo,
            "ultimo_preco": self.preco,
            "volume": round(self.volume_centavos / 100),
        }


def agregar(linhas: Iterator[str], cat: Categoria = BDR) -> dict[str, dict[str, Agregado]]:
    """mês (AAAA-MM) -> ticker-base -> agregado. O fracionário soma no ticker-base."""
    meses: dict[str, dict[str, Agregado]] = {}
    for linha in linhas:
        c = parse_linha(linha, cat)
        if c:
            meses.setdefault(c.data[:7], {}).setdefault(base_ticker(c.codneg), Agregado()).somar(c)
    return meses


# ---------------------------------------------------------------------------- partições mensais
def particao_dir() -> Path:
    return paths.data_dir() / "history" / "bdr_volume"


def ler_particao(mes: str, pasta: Path | None = None) -> dict[str, Any] | None:
    doc: dict[str, Any] | None = pio.read_json((pasta or particao_dir()) / f"{mes}.json")
    return doc


def gravar_particao(
    mes: str, tickers: dict[str, Agregado], fonte: str, pregoes: list[str], pasta: Path | None = None
) -> bool:
    doc = {
        "fonte": fonte,  # "mensal" (oficial) ou "diario" (parcial/provisório)
        "mes": mes,
        "pregoes": sorted(pregoes),
        "schema_version": 1,
        "tickers": {t: a.como_dict() for t, a in sorted(tickers.items())},
    }
    return pio.write_json((pasta or particao_dir()) / f"{mes}.json", doc, indent=0)


def _a_partir_da_particao(doc: dict[str, Any]) -> dict[str, Agregado]:
    saida = {}
    for t, v in doc["tickers"].items():
        a = Agregado(
            v["nome"],
            v["tipo"],
            v["isin"],
            v["volume"] * 100,
            v["negocios"],
            v["primeiro_pregao"],
            v["ultimo_pregao"],
            v["ultimo_preco"],
        )
        a._chave_preco = (v["ultimo_pregao"], 1)
        saida[t] = a
    return saida


def volume_total(tickers: dict[str, Any]) -> float:
    return float(sum(v["volume"] if isinstance(v, dict) else v.volume_centavos / 100 for v in tickers.values()))


# ---------------------------------------------------------------------------- mensal / backfill
def processar_mensal(
    http: Http, ano: int, mes: int, *, cache: Path, pasta: Path | None = None, cat: Categoria = BDR
) -> dict[str, Any]:
    """Baixa o arquivo `M` de um mês fechado e (re)grava a partição. Devolve um resumo para o relatório."""
    chave = f"{ano}-{mes:02d}"
    destino = cache / f"COTAHIST_M{mes:02d}{ano}.ZIP"
    r = http.download(url_mensal(ano, mes), destino, read_timeout=READ_TIMEOUT_COTAHIST)
    if r.status_code == 404:
        return {"mes": chave, "status": "indisponivel"}
    r.raise_for_status()
    agregados = agregar(linhas_do_zip(destino), cat)
    novo = agregados.get(chave, {})
    antigo = ler_particao(chave, pasta)
    diff_pct = None
    if antigo and antigo["fonte"] == "diario":
        a, b = volume_total(antigo["tickers"]), volume_total(novo)
        diff_pct = abs(a - b) / b if b else None
    pregoes = sorted({d for a in novo.values() for d in (a.primeiro, a.ultimo)})
    mudou = gravar_particao(chave, novo, "mensal", pregoes, pasta)
    return {
        "mes": chave,
        "status": "ok",
        "mudou": mudou,
        "tickers": len(novo),
        "diferenca_vs_diario": diff_pct,
        "alerta": bool(diff_pct is not None and diff_pct > TOLERANCIA_RECONCILIACAO),
    }


def meses_entre(inicio: str, fim: str) -> list[tuple[int, int]]:
    """ "2024-10".."2026-09" -> [(2024, 10), ...]."""
    (a0, m0), (a1, m1) = (tuple(map(int, x.split("-"))) for x in (inicio, fim))
    saida, a, m = [], a0, m0
    while (a, m) <= (a1, m1):
        saida.append((a, m))
        a, m = (a + 1, 1) if m == 12 else (a, m + 1)
    return saida


# ---------------------------------------------------------------------------- diário
def dias_uteis(de: dt.date, ate: dt.date) -> list[dt.date]:
    return [de + dt.timedelta(days=i) for i in range((ate - de).days + 1) if (de + dt.timedelta(days=i)).weekday() < 5]


def processar_diario(
    http: Http, state: State, hoje: dt.date, *, cache: Path, pasta: Path | None = None, cat: Categoria = BDR
) -> dict[str, Any]:
    """Processa os pregões pendentes até `hoje` e acumula na partição do mês.

    Estado (`data/state/cotahist.json`): `processados` (datas já somadas), `espera` (data -> 1ª vez que deu 404)
    e `sem_pregao` (feriados confirmados depois da espera de 3 dias).
    """
    processados: set[str] = set(state.get("processados", []))
    espera: dict[str, str] = dict(state.get("espera", {}))
    sem_pregao: set[str] = set(state.get("sem_pregao", []))
    inicio = dt.date.fromisoformat(state.get("inicio", hoje.replace(day=1).isoformat()))
    novos, pendentes = [], []
    mes_processado: dict[str, dict[str, Agregado]] = {}
    for d in dias_uteis(inicio, hoje):
        iso = d.isoformat()
        if iso in processados or iso in sem_pregao:
            continue
        destino = cache / f"COTAHIST_D{d:%d%m%Y}.ZIP"
        r = http.download(url_diario(d), destino)
        if r.status_code == 404:
            primeira = dt.date.fromisoformat(espera.setdefault(iso, hoje.isoformat()))
            if (hoje - primeira).days >= DIAS_DE_ESPERA and d < hoje:
                sem_pregao.add(iso)
                espera.pop(iso, None)
            else:
                pendentes.append(iso)
            continue
        r.raise_for_status()
        for mes, tickers in agregar(linhas_do_zip(destino), cat).items():
            destino_mes = mes_processado.setdefault(
                mes, _a_partir_da_particao(p) if (p := ler_particao(mes, pasta)) else {}
            )
            for t, a in tickers.items():
                acum = destino_mes.setdefault(t, Agregado())
                acum.nome, acum.tipo, acum.isin = acum.nome or a.nome, a.tipo, a.isin or acum.isin
                acum.volume_centavos += a.volume_centavos
                acum.negocios += a.negocios
                acum.primeiro = min(acum.primeiro or a.primeiro, a.primeiro)
                if (a.ultimo, 1) >= acum._chave_preco:
                    acum._chave_preco, acum.preco = (a.ultimo, 1), a.preco
                acum.ultimo = max(acum.ultimo, a.ultimo)
        processados.add(iso)
        novos.append(iso)
        espera.pop(iso, None)
    for mes, tickers in mes_processado.items():
        atual = ler_particao(mes, pasta)
        if atual and atual["fonte"] == "mensal":
            continue  # o oficial já chegou; o diário não sobrescreve
        dias = sorted({d for d in processados if d.startswith(mes)})
        gravar_particao(mes, tickers, "diario", dias, pasta)
    state.set("processados", sorted(processados))
    state.set("espera", dict(sorted(espera.items())))
    state.set("sem_pregao", sorted(sem_pregao))
    state.set("inicio", inicio.isoformat())
    return {"novos": novos, "pendentes": pendentes, "sem_pregao": sorted(sem_pregao)}
