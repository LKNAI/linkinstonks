#!/usr/bin/env python3
"""Sonda as fontes de dados (Fase 0) e grava a resposta real como fixture.

Somente biblioteca padrão (sem dependências), para rodar igual na máquina local e no
GitHub Actions (`probe.yml`, que chama este arquivo direto com `python3`).

Uso:
    painel-etl probe [fonte ...] [--out DIR] [--report FILE]
    python etl/src/painel_etl/probe.py [fonte ...]     # sem instalar o pacote

Saída: fixtures em --out/<fonte>/ e um relatório JSON + resumo em Markdown.
Fixtures de arquivos grandes são extratos (ver etl/tests/fixtures/NOTAS.md).
"""

from __future__ import annotations

import argparse
import base64
import csv
import datetime as dt
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
import zipfile
from pathlib import Path
from typing import Any

UA = os.environ.get("PAINEL_USER_AGENT", "painel-b3-probe/0.1 (projeto de dados abertos, uso nao comercial)")
B3_API = "https://sistemaswebb3-listados.b3.com.br/listedCompaniesProxy/CompanyCall/"
CVM = "https://dados.cvm.gov.br/dados/CIA_ABERTA"
COTAHIST = "https://bvmf.bmfbovespa.com.br/InstDados/SerHist"
FIN = "https://finservices.b3.com.br"
BRAD = "https://custodia.bradesco"
ITAU = "https://www.itau.com.br/investmentservices/escrituracao/bdr"
BDR_RX = re.compile(r"^[A-Z0-9]{4}3[1-59]F?$")

RESULTS: list[dict] = []


def get(url: str, method: str = "GET", timeout: int = 60, accept: str = "*/*") -> tuple[int, dict, bytes]:
    """Uma chamada, sem retry. Devolve (status, headers, corpo); erros HTTP não levantam exceção."""
    req = urllib.request.Request(url, method=method, headers={"User-Agent": UA, "Accept": accept})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, dict(r.headers), r.read() if method != "HEAD" else b""
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read() if method != "HEAD" else b""
    except Exception as e:  # rede, DNS, TLS, timeout
        return 0, {}, f"{type(e).__name__}: {e}".encode()


def b3(method: str, params: dict) -> tuple[str, int, bytes]:
    url = B3_API + method + "/" + base64.b64encode(json.dumps(params).encode()).decode()
    st, _, body = get(url, accept="application/json")
    time.sleep(0.5)
    return url, st, body


def record(source: str, check: str, url: str, status: int, size: int, ok: bool, note: str = "") -> None:
    RESULTS.append(dict(source=source, check=check, url=url, status=status, bytes=size, ok=ok, note=note))
    print(f"[{'OK ' if ok else 'ERR'}] {source:<14} {check:<34} HTTP {status:<3} {size:>9} B  {note}")


def save(out: Path, source: str, name: str, data: bytes) -> None:
    d = out / source
    d.mkdir(parents=True, exist_ok=True)
    (d / name).write_bytes(data)


def unwrap(body: bytes) -> Any:
    """GetDetail devolve JSON dentro de uma string (dupla codificação)."""
    j = json.loads(body.decode("utf-8"))
    return json.loads(j) if isinstance(j, str) else j


# --------------------------------------------------------------------------- fontes
def probe_b3_listed(out: Path) -> None:
    s = "b3_listed"
    url, st, body = b3("GetInitialCompanies", {"language": "pt-br", "pageNumber": 1, "pageSize": 120})
    ok, note = st == 200, ""
    if ok:
        j = json.loads(body)
        note = f"totalRecords={j['page']['totalRecords']} totalPages={j['page']['totalPages']}"
        ok = bool(j["results"]) and {"codeCVM", "issuingCompany", "cnpj", "marketIndicator", "type", "segment"} <= set(
            j["results"][0]
        )
        save(out, s, "GetInitialCompanies_p1.json", body)
    record(s, "GetInitialCompanies p1", url, st, len(body), ok, note)

    # codeCVM: SANB (ação com otherCodes), HELBOR, EUROFARMA (detalhe vazio), AURA (patrocinado), CBTC (DRE)
    for code, label in [
        ("20532", "acao_SANB"),
        ("20877", "acao_HELBOR"),
        ("26700", "acao_EUROFARMA_vazio"),
        ("80187", "bdr_patrocinado_AURA"),
        ("50110", "bdr_etf_CBTC"),
    ]:
        url, st, body = b3("GetDetail", {"codeCVM": code, "language": "pt-br"})
        ok, note = st == 200, ""
        if ok:
            try:
                d = unwrap(body)
                note = "detalhe vazio {}"
                if d:
                    comum, pref = d.get("institutionCommon"), d.get("institutionPreferred")
                    note = f"institutionCommon={comum!r} institutionPreferred={pref!r}"
                ok = isinstance(d, dict)
            except Exception as e:
                ok, note = False, f"parse: {e}"
            save(out, s, f"GetDetail_{label}.json", body)
        record(s, f"GetDetail {label}", url, st, len(body), ok, note)

    url, st, body = b3(
        "GetCompaniesBDR",
        {"language": "pt-br", "pageNumber": 1, "pageSize": 120, "codeCategoryBVMF": -1, "company": ""},
    )
    ok, note = st == 200, ""
    if ok:
        j = json.loads(body)
        note = f"totalRecords={j['page']['totalRecords']}"
        ok = bool(j["results"]) and "codeCategoryBVMF" in j["results"][0]
        save(out, s, "GetCompaniesBDR_p1.json", body)
    record(s, "GetCompaniesBDR p1", url, st, len(body), ok, note)

    url, st, body = b3("GetCategoryBDRETF", {"language": "pt-br"})
    ok = st == 200 and len(unwrap(body)) > 0
    if st == 200:
        save(out, s, "GetCategoryBDRETF.json", body)
    record(s, "GetCategoryBDRETF", url, st, len(body), ok)


