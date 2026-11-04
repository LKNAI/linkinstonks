"""Orquestração: fetch -> parse -> normalize -> validate -> diff -> publicar (seção 8 do prompt).

Princípios:
- fonte com erro nunca derruba as outras nem sobrescreve o último dado bom (status `erro`/`desatualizado`);
- portão de qualidade reprovado => o dataset não é publicado;
- execução sem mudança nos dados => nenhum arquivo muda (e, portanto, nenhum commit).
"""

from __future__ import annotations

import datetime as dt
import json
import traceback
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from painel_etl import paths
from painel_etl.core import diff, quality, schema
from painel_etl.core import io as pio
from painel_etl.core.http import Http
from painel_etl.core.state import State
from painel_etl.datasets import acoes as ds_acoes
from painel_etl.datasets import acoes_liquidez as ds_liquidez
from painel_etl.datasets import bdrs as ds_bdrs
from painel_etl.datasets import relatorio_mensal as ds_relatorio
from painel_etl.datasets import snapshots_site as ds_snapshots
from painel_etl.datasets import valores_mobiliarios as ds_valores
from painel_etl.indicadores import carregar as carregar_indicadores
from painel_etl.normalize.instituicoes import Registro
from painel_etl.sources import b3_cotahist, b3_finservices, bradesco_bdr, cvm_cad, cvm_fca
from painel_etl.sources.b3_listed import B3Listed, CompanyDetail, EtfRow, ListedCompany

SCHEMA_VERSION = "1.1"
SCHEMA_VERSION_NOVOS = "1.0"  # arquivos criados na Fase 8
SCHEMA_VERSION_INSTITUICOES = "1.2"  # 1.2: campo `aliases`, usado pela busca global
HEARTBEAT_DIAS = 2  # meta.json só é regravado sem mudança de dados a cada (HEARTBEAT_DIAS + 1) dias
QUEDA_SCRAPER = 0.20
SPONSORED = {"DR1", "DR2", "DR3"}
DATASETS_PUBLICADOS = ("acoes", "bdrs", "acoes_liquidez")  # o meta deixa de listar o que saiu (como acoes_volume)


def pub(raiz: Path | None = None) -> Path:
    return (raiz or paths.data_dir()) / "public"


@dataclass
class Contexto:
    hoje: dt.date
    dry_run: bool = False
    semanal: bool = False
    raiz: Path = field(default_factory=paths.data_dir)
    cache: Path = field(default_factory=paths.cache_dir)
    http: Callable[[str], Http] = Http
    listadas: list[ListedCompany] | None = None
    cotahist: dict[str, dict[str, Any]] | None = None  # resultado da passada única pelos arquivos da B3


@dataclass
class Resultado:
    dataset: str
    publicado: bool = False
    mudou: bool = False
    contagem: int = 0
    eventos: int = 0
    relatorio: quality.Relatorio | None = None
    erro: str = ""
    avisos: list[str] = field(default_factory=list)
    fontes: dict[str, dict[str, Any]] = field(default_factory=dict)
    nao_mapeados: list[str] = field(default_factory=list)

    def como_dict(self) -> dict[str, Any]:
        """Forma serializável para o relatório da execução (`--report-json`)."""
        q = self.relatorio
        return {
            "dataset": self.dataset,
            "publicado": self.publicado,
            "mudou": self.mudou,
            "contagem": self.contagem,
            "eventos": self.eventos,
            "erro": self.erro,
            "avisos": self.avisos,
            "fontes": self.fontes,
            "nao_mapeados": self.nao_mapeados,
            "qualidade": {
                "erros": [{"codigo": i.codigo, "mensagem": i.mensagem} for i in q.erros] if q else [],
                "avisos": [{"codigo": i.codigo, "mensagem": i.mensagem} for i in q.avisos] if q else [],
            },
        }


def _listadas(ctx: Contexto) -> list[ListedCompany]:
    if ctx.listadas is None:
        ctx.listadas = B3Listed(ctx.http("b3_listed")).listar()
    return ctx.listadas


def _indexar(itens: list[dict[str, Any]], chave: str) -> dict[str, dict[str, Any]]:
    return {x[chave]: x for x in itens}


def _escrever(ctx: Contexto, caminho: Path, obj: Any, indent: int | None) -> bool:
    return False if ctx.dry_run else pio.write_json(caminho, obj, indent)


