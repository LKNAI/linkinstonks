from __future__ import annotations

import datetime as dt
from pathlib import Path

from painel_etl import pipeline, seed_import
from painel_etl.core import io as pio


def ctx(raiz: Path, hoje: dt.date) -> pipeline.Contexto:
    return pipeline.Contexto(hoje=hoje, raiz=raiz, cache=raiz / "cache")


def resultado(status: str = "ok", mudou: bool = False) -> pipeline.Resultado:
    return pipeline.Resultado(
        "acoes", publicado=True, mudou=mudou, contagem=10, fontes={"b3_listed": {"status": status, "contagem": 10}}
    )


class TestMeta:
    def test_dia_sem_mudanca_nao_reescreve_o_meta(self, tmp_path: Path) -> None:
        """ "Uma execução sem mudança na fonte não gera commit": o meta só muda com mudança ou batimento."""
        assert pipeline.atualizar_meta(ctx(tmp_path, dt.date(2026, 10, 29)), [resultado(mudou=True)]) is True
        antes = (tmp_path / "public" / "meta.json").read_bytes()
        assert pipeline.atualizar_meta(ctx(tmp_path, dt.date(2026, 10, 30)), [resultado()]) is False
        assert pipeline.atualizar_meta(ctx(tmp_path, dt.date(2026, 10, 31)), [resultado()]) is False
        assert (tmp_path / "public" / "meta.json").read_bytes() == antes

    def test_batimento_a_cada_tres_dias(self, tmp_path: Path) -> None:
        pipeline.atualizar_meta(ctx(tmp_path, dt.date(2026, 10, 29)), [resultado(mudou=True)])
        assert pipeline.atualizar_meta(ctx(tmp_path, dt.date(2026, 11, 1)), [resultado()]) is True
        meta = pio.read_json(tmp_path / "public" / "meta.json")
        assert meta["fontes"]["b3_listed"]["ultimo_sucesso"] == "2026-11-01"

    def test_fonte_com_erro_nao_atualiza_o_ultimo_sucesso(self, tmp_path: Path) -> None:
        pipeline.atualizar_meta(ctx(tmp_path, dt.date(2026, 10, 29)), [resultado(mudou=True)])
        pipeline.atualizar_meta(ctx(tmp_path, dt.date(2026, 11, 5)), [resultado(status="erro")])
        f = pio.read_json(tmp_path / "public" / "meta.json")["fontes"]["b3_listed"]
        assert (f["status"], f["ultimo_sucesso"]) == ("erro", "2026-10-29")


class TestValidacao:
    def test_arquivos_ausentes_sao_apontados(self, tmp_path: Path) -> None:
        erros = pipeline.validar_publicados(tmp_path)
        assert len(erros) == len(pipeline.ARQUIVOS) and all("ausente" in e for e in erros)

    def test_publicados_validos_e_violacao_de_schema(self, tmp_path: Path) -> None:
        seed_import.importar(destino=tmp_path / "public")
        pipeline.publicar_instituicoes(ctx(tmp_path, dt.date(2026, 10, 29)))
        pipeline.publicar_eventos(ctx(tmp_path, dt.date(2026, 10, 29)))
        pipeline.atualizar_meta(ctx(tmp_path, dt.date(2026, 10, 29)), [resultado(mudou=True)])
        pio.write_json(
            tmp_path / "public" / "acoes_historico_escrituradores.json", {"schema_version": 1, "companhias": {}}, 0
        )
        meses = [f"2024-{m:02d}" for m in range(11, 13)] + [f"2025-{m:02d}" for m in range(1, 13)] + [
            f"2026-{m:02d}" for m in range(1, 11)
        ]  # fmt: skip
        pio.write_json(
            tmp_path / "public" / "acoes_volume.json",
            {
                "schema_version": 1, "meses": meses[:24], "mes_parcial": None, "companhias": [],
                "pagina_fonte": "https://www.b3.com.br/", "nao_atribuido": {"tickers": 0, "volume_mensal": [0] * 24},
                "fontes_volume": {m: {"tipo": "mensal", "arquivos": ["https://exemplo.test/x.zip"]} for m in meses[:24]},
            },
            0,
        )  # fmt: skip
        assert pipeline.validar_publicados(tmp_path) == []

        doc = pio.read_json(tmp_path / "public" / "bdrs.json")
        doc["bdrs"][0]["volume_mensal"] = doc["bdrs"][0]["volume_mensal"][:5]  # fora do contrato
        pio.write_json(tmp_path / "public" / "bdrs.json", doc, 0)
        erros = pipeline.validar_publicados(tmp_path)
        assert len(erros) == 1 and erros[0].startswith("bdrs.json: bdrs/0/volume_mensal")

    def test_resumo_markdown(self, tmp_path: Path) -> None:
        pipeline.atualizar_meta(ctx(tmp_path, dt.date(2026, 10, 29)), [resultado(mudou=True)])
        md = pipeline.resumo_markdown(tmp_path)
        assert "| b3_listed | ok | 2026-10-29 |" in md and "| acoes | 2026-10-29 | 10 |" in md


def test_meta_nao_guarda_contadores_da_execucao(tmp_path: Path) -> None:
    """Contadores que variam por execução (ex.: pregões novos) fariam o meta mudar todo dia e gerar commit."""
    r = pipeline.Resultado(
        "bdrs", publicado=True, fontes={"b3_cotahist": {"status": "ok", "ultimo_pregao": "2026-10-28"}}
    )
    pipeline.atualizar_meta(ctx(tmp_path, dt.date(2026, 10, 29)), [r])
    antes = (tmp_path / "public" / "meta.json").read_bytes()
    assert pipeline.atualizar_meta(ctx(tmp_path, dt.date(2026, 10, 30)), [r]) is False
    assert (tmp_path / "public" / "meta.json").read_bytes() == antes
