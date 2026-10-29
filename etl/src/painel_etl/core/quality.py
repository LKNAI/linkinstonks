"""Portões de qualidade (seção 8). Se qualquer um falhar, o dataset NÃO é publicado e o anterior permanece."""

from __future__ import annotations

import datetime as dt
from collections import Counter
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any, Literal

from painel_etl.normalize import cnpj as cnpj_mod

Nivel = Literal["erro", "aviso"]


@dataclass(frozen=True)
class Issue:
    nivel: Nivel
    codigo: str
    mensagem: str


@dataclass
class Relatorio:
    dataset: str
    issues: list[Issue] = field(default_factory=list)

    def erro(self, codigo: str, mensagem: str) -> None:
        self.issues.append(Issue("erro", codigo, mensagem))

    def aviso(self, codigo: str, mensagem: str) -> None:
        self.issues.append(Issue("aviso", codigo, mensagem))

    @property
    def erros(self) -> list[Issue]:
        return [i for i in self.issues if i.nivel == "erro"]

    @property
    def avisos(self) -> list[Issue]:
        return [i for i in self.issues if i.nivel == "aviso"]

    @property
    def ok(self) -> bool:
        return not self.erros

    def markdown(self) -> str:
        if not self.issues:
            return f"**{self.dataset}**: sem problemas."
        linhas = [f"**{self.dataset}**: {len(self.erros)} erro(s), {len(self.avisos)} aviso(s)"]
        linhas += [f"- `{i.nivel}` `{i.codigo}`: {i.mensagem}" for i in self.issues]
        return "\n".join(linhas)


def checar_queda(rel: Relatorio, novo: int, anterior: int | None, limite: float = 0.10) -> None:
    """A contagem de registros não pode cair mais que `limite` em relação à última publicação."""
    if novo == 0:
        rel.erro("vazio", "dataset sem registros")
    elif anterior and novo < anterior * (1 - limite):
        rel.erro("queda", f"{novo} registros contra {anterior} publicados (queda > {limite:.0%})")


def checar_obrigatorios(
    rel: Relatorio, registros: Iterable[Mapping[str, Any]], campos: Sequence[str], chave: str
) -> None:
    faltando: Counter[str] = Counter()
    for r in registros:
        for c in campos:
            if r.get(c) in (None, ""):
                faltando[c] += 1
                if faltando[c] <= 3:
                    rel.erro("campo_obrigatorio", f"{c} ausente em {r.get(chave)!r}")
    for c, n in faltando.items():
        if n > 3:
            rel.erro("campo_obrigatorio", f"{c} ausente em mais {n - 3} registro(s)")


def checar_unicos(rel: Relatorio, valores: Iterable[str], rotulo: str) -> None:
    dup = [v for v, n in Counter(valores).items() if n > 1]
    if dup:
        rel.erro("duplicado", f"{rotulo} duplicado: {sorted(dup)[:5]}")


def checar_cnpjs(
    rel: Relatorio, registros: Iterable[Mapping[str, Any]], campo: str, chave: str, tolerancia: int = 0
) -> None:
    """CNPJ com dígitos verificadores válidos. Acima de `tolerancia` inválidos vira erro; até lá, aviso."""
    invalidos = [r[chave] for r in registros if r.get(campo) and not cnpj_mod.is_valid(r[campo])]
    if not invalidos:
        return
    msg = f"{len(invalidos)} CNPJ(s) inválido(s) em {campo}: {sorted(invalidos)[:5]}"
    (rel.erro if len(invalidos) > tolerancia else rel.aviso)("cnpj_invalido", msg)


def checar_datas(
    rel: Relatorio, registros: Iterable[Mapping[str, Any]], campos: Sequence[str], chave: str, hoje: dt.date
) -> None:
    """Datas ISO parseáveis e não futuras."""
    for r in registros:
        for c in campos:
            v = r.get(c)
            if not v:
                continue
            try:
                d = dt.date.fromisoformat(str(v)[:10])
            except ValueError:
                rel.erro("data_invalida", f"{c}={v!r} em {r.get(chave)!r}")
                continue
            if d > hoje:
                rel.erro("data_futura", f"{c}={v!r} em {r.get(chave)!r}")


def checar_nao_negativos(rel: Relatorio, itens: Iterable[tuple[str, float]], rotulo: str) -> None:
    ruins = [k for k, v in itens if v < 0]
    if ruins:
        rel.erro("negativo", f"{rotulo} negativo em {sorted(ruins)[:5]}")
