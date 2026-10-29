"""Apoio aos workflows: mensagem de commit e resumo (Job Summary) a partir do relatório da execução."""

from __future__ import annotations

from typing import Any

Relatorio = dict[str, Any]


def mensagem_commit(rel: Relatorio) -> str:
    """`data(acoes,bdrs): atualização 2026-10-29 [+3 eventos]` (seção 9.2 do prompt)."""
    publicados = [r["dataset"] for r in rel["resultados"] if r["publicado"] and r["dataset"] in ("acoes", "bdrs")]
    eventos = sum(r["eventos"] for r in rel["resultados"])
    return f"data({','.join(publicados) or 'estado'}): atualização {rel['data']} [+{eventos} eventos]"


def resumo_markdown(rel: Relatorio) -> str:
    """Resumo para `$GITHUB_STEP_SUMMARY`."""
    linhas = [
        f"## ETL de {rel['data']}",
        "",
        "| dataset | situação | registros | eventos | mudou |",
        "|---|---|---|---|---|",
    ]
    for r in rel["resultados"]:
        situacao = "✅ publicado" if r["publicado"] else "❌ não publicado"
        linhas.append(
            f"| {r['dataset']} | {situacao} | {r['contagem']} | {r['eventos']} | {'sim' if r['mudou'] else 'não'} |"
        )
    for r in rel["resultados"]:
        detalhes = []
        if r["erro"]:
            detalhes.append(f"- **erro:** {r['erro']}")
        detalhes += [f"- **{i['nivel']}** `{i['codigo']}`: {i['mensagem']}" for i in _issues(r)]
        detalhes += [f"- aviso: {a}" for a in r["avisos"] if not a.startswith("Traceback")]
        fontes_ruins = [
            f"`{k}` ({v['status']}): {v.get('mensagem', '')}" for k, v in r["fontes"].items() if v["status"] != "ok"
        ]
        detalhes += [f"- fonte {f}" for f in fontes_ruins]
        if detalhes:
            linhas += ["", f"### {r['dataset']}", *detalhes]
    return "\n".join(linhas) + "\n"


def _issues(r: dict[str, Any]) -> list[dict[str, str]]:
    q = r["qualidade"]
    return [{"nivel": "erro", **i} for i in q["erros"]] + [{"nivel": "aviso", **i} for i in q["avisos"]]


def falhou(rel: Relatorio) -> bool:
    """A execução deve sair com erro se algum dataset não foi publicado ou deu erro."""
    return any(r["erro"] or not r["publicado"] for r in rel["resultados"])
