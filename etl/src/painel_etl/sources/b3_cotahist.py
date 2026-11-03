"""B3: séries históricas COTAHIST (`docs/fontes.md`, seção 4).

Três granularidades: diário (`D`), mensal (`M`, ~90 MB descompactado) e anual (`A`). Layout posicional de 245
colunas, ISO-8859-1, `\\r\\n`. Tudo em streaming, linha a linha: nunca se carrega um arquivo inteiro na memória.

Estratégia (seção 7.4):

- diário: processa os pregões ainda não vistos e acumula na partição do mês corrente;
- mensal: quando sai o arquivo do mês fechado, reconcilia (substitui) a partição; diferença > 0,5% vira alerta;
- um 404 em dia útil não é erro: tenta de novo nos 3 dias seguintes e só então considera "sem pregão".

Um único parser lê cada arquivo e alimenta todas as categorias numa passada: nenhum arquivo é baixado duas vezes.
"""

from __future__ import annotations

import datetime as dt
import statistics
import zipfile
from collections import Counter
from collections.abc import Callable, Iterable, Iterator, Mapping, Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from painel_etl import paths
from painel_etl.core import io as pio
from painel_etl.core.http import READ_TIMEOUT_COTAHIST, Http
from painel_etl.core.state import State
from painel_etl.indicadores import EstouroNegocios
from painel_etl.indicadores import carregar as carregar_indicadores
from painel_etl.normalize.tickers import base_ticker, is_acao_especie, is_acao_ticker, is_bdr_ticker

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
    detalhada: bool = False  # guarda também quantidade, fracionário e dias com negócio


BDR = Categoria("bdr", "b3_cotahist", "bdr_volume", "cotahist", lambda c, e: is_bdr_ticker(c) and "UNT" not in e)
ACAO = Categoria(
    "acao", "b3_cotahist_acoes", "acoes_liquidez", "cotahist_acoes", lambda _c, e: is_acao_especie(e), detalhada=True
)
CATEGORIAS = (BDR, ACAO)
PASTA_NEGOCIOS_SUSPEITOS = "negocios_suspeitos"


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
    quantidade: int = 0


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


def _data_iso(d: str) -> str:
    return f"{d[:4]}-{d[4:6]}-{d[6:8]}"


def _cotacao(linha: str) -> Cotacao | None:
    """Registro de vista ou fracionário, ou None. Posições 1-indexadas e inclusivas da seção 7.4."""
    if linha[:2] != "01" or linha[24:27] not in TIPOS_MERCADO:
        return None
    return Cotacao(
        data=_data_iso(linha[2:10]),
        codneg=linha[12:24].strip(),
        mercado=linha[24:27],
        nome=linha[27:39].strip(),
        especi=linha[39:49].strip(),
        preco=int(linha[108:121]) / 100,
        negocios=int(linha[147:152]),
        volume_centavos=int(linha[170:188]),
        isin=linha[230:242].strip(),
        quantidade=int(linha[152:170]),
    )


def parse_linha(linha: str, cat: Categoria = BDR) -> Cotacao | None:
    """Cotação da categoria (vista ou fracionário), ou None."""
    c = _cotacao(linha)
    return c if c and cat.aceita(c.codneg, c.especi) else None


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
    quantidade: int = 0
    volume_fracionario_centavos: int = 0
    negocios_fracionario: int = 0
    dias_anteriores: int = 0  # dias com negócio já somados numa partição carregada
    _datas: set[str] = field(default_factory=set)

    @property
    def dias_com_negocio(self) -> int:
        return self.dias_anteriores + len(self._datas)

    def somar(self, c: Cotacao) -> None:
        self.volume_centavos += c.volume_centavos
        self.negocios += c.negocios
        self.quantidade += c.quantidade
        if c.mercado == "020":
            self.volume_fracionario_centavos += c.volume_centavos
            self.negocios_fracionario += c.negocios
        if c.negocios > 0:
            self._datas.add(c.data)
        self.primeiro = min(self.primeiro or c.data, c.data)
        self.ultimo = max(self.ultimo, c.data)
        chave = (c.data, TIPOS_MERCADO[c.mercado])
        if chave > self._chave_preco:  # último pregão; no mesmo dia, o preço da vista
            self._chave_preco, self.preco = chave, c.preco
            self.nome, self.tipo, self.isin = c.nome, c.especi.split()[0], c.isin or self.isin

    def incorporar(self, a: Agregado) -> None:
        """Soma o agregado de um pregão novo ao acumulado do mês."""
        self.nome, self.tipo, self.isin = self.nome or a.nome, a.tipo, a.isin or self.isin
        self.volume_centavos += a.volume_centavos
        self.negocios += a.negocios
        self.quantidade += a.quantidade
        self.volume_fracionario_centavos += a.volume_fracionario_centavos
        self.negocios_fracionario += a.negocios_fracionario
        self._datas |= a._datas
        self.primeiro = min(self.primeiro or a.primeiro, a.primeiro)
        if (a.ultimo, 1) >= self._chave_preco:
            self._chave_preco, self.preco = (a.ultimo, 1), a.preco
        self.ultimo = max(self.ultimo, a.ultimo)

    def como_dict(self, detalhada: bool = False) -> dict[str, Any]:
        doc: dict[str, Any] = {
            "isin": self.isin,
            "negocios": self.negocios,
            "nome": self.nome,
            "primeiro_pregao": self.primeiro,
            "tipo": self.tipo,
            "ultimo_pregao": self.ultimo,
            "ultimo_preco": self.preco,
            "volume": round(self.volume_centavos / 100),
        }
        if detalhada:
            doc |= {
                "dias_com_negocio": self.dias_com_negocio,
                "negocios_fracionario": self.negocios_fracionario,
                "quantidade": self.quantidade,
                "volume_fracionario": round(self.volume_fracionario_centavos / 100),
            }
        return doc