# ------------------------------------------------------------------------------------------ ações
def run_acoes(ctx: Contexto) -> Resultado:
    res = Resultado("acoes")
    reg = Registro.carregar()
    destino = pub(ctx.raiz) / "acoes.json"
    previo_doc = pio.read_json(destino, {"companhias": []})
    previo = _indexar(previo_doc["companhias"], "codigo_cvm")
    try:
        listadas = _listadas(ctx)
        res.fontes["b3_listed"] = {"status": "ok", "contagem": len(listadas)}
    except Exception as e:
        res.erro = f"b3_listed: {e}"
        res.fontes["b3_listed"] = {"status": "erro", "mensagem": str(e)[:200]}
        return res

    # FCA: o ano corrente é verificado por ETag; os anos fechados vêm de data/history/fca (backfill)
    state_fca = State("cvm_fca", ctx.raiz / "state")
    pasta_vm = cvm_fca.valores_mobiliarios_dir(ctx.raiz)
    try:
        if not ctx.dry_run:
            artefato = cvm_fca.fetch_ano(ctx.http("cvm_fca"), ctx.hoje.year, state=state_fca, cache=ctx.cache)
            if artefato and artefato.mudou:
                cvm_fca.salvar_particao(ctx.hoje.year, list(cvm_fca.parse_zip(artefato.path)))
                cvm_fca.salvar_valores_mobiliarios(
                    ctx.hoje.year, list(cvm_fca.parse_valor_mobiliario(artefato.path)), pasta_vm
                )
            state_fca.save()
        res.fontes["cvm_fca"] = {"status": "ok"}
    except Exception as e:
        res.avisos.append(f"cvm_fca indisponível; usando o último histórico: {e}")
        res.fontes["cvm_fca"] = {"status": "desatualizado", "mensagem": str(e)[:200]}

    state_cad = State("cvm_cad", ctx.raiz / "state")
    try:
        if not ctx.dry_run and (ctx.semanal or not state_cad.get("companhias")):
            cvm_cad.atualizar(ctx.http("cvm_cad"), state_cad)
            state_cad.save()
        res.fontes["cvm_cad"] = {"status": "ok"}
    except Exception as e:
        res.fontes["cvm_cad"] = {"status": "desatualizado", "mensagem": str(e)[:200]}
    cad = state_cad.get("companhias", {})

    acoes_b3 = [c for c in listadas if c.tipo == ds_acoes.TIPO_ACOES]
    codigos = (
        [c.codigo_cvm for c in acoes_b3] if ctx.semanal else ds_acoes.codigos_para_detalhe(acoes_b3, previo, ctx.hoje)
    )
    try:
        detalhes: dict[str, CompanyDetail | None] = B3Listed(ctx.http("b3_listed")).detalhes(codigos)
    except Exception as e:
        res.avisos.append(f"GetDetail falhou; mantendo detalhes anteriores: {e}")
        detalhes = {}
    valores = cvm_fca.carregar_valores_mobiliarios(pasta_vm)
    companhias, historico, nao_mapeados = ds_acoes.construir(
        acoes_b3, detalhes, cvm_fca.carregar_historico(), cad, reg, previo, valores
    )
    _classificar_liquidez(ctx, res, companhias, valores, previo)
    res.nao_mapeados = nao_mapeados
    if nao_mapeados:
        res.avisos.append(f"escrituradores não mapeados (incluir em config/instituicoes.yaml): {nao_mapeados}")

    rel = ds_acoes.validar(companhias, len(previo) or None, ctx.hoje)
    res.relatorio, res.contagem = rel, len(companhias)
    if not rel.ok:
        return res
    doc = {"companhias": companhias, "schema_version": SCHEMA_VERSION}
    schema.validar("acoes", doc)
    eventos = diff.diff_acoes(previo, _indexar(companhias, "codigo_cvm"), ctx.hoje)
    if not ctx.dry_run:
        res.mudou |= pio.write_json(destino, doc, 0)
        doc_hist = {"companhias": historico, "schema_version": SCHEMA_VERSION}
        schema.validar("acoes_historico_escrituradores", doc_hist)
        res.mudou |= pio.write_json(pub(ctx.raiz) / "acoes_historico_escrituradores.json", doc_hist, 0)
        doc_seg = {
            "companhias": ds_acoes.historico_segmentos(companhias, valores),
            "schema_version": SCHEMA_VERSION_NOVOS,
        }
        schema.validar("acoes_historico_segmentos", doc_seg)
        res.mudou |= pio.write_json(pub(ctx.raiz) / "acoes_historico_segmentos.json", doc_seg, 0)
        res.mudou |= pio.write_csv(
            pub(ctx.raiz) / "downloads" / "acoes.csv", ds_acoes.CSV_COLUNAS, ds_acoes.csv_linhas(companhias)
        )
        res.eventos = pio.append_jsonl(ctx.raiz / "events" / f"{ctx.hoje.year}.jsonl", eventos)
    res.publicado = True
    return res


def _tickers_historicos(
    ctx: Contexto, res: Resultado, companhias: list[dict[str, Any]], valores: dict[str, Any]
) -> dict[str, str]:
    """Ticker antigo -> companhia, pelo FCA e pela curadoria manual (`config/overrides/tickers_historicos.csv`)."""
    atuais = {t["ticker"] for c in companhias for t in c["tickers"]}
    por_cnpj = {"".join(ch for ch in c["cnpj"] if ch.isdigit()): c["codigo_cvm"] for c in companhias}
    mapa, ambiguos = ds_valores.tickers_historicos(valores, por_cnpj, atuais, ds_valores.ler_overrides_tickers())
    if ambiguos:
        res.avisos.append(f"tickers antigos com mais de uma companhia no FCA, não atribuídos: {ambiguos}")
    return mapa


