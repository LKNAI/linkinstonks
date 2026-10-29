import json, re
from pathlib import Path
from collections import Counter, defaultdict

BASE = Path(__file__).parent

MONTHS = []
y, m = 2024, 10
while len(MONTHS) < 24:
    MONTHS.append(f"{y}-{m:02d}")
    m += 1
    if m > 12:
        m, y = 1, y + 1

# --- Banco B3 program lists (finservices.b3.com.br) ---
fs = {}
sec = None
for l in (BASE / "finservices.txt").read_text(encoding="utf-8").splitlines():
    if l in ("DRN", "ETF"):
        sec = l
        continue
    if not l.strip():
        continue
    t, n = l.split("|", 1)
    fs[t] = n.rstrip("*").strip()
    if n.endswith("*"):
        fs[t + "_q"] = True

# --- Bradesco Custódia (custodia.bradesco) — BDR não patrocinados & BDR de ETF ---
BRADESCO = {
    "ACNB34": "Accenture plc", "AIGB34": "American International Group Inc", "AXPB34": "American Express Co",
    "ATTB34": "AT&T Inc", "BERK34": "Berkshire Hathaway Inc", "BOEI34": "The Boeing Company",
    "BMYB34": "Bristol-Myers Squibb Co", "CLOV34": "Clover Health Investments Corp", "DUKB34": "Duke Energy Corp",
    "DDNB34": "DuPont de Nemours Inc", "FDXB34": "FedEx Corp", "FMXB34": "FEMSA (ADR)",
    "GDBR34": "General Dynamics Corp", "HPQB34": "HP Inc", "HONB34": "Honeywell International Inc",
    "IBMB34": "IBM Corp", "JNJB34": "Johnson & Johnson", "KMBB34": "Kimberly-Clark Corp",
    "LMTB34": "Lockheed Martin Corp", "METB34": "MetLife Inc", "MSBR34": "Morgan Stanley",
    "PEPB34": "PepsiCo Inc", "RYBD34": "Royal Bank of Canada", "BNSB34": "Bank of Nova Scotia (Scotiabank)",
    "SBUB34": "Starbucks Corp", "STOC34": "StoneCo Ltd", "TGTB34": "Target Corp",
    "TEXA34": "Texas Instruments Inc", "BONY34": "The Bank of New York Mellon Corp",
    "KHCB34": "The Kraft Heinz Company", "VISA34": "Visa Inc", "DISB34": "The Walt Disney Company",
    "XRXB34": "Xerox Holdings Corp",
    "ROXO34": "Nu Holdings Ltd", "INBR32": "Inter&Co Inc",
    "GDXB39": "VanEck Gold Miners ETF", "MOTB39": "VanEck Morningstar Wide Moat ETF", "SLXB39": "VanEck Steel ETF",
    "BUZZ39": "VanEck Social Sentiment ETF", "ANGV39": "VanEck Fallen Angel High Yield Bond ETF",
    "HYEM39": "VanEck Emerging Markets High Yield Bond ETF",
}
# --- Itaú Investment Services — BDRs de programas não patrocinados ---
ITAU = {
    "AMZO34": "Amazon.com Inc", "CATP34": "Caterpillar Inc", "CHVX34": "Chevron Corp",
    "COLG34": "Colgate-Palmolive Co", "MSCD34": "Mastercard Inc", "NIKE34": "Nike Inc",
    "ORCL34": "Oracle Corp", "SLBG34": "SLB (Schlumberger)", "COCA34": "The Coca-Cola Company",
    "RYTT34": "RTX Corporation", "USBC34": "U.S. Bancorp",
}
# --- Patrocinados: API Empresas Listadas (GetDetail.institutionPreferred) ---
SPONS = {
    "AURA33": ("Aura Minerals Inc", "Banco Bradesco"), "GROP31": ("Brazil Potash Corp", "Banco Bradesco"),
    "DEFT31": ("DeFi Technologies Inc", "Banco B3"), "EFXB31": ("Equifax Inc", "Itaú Unibanco"),
    "EVEB31": ("Eve Holding Inc", "Banco Bradesco"), "EVTC31": ("Evertec Inc", "Itaú Unibanco"),
    "EXPB31": ("Experian plc", "Itaú Unibanco"), "G2DI33": ("G2D Investments Ltd", "Banco Bradesco"),
    "HMRN31": ("HomeRun Resources Inc", "Banco B3"), "JBSS32": ("JBS N.V.", "Banco Bradesco"),
    "PRXB31": ("Prosus N.V.", "Itaú Unibanco"), "XPBR31": ("XP Inc", "Itaú Unibanco"),
}
OTHER_NAMES = {
    "INBR32": "Inter&Co Inc", "STOC31": "StoneCo Ltd", "CAFR31": "Carrefour SA", "EXCO32": "Almacenes Éxito SA",
    "GPIV33": "GP Investments Ltd", "EAIN34": "Electronic Arts Inc", "W1BD34": "Warner Bros. Discovery Inc",
    "LBRD34": "Liberty Broadband Corp", "WGBA34": "Walgreens Boots Alliance Inc", "USSX34": "United States Steel Corp",
    "J1NP34": "Juniper Networks Inc", "S2QU34": "Block Inc (ticker antigo)", "TLNC34": "Telefónica SA",
    "K1EL34": "Kellanova", "W2OL34": "Wolfspeed Inc", "L2AZ34": "Luminar Technologies Inc", "I1AC34": "IAC Inc",
    "R2DF34": "Redfin Corp", "M2PW34": "Medical Properties Trust (ticker antigo)", "PSKY34": "Paramount Skydance Corp",
    "V2ME34": "Vimeo Inc", "A1VB34": "AvalonBay Communities Inc", "Q1RV34": "Qorvo Inc", "C1BS34": "Paramount Global",
    "I1PH34": "Interpublic Group", "E1QR34": "Equity Residential", "I2TC34": "Intra-Cellular Therapies",
    "M2AS34": "Masimo Corp", "L1EG34": "Leggett & Platt", "D1FS34": "Discover Financial Services",
    "B1GN34": "BeiGene Ltd (ticker antigo)", "C1OG34": "Coterra Energy", "H1BI34": "Hanesbrands Inc",
    "S2MA34": "Smartsheet Inc", "C1MA34": "Comerica Inc", "G1LP34": "Galapagos NV", "S1EA34": "Sealed Air Corp",
    "H1OL34": "Hologic Inc", "J1WN34": "Nordstrom Inc", "S2QS34": "Squarespace Inc", "A1NS34": "Ansys Inc",
    "T2PX34": "Tempur Sealy (Somnigroup)", "M1RO34": "Marathon Oil", "NSAT34": "National Storage Affiliates",
    "H1ES34": "Hess Corp", "E2XP34": "eXp World Holdings", "BJQU39": "JPMorgan US Quality Factor ETF",
    "BBER39": "JPMorgan BetaBuilders Europe ETF", "BSGO39": "iShares 0-3 Month Treasury Bond ETF (ticker antigo)",
    "BPEM39": "JPMorgan Diversified Return EM Equity ETF", "BBCN39": "JPMorgan BetaBuilders Canada ETF",
    "BMOM39": "JPMorgan US Momentum Factor ETF", "BEDC39": "Global X Telemedicine & Digital Health ETF",
    "BBAJ39": "JPMorgan BetaBuilders Japan ETF", "BPME39": "JPMorgan Diversified Return US Mid Cap ETF",
    "BJPI39": "JPMorgan Diversified Return Intl Equity ETF", "BMCE39": "JPMorgan BetaBuilders US Mid Cap ETF",
}