@dataclass
class Leitura:
    """O que uma passada por um arquivo produz, para todas as categorias de uma vez."""

    meses: dict[str, dict[str, dict[str, Agregado]]]  # categoria -> mês -> ticker-base -> agregado
    datas: set[str] = field(default_factory=set)  # todas as datas do arquivo (todo o mercado)
    total_centavos: Counter[str] = field(default_factory=Counter)  # mês -> vista + fracionário de todo o mercado
    filtro_ticker_centavos: Counter[str] = field(default_factory=Counter)  # mês -> ações pelo formato do ticker
    dias: dict[tuple[str, str], list[tuple[str, int, int]]] = field(default_factory=dict)  # (mês, CODNEG) -> pregões


def ler_arquivo(linhas: Iterable[str], cats: Sequence[Categoria] = CATEGORIAS) -> Leitura:
    """O parser único: lê o arquivo uma vez e agrega cada categoria pedida. O fracionário soma no ticker-base."""
    le = Leitura(meses={c.nome: {} for c in cats})
    for linha in linhas:
        if linha[:2] != "01":
            continue
        le.datas.add(linha[2:10])
        c = _cotacao(linha)
        if c is None:
            continue
        mes = c.data[:7]
        le.total_centavos[mes] += c.volume_centavos
        if is_acao_ticker(c.codneg, c.especi):
            le.filtro_ticker_centavos[mes] += c.volume_centavos
        for cat in cats:
            if cat.aceita(c.codneg, c.especi):
                le.meses[cat.nome].setdefault(mes, {}).setdefault(base_ticker(c.codneg), Agregado()).somar(c)
        if any(cat.aceita(c.codneg, c.especi) for cat in CATEGORIAS):
            le.dias.setdefault((mes, c.codneg), []).append((c.data, c.negocios, c.quantidade))
    le.datas = {_data_iso(d) for d in le.datas}
    return le


def agregar(linhas: Iterator[str], cat: Categoria = BDR) -> dict[str, dict[str, Agregado]]:
    """mês (AAAA-MM) -> ticker-base -> agregado de uma categoria."""
    return ler_arquivo(linhas, [cat]).meses[cat.nome]


def dias_suspeitos(pregoes: Sequence[tuple[str, int, int]], cfg: EstouroNegocios) -> list[str]:
    """Pregões em que `TOTNEG` parece ter perdido o que passa do limite do campo (`docs/metodologia.md`).

    `pregoes`: (data, TOTNEG, QUATOT). O negócio típico é a mediana de QUATOT / TOTNEG dos demais pregões do mês; o
    dia é suspeito quando QUATOT / típico fica mais perto de TOTNEG + limite do que de TOTNEG. Também acusa dias com
    negócios em bloco: é um aviso de que o número pode estar subestimado, nunca uma correção. Só vale para papéis que
    já negociam muito, pois os outros não chegam perto do limite.
    """
    if len(pregoes) < cfg.dias_minimos_mes:
        return []
    saida = []
    for i, (data, neg, qtd) in enumerate(pregoes):
        outros = [(n, q) for j, (_d, n, q) in enumerate(pregoes) if j != i and n > 0]
        if not outros or statistics.median(n for n, _q in outros) < cfg.negocios_tipicos_min:
            continue
        tipico = statistics.median(q / n for n, q in outros)
        esperado = qtd / tipico if tipico else 0.0
        if esperado >= cfg.negocios_esperados_min and abs(esperado - (neg + cfg.limite_campo)) < abs(esperado - neg):
            saida.append(data)
    return saida


