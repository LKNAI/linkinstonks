import json, re, unicodedata
from pathlib import Path

exec(open("build.py", encoding="utf-8").read().split("rows.sort")[0])  # rows, PRETTY, MKT

def nrm(s):
    return unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode().lower()

STOP = {"s", "a", "sa", "cia", "companhia", "de", "do", "da", "e", "industria", "comercio", "participacoes", "s/a", "ltda"}
def words(s):
    return [w for w in re.split(r"[^a-z0-9]+", nrm(s)) if w and w not in STOP]

def entity(raw, razao):
    """Map the B3 escriturador field to one institution name (same names used for the CVM data)."""
    if not raw: return "Não informado"
    n = nrm(raw)
    if n == "empresa": return "Própria empresa"
    if "btg" in n: return "BTG Pactual"
    if "itau corretora" in n: return "Itaú Corretora"
    if "itaubanco" in n or "itau unibanco" in n: return "Itaú Unibanco"
    if "bradesco" in n: return "Banco Bradesco"
    if n == "brasil": return "Banco do Brasil"
    if "santander" in n: return "Banco Santander"
    if "banrisul" in n: return "Banrisul"
    if "banco mercantil" in n: return "Banco Mercantil do Brasil"
    if "nordeste" in n: return "Banco do Nordeste"
    if "oliveira trust" in n: return "Oliveira Trust"
    if "vortx" in n: return "Vórtx DTVM"
    if "safra" in n: return "Banco Safra"
    if "id ctvm" in n: return "ID CTVM"
    # the company itself (or its own group) is listed as escriturador
    a, b = words(raw), words(razao)
    if a and b and a[0] == b[0]: return "Própria empresa"
    return "Própria empresa" if any(w in b for w in a[:2]) else raw.title()

CODE = {"IC": "Itaú Corretora", "BR": "Banco Bradesco", "OP": "Banco Opportunity", "BT": "BTG Pactual",
        "IU": "Itaú Unibanco", "BB": "Banco do Brasil", "SA": "Banco Santander", "BC": "Bradesco CTVM",
        "PE": "Própria empresa", "RB": "BRB DTVM", "ID": "ID CTVM", "ME": "Banco Mercantil do Brasil",
        "NE": "Banco do Nordeste", "OS": "Oslo Capital DTVM"}

fca = {}
for line in Path("/home/claude/cvm/fca.txt").read_text(encoding="utf-8").splitlines():
    if not line.strip(): continue
    c, cur, ini, prev, pini, pfim, plast, n = line.split("|")
    approx = ini.startswith("~")
    fca[c] = {"cur": CODE[cur], "ini": ini.lstrip("~"), "ax": approx,
              "prev": CODE.get(prev, prev) if prev else "", "pini": pini, "pfim": pfim, "plast": plast, "n": int(n)}

CLS = {"3": "ON", "4": "PN", "5": "PNA", "6": "PNB", "7": "PNC", "8": "PND", "11": "Units"}
def tclass(t):
    return CLS.get(re.sub(r"B$", "", t)[4:], "Outros")

data = []
for r in sorted(rows, key=lambda r: r["preg"]):
    cnpj = re.sub(r"\D", "", r["cnpj"])
    f = fca.get(cnpj)
    on_e = entity(r["on"], r["razao"]) if r["on"] else ""
    pn_e = entity(r["pn"], r["razao"]) if r["pn"] else ""
    data.append({
        "p": r["preg"], "r": r["razao"], "e": r["emis"], "c": r["cnpj"], "v": r["cvm"], "m": r["mk"], "s": r["setor"],
        "b": on_e or pn_e or "Não informado", "pn": pn_e, "onr": r["on"], "pnr": r["pn"],
        "t": [[t, tclass(t)] for t in r["tick"]],
        "f": f,
    })

MKT_ORDER = ["NM", "N2", "N1", "MP", "B", "SO", "BN", "?"]
mkt = {k: MKT[k] for k in MKT_ORDER}

tpl = Path("dash2_template.html").read_text(encoding="utf-8")
out = (tpl.replace("/*__DATA__*/[]", json.dumps(data, ensure_ascii=False, separators=(",", ":")))
          .replace("/*__MKT__*/{}", json.dumps(mkt, ensure_ascii=False)))
Path("dashboard_acoes_b3.html").write_text(out, encoding="utf-8")
tt = Path("table_template.html").read_text(encoding="utf-8")
Path("empresas_acoes_b3.html").write_text(tt.replace("/*__DATA__*/[]", json.dumps(data, ensure_ascii=False, separators=(",", ":"))).replace("/*__MKT__*/{}", json.dumps(mkt, ensure_ascii=False)), encoding="utf-8")

from collections import Counter
print(len(data), sum(1 for d in data if d["f"]), sum(1 for d in data if d["f"] and d["f"]["prev"]))
print(Counter(d["b"] for d in data).most_common())
div = [(d["p"], d["b"], d["f"]["cur"]) for d in data if d["f"] and d["b"] != d["f"]["cur"]]
print(len(div), div[:25])
