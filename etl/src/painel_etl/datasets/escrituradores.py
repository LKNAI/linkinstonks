"""Histórico de escrituradores de uma companhia a partir do FCA (seção 7.2, ajustada na Fase 0/2).

Diferenças em relação ao texto original do prompt, validadas contra o seed (427 companhias):

- Um documento pode ter MAIS DE UMA linha (o escriturador antigo com `Data_Fim_Atuacao` e o novo). O
  "atual" é a linha do documento mais recente SEM data de fim (ou, na falta, a de maior início).
- A instituição é resolvida pelo NOME antes do CNPJ (`normalize/instituicoes.py`).
- Início do atual: último `Data_Inicio_Atuacao` informado; sem data, `inicio_aproximado` = 1º ano em que aparece.
- Início do anterior: PRIMEIRA data informada; fim: última data de fim informada.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from painel_etl.normalize.instituicoes import NAO_MAPEADO, Registro
from painel_etl.normalize.text import fold
from painel_etl.sources.cvm_fca import FcaRow


@dataclass
class Passagem:
    chave: str  # id da instituição, ou "?:<nome>" se não mapeada
    nome: str
    primeiro_ano: int
    ultimo_ano: int
    inicio_primeiro: str = ""
    inicio_ultimo: str = ""
    fim: str = ""
    nao_mapeado: bool = False


@dataclass
class Historico:
    atual: Passagem
    inicio: str
    inicio_aproximado: bool
    anterior: Passagem | None
    passagens: list[Passagem] = field(default_factory=list)

    @property
    def n(self) -> int:
        return len(self.passagens)


def derivar(linhas: list[FcaRow], registro: Registro) -> Historico | None:
    if not linhas:
        return None
    por_doc: dict[str, list[FcaRow]] = {}
    for r in linhas:
        por_doc.setdefault(r.referencia, []).append(r)

    passagens: dict[str, Passagem] = {}

    def chave_de(r: FcaRow) -> tuple[str, str, bool]:
        res = registro.resolver(r.escriturador, cnpj=r.cnpj_escriturador, empresa_nome=r.empresa, empresa_cnpj=r.cnpj)
        if res.id == NAO_MAPEADO:
            return f"?:{fold(r.escriturador)}", r.escriturador.title(), True
        return res.id, registro.nome_curto(res.id), False

    for ref in sorted(por_doc):
        for r in por_doc[ref]:
            chave, nome, nm = chave_de(r)
            p = passagens.setdefault(chave, Passagem(chave, nome, r.ano, r.ano, nao_mapeado=nm))
            p.ultimo_ano = r.ano
            p.inicio_primeiro = p.inicio_primeiro or r.inicio
            p.inicio_ultimo = r.inicio or p.inicio_ultimo
            p.fim = r.fim or p.fim

    ultimo_doc = por_doc[max(por_doc)]
    candidatos = sorted(
        ((r.fim == "", r.inicio, chave_de(r)[0]) for r in ultimo_doc),
        reverse=True,
    )
    atual = passagens[candidatos[0][2]]
    aproximado = not atual.inicio_ultimo
    inicio = atual.inicio_ultimo or f"{atual.primeiro_ano}-01-01"

    outros = sorted(
        (p for p in passagens.values() if p.chave != atual.chave),
        key=lambda p: (p.ultimo_ano, p.fim, p.chave),
        reverse=True,
    )
    ordem = sorted(passagens.values(), key=lambda p: (p.primeiro_ano, p.inicio_primeiro))
    return Historico(atual, inicio, aproximado, outros[0] if outros else None, ordem)