def _classificar_liquidez(
    ctx: Contexto,
    res: Resultado,
    companhias: list[dict[str, Any]],
    valores: dict[str, Any],
    previo: dict[str, dict[str, Any]],
) -> None:
    """Preenche `liquidez` em cada companhia. Sem partições completas, mantém a última classificação boa."""
    _atualizar_cotahist(ctx)
    meses = ds_bdrs.meses_fechados(ctx.hoje)
    pasta = ctx.raiz / "history" / b3_cotahist.ACAO.pasta
    particoes = {m: p for m in meses if (p := b3_cotahist.ler_particao(m, pasta))}
    if any(m not in particoes for m in meses):
        for c in companhias:
            c["liquidez"] = previo.get(c["codigo_cvm"], {}).get("liquidez")
        res.avisos.append("liquidez: partições de ações incompletas; mantida a última classificação")
        return
    cfg = carregar_indicadores().liquidez
    historicos = _tickers_historicos(ctx, res, companhias, valores)
    for c in companhias:
        c["liquidez"] = ds_liquidez.classificar(
            [t["ticker"] for t in c["tickers"]],
            ds_liquidez.tickers_da_companhia(c, historicos),
            (c["listagem"] or {}).get("desde"),
            particoes,
            meses,
            ctx.hoje,
            cfg,
        )


# ------------------------------------------------------------------------------------------ BDRs
def _api_bdrs(ctx: Contexto, res: Resultado) -> tuple[dict[str, EtfRow], dict[str, str], dict[str, str]]:
    """Depositária (texto cru) e nome por ticker, para patrocinados e ETFs. Revisita 1/7 por dia."""
    state = State("b3_bdr_api", ctx.raiz / "state")
    itens: dict[str, dict[str, str]] = state.get("itens", {})
    b3 = B3Listed(ctx.http("b3_listed"))
    etfs_lista = b3.etfs()
    etfs = {e.emissor: e for e in etfs_lista}
    alvo = {e.codigo_cvm: e.nome for e in etfs_lista}
    alvo.update({c.codigo_cvm: c.razao_social for c in _listadas(ctx) if c.type_bdr in SPONSORED})
    pedir = [k for k in alvo if ctx.semanal or k not in itens or int(k) % 7 == ctx.hoje.toordinal() % 7]
    for codigo, det in b3.detalhes(pedir).items():
        if det and det.code:
            itens[codigo] = {"ticker": det.code, "dep": det.institution_preferred, "nome": alvo[codigo]}
    itens = {k: v for k, v in itens.items() if k in alvo}
    state.set("itens", dict(sorted(itens.items())))
    if not ctx.dry_run:
        state.save()
    res.fontes["b3_bdr_api"] = {"status": "ok", "contagem": len(itens)}
    return etfs, {v["ticker"]: v["dep"] for v in itens.values()}, {v["ticker"]: v["nome"] for v in itens.values()}


def _finservices(ctx: Contexto, res: Resultado) -> dict[str, list[b3_finservices.Programa]]:
    state = State("finservices", ctx.raiz / "state")
    guardado = {k: [b3_finservices.Programa(*x) for x in v] for k, v in state.get("programas", {}).items()}
    if not (ctx.semanal or not guardado) or ctx.dry_run:
        return guardado
    try:
        novo = b3_finservices.buscar(ctx.http("b3_finservices"))
        for tipo, lista in novo.items():  # tolerante: queda > 20% mantém a lista anterior e alerta
            antes = len(guardado.get(tipo, []))
            if antes and len(lista) < antes * (1 - QUEDA_SCRAPER):
                res.avisos.append(f"finservices {tipo}: {len(lista)} itens contra {antes}; mantida a lista anterior")
                novo[tipo] = guardado[tipo]
        state.set("programas", {k: [[p.ticker, p.nome, p.qualificado] for p in v] for k, v in novo.items()})
        state.save()
        res.fontes["b3_finservices"] = {"status": "ok", "contagem": sum(len(v) for v in novo.values())}
        return novo
    except Exception as e:
        res.fontes["b3_finservices"] = {"status": "desatualizado", "mensagem": str(e)[:200]}
        res.avisos.append(f"finservices indisponível; usando a última lista: {e}")
        return guardado


def _bradesco(ctx: Contexto, res: Resultado) -> None:
    """Detector de mudança: avisa quando entra/sai programa na lista do Bradesco (a atribuição é manual)."""
    if not ctx.semanal or ctx.dry_run:
        return
    state = State("bradesco", ctx.raiz / "state")
    try:
        atual = bradesco_bdr.buscar(ctx.http("bradesco"))
    except Exception as e:
        res.fontes["bradesco"] = {"status": "desatualizado", "mensagem": str(e)[:200]}
        return
    for rotulo, novo, antigo in (("ações", atual.acoes, state.get("acoes")), ("ETFs", atual.etfs, state.get("etfs"))):
        if antigo is not None and set(novo) != set(antigo):
            res.avisos.append(
                f"Bradesco ({rotulo}): entraram {sorted(set(novo) - set(antigo))}, saíram {sorted(set(antigo) - set(novo))};"
                " revisar config/overrides/depositarias.csv"
            )
    state.set("acoes", atual.acoes)
    state.set("etfs", atual.etfs)
    state.save()
    res.fontes["bradesco"] = {"status": "ok", "contagem": len(atual.acoes) + len(atual.etfs)}