def _gravar_suspeitos(mes: str, leitura: Leitura, pasta: Path) -> bool:
    cfg = carregar_indicadores().estouro_negocios
    por_ticker: dict[str, set[str]] = {}
    for (m, codneg), pregoes in leitura.dias.items():
        if m == mes and (datas := dias_suspeitos(pregoes, cfg)):
            por_ticker.setdefault(base_ticker(codneg), set()).update(datas)
    doc = {"mes": mes, "tickers": {t: sorted(d) for t, d in sorted(por_ticker.items())}}
    return pio.write_json(pasta / f"{mes}.json", doc, 0)


def ler_suspeitos(mes: str, pasta: Path) -> dict[str, list[str]]:
    """Ticker -> pregões suspeitos do mês. Só existe para meses fechados (arquivo `M`)."""
    doc: dict[str, Any] = pio.read_json(pasta / f"{mes}.json", {"tickers": {}})
    return dict(doc["tickers"])


# ---------------------------------------------------------------------------- partições mensais
def particao_dir() -> Path:
    return paths.data_dir() / "history" / "bdr_volume"


def ler_particao(mes: str, pasta: Path | None = None) -> dict[str, Any] | None:
    doc: dict[str, Any] | None = pio.read_json((pasta or particao_dir()) / f"{mes}.json")
    return doc


def gravar_particao(
    mes: str,
    tickers: dict[str, Agregado],
    fonte: str,
    pregoes: list[str],
    pasta: Path | None = None,
    *,
    detalhada: bool = False,
    conferencia: Mapping[str, int] | None = None,
) -> bool:
    doc: dict[str, Any] = {
        "fonte": fonte,  # "mensal" (oficial) ou "diario" (parcial/provisório)
        "mes": mes,
        "pregoes": sorted(pregoes),
        "schema_version": "1.0" if detalhada else 1,
        "tickers": {t: a.como_dict(detalhada) for t, a in sorted(tickers.items())},
    }
    if conferencia:
        doc["conferencia"] = dict(conferencia)
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
        a.quantidade = v.get("quantidade", 0)
        a.volume_fracionario_centavos = v.get("volume_fracionario", 0) * 100
        a.negocios_fracionario = v.get("negocios_fracionario", 0)
        a.dias_anteriores = v.get("dias_com_negocio", 0)
        saida[t] = a
    return saida


def volume_total(tickers: dict[str, Any]) -> float:
    return float(sum(v["volume"] if isinstance(v, dict) else v.volume_centavos / 100 for v in tickers.values()))


# ---------------------------------------------------------------------------- mensal / backfill
def processar_mensal_varias(
    http: Http,
    ano: int,
    mes: int,
    *,
    cache: Path,
    alvos: Sequence[tuple[Categoria, Path]],
    reutilizar: bool = False,
) -> dict[str, dict[str, Any]]:
    """Baixa o arquivo `M` de um mês fechado uma vez e (re)grava a partição de cada categoria.

    `reutilizar`: usa o ZIP já baixado, se estiver íntegro (backfill). Devolve o resumo por categoria.
    """
    chave = f"{ano}-{mes:02d}"
    destino = cache / f"COTAHIST_M{mes:02d}{ano}.ZIP"
    if not (reutilizar and destino.exists() and zipfile.is_zipfile(destino)):
        r = http.download(url_mensal(ano, mes), destino, read_timeout=READ_TIMEOUT_COTAHIST)
        if r.status_code == 404:
            return {cat.nome: {"mes": chave, "status": "indisponivel"} for cat, _ in alvos}
        r.raise_for_status()
    leitura = ler_arquivo(linhas_do_zip(destino), [cat for cat, _ in alvos])
    pregoes = sorted(d for d in leitura.datas if d.startswith(chave))
    saida: dict[str, dict[str, Any]] = {}
    for cat, pasta in alvos:
        novo = leitura.meses[cat.nome].get(chave, {})
        antigo = ler_particao(chave, pasta)
        diff_pct = None
        if antigo and antigo["fonte"] == "diario":
            a, b = volume_total(antigo["tickers"]), volume_total(novo)
            diff_pct = abs(a - b) / b if b else None
        conferencia = None
        if cat.detalhada:
            conferencia = {
                "acoes_filtro_ticker": round(leitura.filtro_ticker_centavos[chave] / 100),
                "total_vista_fracionario": round(leitura.total_centavos[chave] / 100),
            }
        mudou = gravar_particao(chave, novo, "mensal", pregoes, pasta, detalhada=cat.detalhada, conferencia=conferencia)
        _gravar_suspeitos(chave, leitura, pasta.parent / PASTA_NEGOCIOS_SUSPEITOS)
        saida[cat.nome] = {
            "mes": chave,
            "status": "ok",
            "mudou": mudou,
            "tickers": len(novo),
            "diferenca_vs_diario": diff_pct,
            "alerta": bool(diff_pct is not None and diff_pct > TOLERANCIA_RECONCILIACAO),
        }
    return saida