CAT_LINE = "CBTC:C,AADA:C,BASK:C,AETH:C,SOLN:C,AXRP:C,ABGD:C,G1TR:C,SIVR:C,BFTS:V,BKYY:V,BFDN:V,BFEM:V,BFTG:V,BFXH:V,BFPI:V,BFTC:V,BFDL:V,BROB:V,BQCL:V,BGRI:V,BCIR:V,BQQW:V,BQTC:V,BFCG:V,BFBI:V,BAIR:V,BFDA:V,BSDY:V,BFTA:V,BFPX:V,BFVD:V,BFIW:V,EZBC:C,EZET:C,FTIN:V,FLTW:V,USPX:V,TBIL:F,CHPX:V,BAIQ:V,BDRI:V,BKCH:V,BCTE:V,BCLO:V,BCPX:V,BBUG:V,DTCR:V,SHLD:V,BFNX:V,BGNO:V,GOEX:V,BSNS:V,BLBT:V,BMIL:V,BLPX:V,BLPA:V,ARGT:V,BCHQ:V,COLO:V,BQYL:V,EART:V,BOTZ:V,RSSL:V,BCAT:V,BSIL:V,BSOC:V,ORBX:V,BSDV:V,BSRE:V,BDVD:V,BURA:V,BPVE:V,BPFR:F,BPFV:F,BHER:V,BSHV:F,DOLL:F,BHYC:F,BSTI:F,BIGL:F,BTLH:F,BSHY:F,BIGS:F,BTLT:F,BGOZ:F,BIEI:F,BIYT:F,BQLT:F,BIBB:V,IBIT:C,USIG:F,BFXI:V,BICV:F,BAOK:F,BAOM:F,BAOR:F,BAOA:V,BGWH:V,BHDV:V,BIAG:F,BIEF:V,BIEM:V,BIEU:V,BIPC:V,BIXU:V,BIVB:V,BIJH:V,BIJR:V,BITO:V,BAGG:F,BIUS:F,BUSR:V,BHEF:V,BHEZ:V,BHEW:V,BIHA:V,BDVE:V,BEGD:V,BEGE:V,BEGU:V,BEAG:F,BSUC:F,BSUS:V,BUSA:V,ETHA:C,BIEV:V,BIET:V,BFAL:F,BFLO:F,BARY:V,BXTC:V,BIDN:V,BGLC:V,BICL:V,BKXI:V,BIXC:V,BIXG:V,BIXJ:V,BIGF:V,BGRT:V,BIXN:V,BIAU:C,BCOM:C,BHYG:F,BLQD:F,BIDV:V,BIGO:F,BILF:V,BCRB:V,BMBB:F,BMRE:V,BACW:V,ACWX:V,BVEG:V,BAAX:V,BEWA:V,BEWO:V,BEWZ:V,BEWC:V,BECH:V,BCNY:V,BCHI:V,EDEN:V,BEFA:V,BEFG:V,BFAV:V,BSCZ:V,BEFV:V,BEEM:V,BEMC:V,BEMV:V,BEUF:V,BEZU:V,BEWQ:V,BEWG:V,BPIC:V,BCWV:V,BSDG:V,BEWH:V,BNDA:V,SMIN:V,EIDO:V,BEIS:V,BEWI:V,BEWJ:V,EWJV:V,BEWM:V,BEWW:V,BEWN:V,BEPP:V,BEPU:V,EPHE:V,EPOL:V,BERU:V,BKSA:V,BEWS:V,BEZA:V,BEWY:V,BEWP:V,BEWD:V,BEWL:V,BEWT:V,BTHD:V,TURK:V,BUAE:V,BEWU:V,BEUW:V,BUSM:V,BMTU:V,BQUA:V,BGAR:V,BSIZ:V,BVLU:V,BURT:V,QTOP:V,BIGE:V,BPRS:V,BREZ:V,BIWF:V,BIWD:V,BIWM:V,BOEF:V,BIVW:V,BIVE:V,BIJT:V,BIJS:V,BDVY:V,BIDR:V,BSOX:V,BSLV:C,BTIP:F,TOPB:V,BTFL:F,BIYM:V,BIYE:V,BIYG:V,BIHF:V,BITB:V,BIYJ:V,BIAK:V,BIHI:V,BIEZ:V,BIAT:V,BIYZ:V,BAER:V,BIAI:V,BIYC:V,BIYK:V,BIYF:V,BIFR:V,BIEO:V,BIHE:V,BIYW:V,BIYP:V,BGOV:F,BUTL:V,BBGR:F,JUSG:V,JPHY:F,JEMA:V,BBCA:V,BBAX:V,BBEU:V,BBIL:V,BBJP:V,BBMR:V,BBUS:V,BBMC:V,JPEM:V,JPIN:V,JPUS:V,JPME:V,BDRE:V,JEPI:V,JGLO:V,JPIE:F,JIVE:V,JPST:F,JMOM:V,JQUA:V,JTEK:V,JVAL:V,BKBA:V,BKWB:V,BHYS:F,BLTP:F,BSTP:F,BZRO:F,BIPZ:F,BCRP:F,BMFE:V,BTCV:C,ETHV:C,XRPV:C,VSOL:C,VSUI:C,HYEM:F,ANGV:F,GDXB:V,EMLC:F,MOTB:V,PFXF:V,SLXB:V,BUZZ:V,BWCL:V,BUSF:F,BAGY:F,BDAX:V,BEUT:V,BCHA:V,BEME:V,BEUR:V,BJAP:V,BEUA:V,BLUZ:V,BWOR:V,BUFF:V,BTWO:V,BEQW:V,BEUS:V"
CAT = dict(x.split(":") for x in CAT_LINE.split(","))
CATN = {"V": "Renda variável", "F": "Renda fixa", "C": "Commodities / cripto", "M": "Moeda"}