def _atualizar_cotahist(ctx: Contexto) -> dict[str, dict[str, Any]]:
    """Atualiza as partições de todas as categorias numa só passada pelos arquivos da B3, uma vez por execução."""
    if ctx.cotahist is not None:
        return ctx.cotahist
    ctx.cotahist = {}
    if ctx.dry_run:
        return ctx.cotahist
    alvos = [
        (cat, ctx.raiz / "history" / cat.pasta, State(cat.estado, ctx.raiz / "state")) for cat in b3_cotahist.CATEGORIAS
    ]
    http = ctx.http("b3_cotahist")
    cache = ctx.cache / "b3_cotahist"
    try:
        b3_cotahist.processar_diario_varias(http, ctx.hoje, cache=cache, alvos=alvos)
        anterior = ctx.hoje.replace(day=1) - dt.timedelta(days=1)
        pendentes = [
            (cat, pasta)
            for cat, pasta, _ in alvos
            if (p := b3_cotahist.ler_particao(f"{anterior:%Y-%m}", pasta)) is None or p["fonte"] != "mensal"
        ]  # fecha o mês anterior assim que o arquivo M sair
        mensal_info: dict[str, dict[str, Any]] = {}
        if pendentes:
            mensal_info = b3_cotahist.processar_mensal_varias(
                http, anterior.year, anterior.month, cache=cache, alvos=pendentes
            )
        for cat, _pasta, state in alvos:
            state.save()
            info = {"status": "ok", "ultimo_pregao": (state.get("processados") or [""])[-1]}
            m = mensal_info.get(cat.nome, {})
            ctx.cotahist[cat.nome] = {
                "fonte": info,
                "aviso": (
                    f"COTAHIST {m['mes']} ({cat.nome}): diário e mensal diferem {m['diferenca_vs_diario']:.2%} (> 0,5%)"
                    if m.get("alerta")
                    else None
                ),
            }
    except Exception as e:
        for cat, _pasta, _state in alvos:
            ctx.cotahist[cat.nome] = {
                "fonte": {"status": "desatualizado", "mensagem": str(e)[:200]},
                "aviso": f"COTAHIST indisponível; usando as partições existentes: {e}",
            }
    return ctx.cotahist


def _cotahist(ctx: Contexto, res: Resultado, cat: b3_cotahist.Categoria = b3_cotahist.BDR) -> None:
    """Registra no resultado de um dataset o que a passada única pelos arquivos da B3 deu para a sua categoria."""
    info = _atualizar_cotahist(ctx).get(cat.nome)
    if info:
        res.fontes[cat.fonte] = info["fonte"]
        if info["aviso"]:
            res.avisos.append(info["aviso"])