def probe_cvm_fca(out: Path) -> None:
    s = "cvm_fca"
    year = dt.date.today().year
    url = f"{CVM}/DOC/FCA/DADOS/fca_cia_aberta_{year}.zip"
    st, h, _ = get(url, "HEAD")
    record(
        s,
        f"HEAD fca_{year}.zip",
        url,
        st,
        int(h.get("Content-Length", 0) or 0),
        st == 200,
        f"ETag={h.get('ETag') or h.get('etag')} Last-Modified={h.get('Last-Modified')}",
    )
    st, _, body = get(url, timeout=120)
    ok, note = st == 200, ""
    if ok:
        z = zipfile.ZipFile(io.BytesIO(body))
        name = next(n for n in z.namelist() if "escriturador" in n)
        raw = z.read(name)
        rows = list(csv.DictReader(io.StringIO(raw.decode("iso-8859-1")), delimiter=";"))
        need = {
            "CNPJ_Companhia",
            "Data_Referencia",
            "Versao",
            "Escriturador",
            "CNPJ_Escriturador",
            "Data_Inicio_Atuacao",
            "Data_Fim_Atuacao",
        }
        ok = need <= set(rows[0])
        note = f"{name}: {len(rows)} linhas, iso-8859-1, colunas ok={ok}"
        save(out, s, name, raw)
    record(s, f"GET fca_{year}.zip", url, st, len(body), ok, note)
    u2010 = f"{CVM}/DOC/FCA/DADOS/fca_cia_aberta_2010.zip"
    st, _, _ = get(u2010, "HEAD")
    record(s, "HEAD fca_2010.zip (backfill)", u2010, st, 0, st == 200)


def probe_cvm_cad(out: Path) -> None:
    s = "cvm_cad"
    url = f"{CVM}/CAD/DADOS/cad_cia_aberta.csv"
    st, h, body = get(url, timeout=120)
    ok, note = st == 200, ""
    if ok:
        lines = body.splitlines()
        header = lines[0].decode("iso-8859-1").split(";")
        ok = {"CNPJ_CIA", "CD_CVM", "SIT"} <= set(header)
        note = f"{len(lines) - 1} linhas; Last-Modified={h.get('Last-Modified')}"
        save(out, s, "cad_cia_aberta_head40.csv", b"\r\n".join(lines[:41]) + b"\r\n")
    record(s, "GET cad_cia_aberta.csv", url, st, len(body), ok, note)


def probe_b3_cotahist(out: Path) -> None:
    s = "b3_cotahist"
    today = dt.date.today()
    found = None
    for back in range(0, 8):  # último arquivo diário publicado
        d = today - dt.timedelta(days=back)
        url = f"{COTAHIST}/COTAHIST_D{d:%d%m%Y}.ZIP"
        st, h, _ = get(url, "HEAD")
        record(
            s,
            f"HEAD D{d:%d%m%Y}",
            url,
            st,
            int(h.get("Content-Length", 0) or 0),
            st in (200, 404),
            f"Last-Modified={h.get('Last-Modified')}"
            if st == 200
            else "sem arquivo (fim de semana/feriado/ainda não publicado)",
        )
        if st == 200:
            found = (d, url)
            break
    if found:
        d, url = found
        st, _, body = get(url, timeout=180)
        ok, note = st == 200, ""
        if ok:
            z = zipfile.ZipFile(io.BytesIO(body))
            lines = [ln for ln in z.read(z.namelist()[0]).decode("iso-8859-1").split("\r\n") if ln]
            bdr = [ln for ln in lines if ln[:2] == "01" and BDR_RX.match(ln[12:24].strip())]
            ok = lines[0][:2] == "00" and lines[-1][:2] == "99" and all(len(ln) == 245 for ln in lines[:50])
            note = f"{len(lines)} registros, {len(bdr)} BDRs (regex), largura 245={ok}"
            extract = [lines[0], *bdr, lines[-1]]
            save(out, s, f"COTAHIST_D{d:%d%m%Y}_bdr_extrato.txt", ("\r\n".join(extract) + "\r\n").encode("iso-8859-1"))
        record(s, f"GET D{d:%d%m%Y}.ZIP", url, st, len(body), ok, note)
    prev = today.replace(day=1) - dt.timedelta(days=1)
    for label, u in [
        (f"M{prev:%m%Y}", f"{COTAHIST}/COTAHIST_M{prev:%m%Y}.ZIP"),
        (f"A{today.year - 1}", f"{COTAHIST}/COTAHIST_A{today.year - 1}.ZIP"),
    ]:
        st, h, _ = get(u, "HEAD")
        record(
            s,
            f"HEAD {label}",
            u,
            st,
            int(h.get("Content-Length", 0) or 0),
            st == 200,
            f"Last-Modified={h.get('Last-Modified')}",
        )