def nice(nom):
    w = nom.title()
    for a, b in [(" Inc", " Inc"), ("Sa ", "SA "), ("Plc", "plc")]:
        w = w.replace(a, b)
    return w


def ddate(s):
    return "20" + s if s else ""


data = []
srcs = Counter()
for line in (BASE / "cot.txt").read_text(encoding="utf-8").splitlines():
    if not line:
        continue
    t, nom, esp, isin3, first, last, lp, _, neg, vols = line.split("|")
    tipo = esp.split()[0]
    vol = [int(v) if v else 0 for v in vols.split(",")]
    assert len(vol) == 24, t
    # depositary + name resolution, in order of authority
    if t in SPONS:
        name, dep = SPONS[t]; src = "API B3 (GetDetail)"
    elif t in fs:
        name, dep = fs[t], "Banco B3"; src = "Banco B3 (finservices)"
    elif t in BRADESCO:
        name, dep = BRADESCO[t], "Banco Bradesco"; src = {"ROXO34": "Comunicado Nu Holdings (2023)", "INBR32": "Comunicado Inter&Co (2026), via imprensa"}.get(t, "Bradesco Custódia")
    elif t in ITAU:
        name, dep = ITAU[t], "Itaú Unibanco"; src = "Itaú Investment Services"
    else:
        name, dep = OTHER_NAMES.get(t, nice(nom)), "Não identificado"; src = ""
    srcs[dep] += 1
    isin = isin3 if len(isin3) == 12 else f"BR{t[:4]}BDR{isin3}"
    last_d = ddate(last) or "2026-09-30"
    data.append({
        "t": t, "n": name, "k": tipo, "d": dep, "s": src,
        "c": CATN.get(CAT.get(t[:4], ""), "") if tipo == "DRE" else "",
        "q": 1 if fs.get(t + "_q") else 0,
        "i": isin, "f": ddate(first) or "2024-10-01", "l": last_d,
        "p": float(lp), "g": int(neg), "v": vol,
    })

for d in data:
    for k in ("f", "l"):
        s = d[k].replace("-", "")
        d[k] = f"{s[:4]}-{s[4:6]}-{s[6:8]}"

print(len(data), srcs.most_common())
print(Counter(d["k"] for d in data))
tot = sum(sum(d["v"]) for d in data)
print("total 24m R$ bi", tot / 1e6)
unk = sorted([d for d in data if d["d"] == "Não identificado"], key=lambda d: -sum(d["v"]))
print("unknown share", sum(sum(d["v"]) for d in unk) / tot, [d["t"] for d in unk[:12]])

meta = {"months": MONTHS, "asof": "2026-10-28"}
tpl = (BASE / "template.html").read_text(encoding="utf-8")
out = tpl.replace("/*__DATA__*/[]", json.dumps(data, ensure_ascii=False, separators=(",", ":"))).replace("/*__META__*/{}", json.dumps(meta))
(BASE / "dashboard_bdrs_b3.html").write_text(out, encoding="utf-8")
print("bytes", len(out))