def processar_mensal(
    http: Http, ano: int, mes: int, *, cache: Path, pasta: Path | None = None, cat: Categoria = BDR
) -> dict[str, Any]:
    """Atalho para uma categoria só."""
    return processar_mensal_varias(http, ano, mes, cache=cache, alvos=[(cat, pasta or particao_dir())])[cat.nome]


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


@dataclass
class _Diario:
    """Estado de uma categoria durante a passada pelos arquivos diários."""

    cat: Categoria
    pasta: Path
    state: State
    inicio: dt.date
    processados: set[str]
    espera: dict[str, str]
    sem_pregao: set[str]
    novos: list[str] = field(default_factory=list)
    pendentes: list[str] = field(default_factory=list)
    meses: dict[str, dict[str, Agregado]] = field(default_factory=dict)


def processar_diario_varias(
    http: Http, hoje: dt.date, *, cache: Path, alvos: Sequence[tuple[Categoria, Path, State]]
) -> dict[str, dict[str, Any]]:
    """Processa os pregões pendentes até `hoje`, cada arquivo uma só vez, e acumula na partição do mês.

    Estado por categoria (`data/state/<estado>.json`): `processados` (datas já somadas), `espera` (data -> 1ª vez que
    deu 404) e `sem_pregao` (feriados confirmados depois da espera de 3 dias).
    """
    estados = [
        _Diario(
            cat, pasta, state,
            dt.date.fromisoformat(state.get("inicio", hoje.replace(day=1).isoformat())),
            set(state.get("processados", [])), dict(state.get("espera", {})), set(state.get("sem_pregao", [])),
        )
        for cat, pasta, state in alvos
    ]  # fmt: skip
    for d in dias_uteis(min(e.inicio for e in estados), hoje):
        iso = d.isoformat()
        quem = [e for e in estados if d >= e.inicio and iso not in e.processados and iso not in e.sem_pregao]
        if not quem:
            continue
        destino = cache / f"COTAHIST_D{d:%d%m%Y}.ZIP"
        r = http.download(url_diario(d), destino)
        if r.status_code == 404:
            for e in quem:
                primeira = dt.date.fromisoformat(e.espera.setdefault(iso, hoje.isoformat()))
                if (hoje - primeira).days >= DIAS_DE_ESPERA and d < hoje:
                    e.sem_pregao.add(iso)
                    e.espera.pop(iso, None)
                else:
                    e.pendentes.append(iso)
            continue
        r.raise_for_status()
        leitura = ler_arquivo(linhas_do_zip(destino), [e.cat for e in quem])
        for e in quem:
            for mes, tickers in leitura.meses[e.cat.nome].items():
                destino_mes = e.meses.setdefault(
                    mes, _a_partir_da_particao(p) if (p := ler_particao(mes, e.pasta)) else {}
                )
                for t, a in tickers.items():
                    destino_mes.setdefault(t, Agregado()).incorporar(a)
            e.processados.add(iso)
            e.novos.append(iso)
            e.espera.pop(iso, None)
    saida = {}
    for e in estados:
        for mes, tickers in e.meses.items():
            atual = ler_particao(mes, e.pasta)
            if atual and atual["fonte"] == "mensal":
                continue  # o oficial já chegou; o diário não sobrescreve
            dias = sorted({d for d in e.processados if d.startswith(mes)})
            gravar_particao(mes, tickers, "diario", dias, e.pasta, detalhada=e.cat.detalhada)
        e.state.set("processados", sorted(e.processados))
        e.state.set("espera", dict(sorted(e.espera.items())))
        e.state.set("sem_pregao", sorted(e.sem_pregao))
        e.state.set("inicio", e.inicio.isoformat())
        saida[e.cat.nome] = {"novos": e.novos, "pendentes": e.pendentes, "sem_pregao": sorted(e.sem_pregao)}
    return saida


def processar_diario(
    http: Http, state: State, hoje: dt.date, *, cache: Path, pasta: Path | None = None, cat: Categoria = BDR
) -> dict[str, Any]:
    """Atalho para uma categoria só."""
    return processar_diario_varias(http, hoje, cache=cache, alvos=[(cat, pasta or particao_dir(), state)])[cat.nome]
