"""Resolução de entidade: nome/CNPJ de um escriturador ou depositária -> instituição canônica.

Fonte única: `config/instituicoes.yaml`. Ordem (decisão da Fase 0, `docs/decisoes/0000-*.md`;
o nome vence o CNPJ porque o FCA traz CNPJs trocados entre instituições do mesmo grupo):

1. nome vazio                              -> `nao-informado`
2. alias exato (sem acento/pontuação)      -> instituição
3. padrões regex sobre o nome, na ordem do arquivo
4. "Própria empresa": literal `EMPRESA` da B3, CNPJ de mesma raiz da companhia, ou nome coincidente
5. raiz do CNPJ (8 dígitos, une filiais)    -> instituição
6. nenhum                                  -> `nao-mapeado` (vai para o relatório de qualidade)
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

import yaml
from pydantic import BaseModel, Field

from painel_etl import paths
from painel_etl.normalize import cnpj as cnpj_mod
from painel_etl.normalize.text import fold, significant_words

PROPRIA = "propria-empresa"
NAO_INFORMADO = "nao-informado"
NAO_IDENTIFICADO = "nao-identificado"
NAO_MAPEADO = "nao-mapeado"
RESERVADOS = {PROPRIA, NAO_INFORMADO, NAO_IDENTIFICADO, NAO_MAPEADO}


class InstituicaoModel(BaseModel):
    id: str
    nome: str
    nome_curto: str
    cnpjs: list[str] = Field(default_factory=list)
    aliases: list[str] = Field(default_factory=list)
    padroes: list[str] = Field(default_factory=list)
    cor: str
    cor_depositaria: str | None = None
    papeis: list[str]


@dataclass(frozen=True)
class Resolucao:
    id: str
    via: str  # alias | padrao | propria | cnpj | vazio | nenhuma


class Registro:
    def __init__(self, itens: list[InstituicaoModel]) -> None:
        self.itens = itens
        self._por_id = {i.id: i for i in itens}
        if len(self._por_id) != len(itens):
            raise ValueError("ids duplicados em instituicoes.yaml")
        self._aliases: dict[str, str] = {}
        self._padroes: list[tuple[re.Pattern[str], str]] = []
        self._raizes: dict[str, set[str]] = {}
        for i in itens:
            for a in i.aliases:
                self._aliases[fold(a)] = i.id
            for p in i.padroes:
                self._padroes.append((re.compile(p), i.id))
            for c in i.cnpjs:
                self._raizes.setdefault(cnpj_mod.root(c), set()).add(i.id)

    @classmethod
    def carregar(cls, caminho: Path | None = None) -> Registro:
        caminho = caminho or paths.config_dir() / "instituicoes.yaml"
        bruto = yaml.safe_load(caminho.read_text(encoding="utf-8"))
        return cls([InstituicaoModel.model_validate(x) for x in bruto])

    def por_id(self, id_: str) -> InstituicaoModel:
        return self._por_id[id_]

    def nome_curto(self, id_: str, fallback: str = "") -> str:
        item = self._por_id.get(id_)
        return item.nome_curto if item else fallback

    def resolver(
        self,
        nome: str | None,
        *,
        cnpj: str | None = None,
        empresa_nome: str | None = None,
        empresa_cnpj: str | None = None,
    ) -> Resolucao:
        n = fold(nome)
        if not n and not cnpj_mod.digits(cnpj):
            return Resolucao(NAO_INFORMADO, "vazio")
        if n == "empresa":
            return Resolucao(PROPRIA, "propria")
        if n in self._aliases:
            return Resolucao(self._aliases[n], "alias")
        for rx, id_ in self._padroes:
            if rx.search(n):
                return Resolucao(id_, "padrao")
        if empresa_cnpj and cnpj and cnpj_mod.root(cnpj) == cnpj_mod.root(empresa_cnpj):
            return Resolucao(PROPRIA, "propria")
        a, b = significant_words(nome), significant_words(empresa_nome)
        if a and b and (a[0] == b[0] or any(w in b for w in a[:2])):
            return Resolucao(PROPRIA, "propria")
        candidatos = self._raizes.get(cnpj_mod.root(cnpj), set())
        if len(candidatos) == 1:
            return Resolucao(next(iter(candidatos)), "cnpj")
        return Resolucao(NAO_MAPEADO, "nenhuma")