def probe_b3_finservices(out: Path) -> None:
    s = "b3_finservices"
    for label, path in [("drn", "bdr-nao-patrocinado/programas"), ("etf", "bdr-de-etf/programa")]:
        url = f"{FIN}/{path}?delta=1000&start=1"
        st, _, body = get(url, timeout=120)
        m = re.search(rb"<table.*?</table>", body, re.S) if st == 200 else None
        tbl = m.group(0) if m else b""
        n = len(re.findall(rb"<tr", tbl))
        ok = st == 200 and n > 100
        if tbl:
            save(out, s, f"programas_{label}_tabela.html", tbl)
        record(s, f"programas {label} (delta=1000)", url, st, len(body), ok, f"{n} <tr> na tabela")


def probe_bradesco(out: Path) -> None:
    s = "bradesco"
    gql = (
        "/graphql/execute.json/banco-bradesco/custodia-get-bdr-by-path;"
        "path=/content/dam/banco-bradesco/custodia/conteudos/pt/arquivo/brazilian-depositary-receipt"
    )
    for name, path in [
        ("home.model.json", "/content/custodia/pt.model.json"),
        ("bdr-de-etf.model.json", "/content/custodia/pt/bdr-de-etf.model.json"),
        ("bdr_graphql.json", gql),
    ]:
        url = BRAD + path
        st, _, body = get(url)
        ok, note = st == 200, ""
        if ok:
            try:
                j = json.loads(body)
                if name == "bdr_graphql.json":
                    items = j["data"]["bradescoCustodiaArquivoList"]["items"]
                    ok, note = bool(items), f"{len(items)} itens (só nome da empresa, sem ticker)"
            except Exception as e:
                ok, note = False, f"parse: {e}"
            save(out, s, name, body)
        record(s, name, url, st, len(body), ok, note)


def probe_itau(out: Path) -> None:
    s = "itau"
    st, _, body = get(ITAU)
    save(out, s, "bdr_resposta.html", body)
    record(
        s,
        "GET pagina BDR",
        ITAU,
        st,
        len(body),
        st == 200,
        "bloqueado (Access Denied) para cliente não-navegador" if st == 403 else "",
    )


SOURCES = dict(
    b3_listed=probe_b3_listed,
    cvm_fca=probe_cvm_fca,
    cvm_cad=probe_cvm_cad,
    b3_cotahist=probe_b3_cotahist,
    b3_finservices=probe_b3_finservices,
    bradesco=probe_bradesco,
    itau=probe_itau,
)


def summary_md() -> str:
    rows = ["| fonte | verificação | HTTP | resultado | observação |", "|---|---|---|---|---|"]
    for r in RESULTS:
        rows.append(f"| {r['source']} | {r['check']} | {r['status']} | {'✅' if r['ok'] else '❌'} | {r['note']} |")
    return "\n".join(rows)


DEFAULT_OUT = Path(__file__).resolve().parents[2] / "tests" / "fixtures"


def run(sources: list[str] | None = None, out: Path = DEFAULT_OUT, report: Path | None = None) -> int:
    """Sonda as fontes e devolve 0 se todas (exceto o Itaú, bloqueado) responderem como esperado."""
    unknown = [x for x in sources or [] if x not in SOURCES]
    if unknown:
        raise ValueError(f"fonte desconhecida: {unknown}")
    RESULTS.clear()
    for name in sources or SOURCES:
        print(f"== {name}")
        try:
            SOURCES[name](out)
        except Exception as e:  # uma fonte quebrada não derruba as outras
            record(name, "exceção", "", 0, 0, False, f"{type(e).__name__}: {e}")
    if report:
        report.write_text(json.dumps(RESULTS, ensure_ascii=False, indent=2), encoding="utf-8")
    md = summary_md()
    print("\n" + md)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write("## Resultado do probe\n\n" + md + "\n")
    return 0 if all(r["ok"] for r in RESULTS if r["source"] != "itau") else 1


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("sources", nargs="*", help="fontes a sondar: " + ", ".join(SOURCES) + " (padrão: todas)")
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--report", default=None, help="grava o resultado em JSON")
    a = ap.parse_args()
    reconfigure = getattr(sys.stdout, "reconfigure", None)
    if reconfigure:
        reconfigure(encoding="utf-8")  # console do Windows usa cp1252
    try:
        return run(a.sources, Path(a.out), Path(a.report) if a.report else None)
    except ValueError as e:
        ap.error(str(e))


if __name__ == "__main__":
    sys.exit(main())