def run_bdrs(ctx: Contexto) -> Resultado:
    res = Resultado("bdrs")
    reg = Registro.carregar()
    destino = pub(ctx.raiz) / "bdrs.json"
    previo_doc = pio.read_json(destino, {"bdrs": []})
    previo = _indexar(previo_doc["bdrs"], "ticker")
    _cotahist(ctx, res)
    meses = ds_bdrs.meses_fechados(ctx.hoje)
    parcial = f"{ctx.hoje:%Y-%m}"
    particoes = {
        m: p for m in [*meses, parcial] if (p := b3_cotahist.ler_particao(m, ctx.raiz / "history" / "bdr_volume"))
    }
    parcial_ok = parcial if parcial in particoes else None
    faltando = [m for m in meses if m not in particoes]
    if faltando:
        res.erro = f"partições do COTAHIST ausentes: {faltando[:3]}... (rode `painel-etl backfill cotahist`)"
        return res
    try:
        etfs, deps_api, nomes_api = _api_bdrs(ctx, res)
    except Exception as e:
        etfs, deps_api, nomes_api = {}, {}, {}
        res.avisos.append(f"API B3 de BDRs indisponível; depositárias/categorias podem estar incompletas: {e}")
        res.fontes["b3_bdr_api"] = {"status": "erro", "mensagem": str(e)[:200]}
        if previo:  # não degradar o que já foi publicado
            res.erro = "API B3 de BDRs indisponível; mantida a publicação anterior"
            return res
    fin = _finservices(ctx, res)
    _bradesco(ctx, res)
    pasta_suspeitos = ctx.raiz / "history" / b3_cotahist.PASTA_NEGOCIOS_SUSPEITOS
    suspeitos = {m: b3_cotahist.ler_suspeitos(m, pasta_suspeitos) for m in meses}
    cfg_perfil = carregar_indicadores().perfil_bdr
    bdrs, nao_mapeados = ds_bdrs.construir(
        particoes, meses, parcial_ok, etfs=etfs, deps_api=deps_api, nomes_api=nomes_api, finservices=fin,
        overrides=ds_bdrs.ler_overrides(), reg=reg, suspeitos=suspeitos, cfg_perfil=cfg_perfil,
    )  # fmt: skip
    res.nao_mapeados = nao_mapeados
    if nao_mapeados:
        res.avisos.append(f"depositárias da API não mapeadas (incluir em config/instituicoes.yaml): {nao_mapeados}")
    rel = ds_bdrs.validar(bdrs, len(previo) or None, ctx.hoje)
    res.relatorio, res.contagem = rel, len(bdrs)
    if not rel.ok:
        return res
    doc = {
        "bdrs": bdrs,
        "fontes_volume": ds_bdrs.fontes_volume(particoes, meses, parcial_ok),
        "mes_parcial": parcial_ok,
        "meses": meses,
        "min_negocios_mes": cfg_perfil.min_negocios_mes,
        "pagina_fonte": b3_cotahist.PAGINA_FONTE,
        "schema_version": SCHEMA_VERSION,
        "ticket_quartis": ds_bdrs.quartis_por_mes(particoes, meses, cfg_perfil),
    }
    schema.validar("bdrs", doc)
    eventos = diff.diff_bdrs(previo, _indexar(bdrs, "ticker"), ctx.hoje)
    if not ctx.dry_run:
        res.mudou |= pio.write_json(destino, doc, 0)
        res.mudou |= pio.write_csv(
            pub(ctx.raiz) / "downloads" / "bdrs.csv", ds_bdrs.csv_cabecalho(meses), ds_bdrs.csv_linhas(bdrs)
        )
        res.eventos = pio.append_jsonl(ctx.raiz / "events" / f"{ctx.hoje.year}.jsonl", eventos)
    res.publicado = True
    return res


def run_acoes_liquidez(ctx: Contexto) -> Resultado:
    """Liquidez mensal por ticker e por companhia (itens 8.1 e 8.2), a partir das mesmas partições do volume."""
    res = Resultado("acoes_liquidez")
    destino = pub(ctx.raiz) / "acoes_liquidez.json"
    anterior = len(pio.read_json(destino, {"companhias": []})["companhias"])
    acoes_doc = pio.read_json(pub(ctx.raiz) / "acoes.json")
    if not acoes_doc:
        res.erro = "acoes.json ausente: o cadastro de tickers vem do dataset `acoes`"
        return res
    _cotahist(ctx, res, b3_cotahist.ACAO)
    meses = ds_bdrs.meses_fechados(ctx.hoje)
    parcial = f"{ctx.hoje:%Y-%m}"
    pasta = ctx.raiz / "history" / b3_cotahist.ACAO.pasta
    particoes = {m: p for m in [*meses, parcial] if (p := b3_cotahist.ler_particao(m, pasta))}
    parcial_ok = parcial if parcial in particoes else None
    faltando = [m for m in meses if m not in particoes]
    if faltando:
        res.erro = (
            f"partições de ações do COTAHIST ausentes: {faltando[:3]}... "
            "(rode `painel-etl backfill cotahist --datasets acoes`)"
        )
        return res
    cfg = carregar_indicadores().liquidez
    valores = cvm_fca.carregar_valores_mobiliarios(cvm_fca.valores_mobiliarios_dir(ctx.raiz))
    historicos = _tickers_historicos(ctx, res, acoes_doc["companhias"], valores)
    pasta_suspeitos = ctx.raiz / "history" / b3_cotahist.PASTA_NEGOCIOS_SUSPEITOS
    suspeitos = {m: b3_cotahist.ler_suspeitos(m, pasta_suspeitos) for m in meses}
    partes = ds_liquidez.construir(particoes, meses, parcial_ok, acoes_doc["companhias"], historicos, suspeitos, cfg)
    doc = {
        **partes,
        "fontes_volume": ds_bdrs.fontes_volume(particoes, meses, parcial_ok),
        "mes_parcial": parcial_ok,
        "meses": meses,
        "pagina_fonte": b3_cotahist.PAGINA_FONTE,
        "schema_version": SCHEMA_VERSION_NOVOS,
    }
    rel = ds_liquidez.validar(doc, particoes, anterior or None, cfg)
    res.relatorio, res.contagem = rel, len(doc["companhias"])
    if not rel.ok:
        return res
    schema.validar("acoes_liquidez", doc)
    doc_resumo = {
        "companhias": ds_liquidez.resumo(doc["companhias"]),
        "fontes_volume": doc["fontes_volume"],
        "mes_parcial": parcial_ok,
        "meses": meses,
        "nao_atribuido": doc["nao_atribuido"],
        "pagina_fonte": b3_cotahist.PAGINA_FONTE,
        "pregoes_mes": doc["pregoes_mes"],
        "schema_version": SCHEMA_VERSION_NOVOS,
    }
    schema.validar("acoes_liquidez_resumo", doc_resumo)
    if not ctx.dry_run:
        res.mudou |= pio.write_json(destino, doc, 0)
        res.mudou |= pio.write_json(pub(ctx.raiz) / "acoes_liquidez_resumo.json", doc_resumo, 0)
        res.mudou |= pio.write_csv(
            pub(ctx.raiz) / "downloads" / "acoes_volume.csv",
            ds_liquidez.csv_volume_cabecalho(meses),
            ds_liquidez.csv_volume_linhas(doc["companhias"]),
        )
        categorias = {c["codigo_cvm"]: (c.get("liquidez") or {}).get("categoria") for c in acoes_doc["companhias"]}
        janelas = cfg.janelas_agregados_meses
        res.mudou |= pio.write_csv(
            pub(ctx.raiz) / "downloads" / "acoes_liquidez.csv",
            ds_liquidez.csv_cabecalho(janelas),
            ds_liquidez.csv_linhas(doc["companhias"], categorias, janelas),
        )
    res.publicado = True
    return res


# ------------------------------------------------------------------------------------------ metadados
def publicar_instituicoes(ctx: Contexto) -> bool:
    reg = Registro.carregar()
    itens = [
        {
            "aliases": i.aliases, "cnpjs": i.cnpjs, "cor": i.cor, "cor_depositaria": i.cor_depositaria, "id": i.id,
            "nome": i.nome,
            "nome_curto": i.nome_curto, "papeis": i.papeis,
        }
        for i in sorted(reg.itens, key=lambda x: x.id)
    ]  # fmt: skip
    doc = {"instituicoes": itens, "schema_version": SCHEMA_VERSION_INSTITUICOES}
    schema.validar("instituicoes", doc)
    return _escrever(ctx, pub(ctx.raiz) / "instituicoes.json", doc, 2)


def publicar_eventos(ctx: Contexto) -> bool:
    todos = []
    for arq in sorted((ctx.raiz / "events").glob("*.jsonl")):
        todos += [json.loads(x) for x in arq.read_text(encoding="utf-8").splitlines() if x]
    doc = {"eventos": diff.ultimos(todos, 500), "schema_version": SCHEMA_VERSION}
    schema.validar("eventos", doc)
    return _escrever(ctx, pub(ctx.raiz) / "eventos.json", doc, 0)


def atualizar_meta(ctx: Contexto, resultados: list[Resultado]) -> bool:
    """`meta.json` por fonte. Só é regravado se algo mudou ou se o último sucesso passou do batimento."""
    caminho = pub(ctx.raiz) / "meta.json"
    atual = {**pio.read_json(caminho, {"datasets": {}, "fontes": {}}), "schema_version": SCHEMA_VERSION}
    hoje = ctx.hoje.isoformat()
    for r in resultados:
        for nome, info in r.fontes.items():
            antigo = atual["fontes"].get(nome, {})
            novo = {**info, "ultimo_sucesso": antigo.get("ultimo_sucesso")}
            if info["status"] == "ok":
                limite = (ctx.hoje - dt.timedelta(days=HEARTBEAT_DIAS)).isoformat()
                if not antigo.get("ultimo_sucesso") or antigo["ultimo_sucesso"] < limite or r.mudou:
                    novo["ultimo_sucesso"] = hoje
            atual["fontes"][nome] = novo
        if r.publicado:
            atual["datasets"][r.dataset] = {
                "atualizado_em": hoje if r.mudou else atual["datasets"].get(r.dataset, {}).get("atualizado_em", hoje),
                "contagem": r.contagem,
            }
    atual["datasets"] = {k: v for k, v in atual["datasets"].items() if k in DATASETS_PUBLICADOS}
    schema.validar("meta", atual)
    return _escrever(ctx, caminho, atual, 2)


ARQUIVOS = {
    "acoes.json": "acoes",
    "bdrs.json": "bdrs",
    "instituicoes.json": "instituicoes",
    "eventos.json": "eventos",
    "meta.json": "meta",
    "acoes_historico_escrituradores.json": "acoes_historico_escrituradores",
    "acoes_liquidez.json": "acoes_liquidez",
    "acoes_liquidez_resumo.json": "acoes_liquidez_resumo",
    "acoes_historico_segmentos.json": "acoes_historico_segmentos",
}


def validar_publicados(raiz: Path | None = None) -> list[str]:
    """Valida cada arquivo de `data/public` contra o seu JSON Schema e o orçamento de tamanho. Vazio = tudo certo."""
    saida = []
    for relatorio in sorted((pub(raiz) / "relatorios").glob("*.json")):
        saida += [f"relatorios/{relatorio.name}: {e}" for e in schema.erros("relatorio", pio.read_json(relatorio))]
    for arquivo, nome in ARQUIVOS.items():
        caminho = pub(raiz) / arquivo
        if not caminho.exists():
            saida.append(f"{arquivo}: ausente")
            continue
        saida += [f"{arquivo}: {e}" for e in schema.erros(nome, pio.read_json(caminho))]
    limite = carregar_indicadores().orcamento.data_public_mb
    tamanho = sum(a.stat().st_size for a in pub(raiz).rglob("*") if a.is_file()) / 1_000_000
    if tamanho > limite:
        saida.append(f"data/public: {tamanho:.1f} MB, acima do orçamento de {limite} MB")
    return saida


def resumo_markdown(raiz: Path | None = None) -> str:
    """Resumo para o Job Summary do Actions e para as Issues de qualidade."""
    meta = pio.read_json(pub(raiz) / "meta.json", {"datasets": {}, "fontes": {}})
    linhas = [
        "## Painel B3: estado dos dados",
        "",
        "| fonte | status | último sucesso | observação |",
        "|---|---|---|---|",
    ]
    for nome, f in sorted(meta["fontes"].items()):
        obs = f.get("mensagem") or (f"{f['contagem']} itens" if "contagem" in f else "")
        linhas.append(f"| {nome} | {f['status']} | {f.get('ultimo_sucesso') or '-'} | {obs} |")
    linhas += ["", "| dataset | atualizado em | registros |", "|---|---|---|"]
    linhas += [f"| {n} | {d['atualizado_em']} | {d['contagem']} |" for n, d in sorted(meta["datasets"].items())]
    return "\n".join(linhas)


def run(ctx: Contexto, datasets: list[str]) -> list[Resultado]:
    resultados = []
    for nome in datasets:
        try:
            executar = {
                "acoes": run_acoes,
                "bdrs": run_bdrs,
                "acoes_liquidez": run_acoes_liquidez,
            }[nome]
            resultados.append(executar(ctx))
        except Exception as e:
            r = Resultado(nome, erro=f"{type(e).__name__}: {e}")
            r.avisos.append(traceback.format_exc(limit=3))
            resultados.append(r)
    publicar_instituicoes(ctx)
    publicar_eventos(ctx)
    atualizar_meta(ctx, resultados)
    registrar_falhas(ctx, resultados)
    return resultados


def registrar_falhas(ctx: Contexto, resultados: list[Resultado]) -> None:
    """Fonte com problema vai para o registro do mês, lido pelo relatório. Dia sem falha não gera arquivo nem commit."""
    linhas = [
        {"data": ctx.hoje.isoformat(), "fonte": nome, "status": info["status"]}
        for r in resultados
        for nome, info in sorted(r.fontes.items())
        if info["status"] != "ok"
    ]
    if linhas and not ctx.dry_run:
        pio.append_jsonl(ctx.raiz / "history" / "qualidade" / f"{ctx.hoje:%Y-%m}.jsonl", linhas)


def gerar_relatorio(ctx: Contexto, mes: str) -> Path:
    """`data/public/relatorios/AAAA-MM.json`, a partir do log de eventos e das partições do COTAHIST."""
    eventos: list[dict[str, Any]] = []
    for arq in sorted((ctx.raiz / "events").glob("*.jsonl")):
        eventos += [json.loads(x) for x in arq.read_text(encoding="utf-8").splitlines() if x]
    acoes = pio.read_json(pub(ctx.raiz) / "acoes.json", {"companhias": []})["companhias"]
    bdrs = pio.read_json(pub(ctx.raiz) / "bdrs.json", {"bdrs": []})["bdrs"]
    anterior = ds_relatorio.mes_anterior(mes)
    pasta_a, pasta_b = ctx.raiz / "history" / b3_cotahist.ACAO.pasta, ctx.raiz / "history" / "bdr_volume"
    qualidade = ctx.raiz / "history" / "qualidade" / f"{mes}.jsonl"
    falhas = [json.loads(x) for x in qualidade.read_text("utf-8").splitlines() if x] if qualidade.exists() else []
    estado = State(b3_cotahist.ACAO.estado, ctx.raiz / "state").get("processados", [])
    do_mes = [d for d in estado if d.startswith(mes)]
    cfg = carregar_indicadores().relatorio_mensal
    doc = ds_relatorio.construir(
        mes, eventos, {c["codigo_cvm"]: c["pregao"] or c["razao_social"] for c in acoes}, len(acoes), len(bdrs),
        (b3_cotahist.ler_particao(mes, pasta_a), b3_cotahist.ler_particao(anterior, pasta_a)),
        (b3_cotahist.ler_particao(mes, pasta_b), b3_cotahist.ler_particao(anterior, pasta_b)),
        falhas, do_mes or None, cfg.volume_minimo_bdr, cfg.maiores_variacoes, cfg.registro_falhas_desde,
        SCHEMA_VERSION_NOVOS,
    )  # fmt: skip
    schema.validar("relatorio", doc)
    destino = pub(ctx.raiz) / "relatorios" / f"{mes}.json"
    pio.write_json(destino, doc, 2)
    return destino


def _datas_coleta(raiz: Path) -> dict[str, str]:
    dados: dict[str, str] = pio.read_json(raiz / "history" / "snapshots" / "datas_coleta.json", {})
    return dados


def gerar_snapshot_site(ctx: Contexto, mes: str) -> list[str]:
    """Posição compacta de um mês para o site (ADR 0011). Sem snapshot real do mês, reconstitui e marca."""
    pasta = ctx.raiz / "history" / "snapshots"
    destino = ctx.raiz / "snapshots_site" / mes
    atuais = pio.read_json(pub(ctx.raiz) / "acoes.json", {"companhias": []})["companhias"]
    historico = pio.read_json(pub(ctx.raiz) / "acoes_historico_escrituradores.json", {"companhias": {}})["companhias"]
    coletas = _datas_coleta(ctx.raiz)
    real_acoes = pasta / mes / "acoes.csv.gz"
    gerados = []
    if real_acoes.exists() and mes in coletas:
        doc = ds_snapshots.acoes_real(pio.read_csv_gz(real_acoes), atuais, mes, coletas[mes], SCHEMA_VERSION_NOVOS)
    else:
        doc = ds_snapshots.acoes_reconstituido(atuais, historico, mes, SCHEMA_VERSION_NOVOS)
    schema.validar("snapshot_acoes", doc)
    pio.write_json(destino / "acoes.json", ds_snapshots.compactar(doc, "companhias"), None)
    gerados.append("acoes")

    particoes_dir = ctx.raiz / "history" / "bdr_volume"
    meses = sorted(a.stem for a in particoes_dir.glob("*.json") if a.stem <= mes)[-24:]
    primeiro = next(iter(sorted(pasta.glob("*/bdrs.csv.gz"))), None)
    real_bdrs = pasta / mes / "bdrs.csv.gz"
    if len(meses) >= 2 and primeiro:
        real = real_bdrs.exists() and mes in coletas
        doc_b = ds_snapshots.bdrs_do_mes(
            {m: p for m in meses if (p := b3_cotahist.ler_particao(m, particoes_dir))},
            meses,
            pio.read_csv_gz(real_bdrs if real else primeiro),
            mes,
            not real,
            coletas[mes] if real else None,
            SCHEMA_VERSION_NOVOS,
        )
        schema.validar("snapshot_bdrs", doc_b)
        pio.write_json(destino / "bdrs.json", ds_snapshots.compactar(doc_b, "bdrs"), None)
        gerados.append("bdrs")
    return gerados


def relatorio_execucao(ctx: Contexto, resultados: list[Resultado]) -> dict[str, Any]:
    """Relatório da execução, lido pelos passos seguintes do workflow (commit, Issues, resumo)."""
    return {"data": ctx.hoje.isoformat(), "resultados": [r.como_dict() for r in resultados]}


def mensal(ctx: Contexto) -> Resultado:
    """Rotina mensal: reconcilia o COTAHIST do mês fechado (arquivo oficial `M`) e guarda um snapshot imutável."""
    import gzip

    res = Resultado("mensal")
    anterior = ctx.hoje.replace(day=1) - dt.timedelta(days=1)
    mes = f"{anterior:%Y-%m}"
    try:
        pendentes = [
            (cat, ctx.raiz / "history" / cat.pasta)
            for cat in b3_cotahist.CATEGORIAS
            if (p := b3_cotahist.ler_particao(mes, ctx.raiz / "history" / cat.pasta)) is None or p["fonte"] != "mensal"
        ]
        resumos = (
            b3_cotahist.processar_mensal_varias(
                ctx.http("b3_cotahist"), anterior.year, anterior.month, cache=ctx.cache / "b3_cotahist", alvos=pendentes
            )
            if pendentes
            else {}
        )
        for cat, _pasta in pendentes:
            m = resumos[cat.nome]
            res.fontes[cat.fonte] = {"status": "ok" if m["status"] == "ok" else "desatualizado"}
            if m["status"] != "ok":
                res.avisos.append(f"COTAHIST mensal de {mes} ({cat.nome}) ainda não publicado")
            elif m.get("alerta"):
                res.avisos.append(
                    f"COTAHIST {mes} ({cat.nome}): diário e mensal diferem {m['diferenca_vs_diario']:.2%} (> 0,5%)"
                )
            res.mudou |= bool(m.get("mudou"))
        snap = ctx.raiz / "history" / "snapshots" / mes
        for nome in ("acoes", "bdrs", "acoes_liquidez", "acoes_volume"):
            origem = pub(ctx.raiz) / "downloads" / f"{nome}.csv"
            destino = snap / f"{nome}.csv.gz"
            if origem.exists() and not destino.exists():  # snapshot é imutável: só cria se não existir
                res.mudou |= pio.write_bytes(destino, gzip.compress(origem.read_bytes(), compresslevel=9, mtime=0))
                coletas = _datas_coleta(ctx.raiz)
                coletas.setdefault(mes, ctx.hoje.isoformat())
                pio.write_json(snap.parent / "datas_coleta.json", coletas, 2)
        res.publicado = True
    except Exception as e:
        res.erro = f"{type(e).__name__}: {e}"
    return res
