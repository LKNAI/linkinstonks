import html, json, sys
from pathlib import Path

INST = ["BANCO DO NORDESTE DO BRASIL S.A.","BANCO MERCANTIL DO BRASIL S.A.","BANRISUL","BRADESCO","BRADESCO - DEBENT.","BRASIL","BTG PACTUAL SERVIÇOS FINANC. S.A. DTVM","BTG PACTUAL SERVIÇOS FINANCEIROS SA DTVM","CACHOEIRA PAULISTA TRANSMIS. ENERGIA S.A","CEMIG DISTRIBUICAO S.A.","CEMIG GERACAO E TRANSMISSAO S.A.","CIA HABITASUL DE PARTICIPACOES","CIA INDUSTRIAL CATAGUASES","CIA TECIDOS SANTANENSE","CONCESSIONARIA RIO-TERESOPOLIS S.A.","CONCESSIONÁRIA RODOVIAS DO TIETÊ S.A.","CONSERVAS ODERICH S.A.","DIBENS LEASING S.A. - ARREND.MERCANTIL","EMPRESA","FICTOR ALIMENTOS S.A","HIDROVIAS DO BRASIL S.A.","ID CTVM S.A.","ITAU CORRETORA ACOES","ITAU CORRETORA DEBENTURES","ITAUBANCO - ACOES","ITAUBANCO - DEBENTURES","J. MACEDO S.A.","LITELA PARTICIPAÇÕES S.A.","MANUFATURA DE BRINQUEDOS ESTRELA S.A.","MINASMAQUINAS S.A.","OLIVEIRA TRUST","PDG COMPANHIA SECURITIZADORA","RODOVIAS DAS COLINAS S.A.","SAFRA SERVIÇOS DE ADMINISTRAÇÃO FIDUCIÁR","SANSUY S.A. INDUSTRIA DE PLASTICOS","SANTANDER","VORTX DTVM LTDA."]

# Nome de exibição mais legível (o valor original da API fica no title)
PRETTY = {
    "BRADESCO": "Banco Bradesco", "BRADESCO - DEBENT.": "Banco Bradesco (debêntures)",
    "BRASIL": "Banco do Brasil", "BANRISUL": "Banrisul", "SANTANDER": "Banco Santander",
    "ITAU CORRETORA ACOES": "Itaú Corretora", "ITAU CORRETORA DEBENTURES": "Itaú Corretora (debêntures)",
    "ITAUBANCO - ACOES": "Itaú Unibanco", "ITAUBANCO - DEBENTURES": "Itaú Unibanco (debêntures)",
    "BTG PACTUAL SERVIÇOS FINANCEIROS SA DTVM": "BTG Pactual DTVM", "BTG PACTUAL SERVIÇOS FINANC. S.A. DTVM": "BTG Pactual DTVM",
    "BANCO DO NORDESTE DO BRASIL S.A.": "Banco do Nordeste", "BANCO MERCANTIL DO BRASIL S.A.": "Banco Mercantil do Brasil",
    "OLIVEIRA TRUST": "Oliveira Trust", "VORTX DTVM LTDA.": "Vórtx DTVM", "ID CTVM S.A.": "ID CTVM",
    "SAFRA SERVIÇOS DE ADMINISTRAÇÃO FIDUCIÁR": "Safra Serv. Adm. Fiduciária",
    "EMPRESA": "Própria empresa",
}
MKT = {"NM": "Novo Mercado", "N1": "Nível 1", "N2": "Nível 2", "B": "Tradicional", "MP": "Bovespa Mais",
       "SO": "Balcão organizado (SOMA)", "BN": "Balcão não organizado", "?": "Sem dados"}

def inst(code):
    if code == "": return ""
    return INST[int(code)]

rows = []
for f in ("data1.txt", "data2.txt"):
    for line in Path(f).read_text(encoding="utf-8").splitlines():
        if not line.strip(): continue
        p = line.split("|")
        assert len(p) == 11, line
        cvm, emis, preg, razao, cnpj, mk, setor, ic, ip, tick, neg = p
        ic_n = inst(ic)
        ip_n = ic_n if ip == "=" else inst(ip)
        cnpj = cnpj.zfill(14)
        rows.append({
            "cvm": cvm, "emis": emis, "preg": preg, "razao": " ".join(razao.split()),
            "cnpj": f"{cnpj[:2]}.{cnpj[2:5]}.{cnpj[5:8]}/{cnpj[8:12]}-{cnpj[12:]}",
            "mk": mk, "setor": setor, "on": ic_n, "pn": ip_n,
            "tick": tick.split() if tick else [], "neg": neg == "1",
        })

rows.sort(key=lambda r: r["preg"])
n_total = len(rows)
n_tick = sum(1 for r in rows if r["tick"])
n_tickers = sum(len(r["tick"]) for r in rows)

from collections import Counter
banks = Counter()
for r in rows:
    if r["tick"]:
        b = PRETTY.get(r["on"], r["on"]) or "—"
        banks[b] += 1
top = banks.most_common(6)

def bank_cell(raw):
    if not raw: return '<span class="muted">—</span>'
    return f'<span title="{html.escape(raw)}">{html.escape(PRETTY.get(raw, raw.title()))}</span>'

trs = []
for r in rows:
    ticks = "".join(f'<span class="tk">{html.escape(t)}</span>' for t in r["tick"]) or '<span class="muted">sem ticker</span>'
    same = r["on"] == r["pn"]
    pn = '<span class="muted">mesmo</span>' if (same and r["pn"]) else bank_cell(r["pn"])
    mk_label = MKT.get(r["mk"], r["mk"])
    trs.append(
        f'<tr data-t="{1 if r["tick"] else 0}" data-mk="{r["mk"]}">'
        f'<td><b>{html.escape(r["preg"])}</b><div class="sub">{html.escape(r["razao"])}</div></td>'
        f'<td class="mono">{html.escape(r["emis"])}</td>'
        f'<td>{ticks}</td>'
        f'<td>{bank_cell(r["on"])}</td>'
        f'<td>{pn}</td>'
        f'<td><span class="mk mk-{r["mk"] if r["mk"]!="?" else "X"}">{html.escape(mk_label)}</span></td>'
        f'<td class="sub2">{html.escape(r["setor"])}</td>'
        f'<td class="mono sub2">{r["cnpj"]}</td>'
        f'<td class="mono sub2">{r["cvm"]}</td>'
        '</tr>')

stat_banks = "".join(f'<li><span>{html.escape(b)}</span><b>{c}</b></li>' for b, c in top)

page = f"""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Empresas com ações na B3</title>
<style>
:root{{--bg:#f7f6f2;--card:#fff;--ink:#1c1d1f;--mut:#6b6e74;--line:#e4e2dc;--acc:#0b5d4b;--acc2:#e7f2ee;--tk:#eef0f6;--tkb:#2b3a67;}}
@media (prefers-color-scheme: dark){{:root{{--bg:#141518;--card:#1c1e22;--ink:#e9e9ea;--mut:#9a9da3;--line:#2c2f35;--acc:#5fc3a6;--acc2:#1d2e29;--tk:#252b3d;--tkb:#b9c6f0;}}}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}}
header{{padding:28px 20px 8px;max-width:1400px;margin:0 auto}}
h1{{margin:0 0 6px;font-size:24px;letter-spacing:-.01em}}
.lead{{color:var(--mut);margin:0;max-width:860px}}
.stats{{display:flex;flex-wrap:wrap;gap:12px;margin:18px 0 6px}}
.stat{{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 16px;min-width:150px}}
.stat b{{display:block;font-size:22px;font-variant-numeric:tabular-nums}}
.stat span{{color:var(--mut);font-size:12px}}
.stat ul{{list-style:none;margin:4px 0 0;padding:0;font-size:12px;min-width:220px}}
.stat li{{display:flex;justify-content:space-between;gap:12px}}
.stat li b{{font-size:12px;display:inline}}
.controls{{position:sticky;top:0;z-index:2;background:var(--bg);border-bottom:1px solid var(--line);}}
.controls .in{{max-width:1400px;margin:0 auto;padding:10px 20px;display:flex;flex-wrap:wrap;gap:10px;align-items:center}}
input[type=search],select{{font:inherit;color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:8px;padding:8px 10px}}
input[type=search]{{flex:1;min-width:220px}}
label.chk{{display:flex;gap:6px;align-items:center;color:var(--mut)}}
#count{{color:var(--mut);margin-left:auto;font-variant-numeric:tabular-nums}}
main{{max-width:1400px;margin:0 auto;padding:12px 20px 40px}}
.wrap{{overflow-x:auto;background:var(--card);border:1px solid var(--line);border-radius:12px}}
table{{border-collapse:collapse;width:100%;min-width:1100px}}
th,td{{text-align:left;padding:9px 12px;border-bottom:1px solid var(--line);vertical-align:top}}
th{{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--mut);cursor:pointer;user-select:none;white-space:nowrap;background:var(--card);position:sticky;top:0}}
th[aria-sort=ascending]::after{{content:" ▲"}} th[aria-sort=descending]::after{{content:" ▼"}}
tbody tr:hover{{background:var(--acc2)}}
.sub{{color:var(--mut);font-size:12px}}
.sub2{{color:var(--mut);font-size:12.5px}}
.mono{{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12.5px;white-space:nowrap}}
.tk{{display:inline-block;background:var(--tk);color:var(--tkb);border-radius:5px;padding:1px 6px;margin:0 4px 4px 0;font:600 12px ui-monospace,Menlo,Consolas,monospace}}
.muted{{color:var(--mut)}}
.mk{{font-size:12px;border-radius:999px;padding:2px 8px;border:1px solid var(--line);white-space:nowrap}}
.mk-NM{{border-color:var(--acc);color:var(--acc)}}
footer{{max-width:1400px;margin:0 auto;padding:0 20px 40px;color:var(--mut);font-size:12.5px}}
footer p{{margin:4px 0}}
</style>
</head>
<body>
<header>
<h1>Empresas com ações registradas na B3</h1>
<p class="lead">Companhias abertas classificadas pela B3 como emissoras de ações, com seus códigos de negociação (tickers) e a instituição escrituradora das ações ordinárias (ON) e preferenciais (PN). Dados extraídos da API pública de Empresas Listadas da B3 em 23/10/2026.</p>
<div class="stats">
  <div class="stat"><b>{n_total}</b><span>empresas emissoras de ações</span></div>
  <div class="stat"><b>{n_tick}</b><span>com ticker de ações</span></div>
  <div class="stat"><b>{n_tickers}</b><span>tickers no total</span></div>
  <div class="stat"><span>Escrituradores mais comuns (empresas com ticker)</span><ul>{stat_banks}</ul></div>
</div>
</header>
<div class="controls"><div class="in">
  <input type="search" id="q" placeholder="Buscar por empresa, ticker, CNPJ ou banco…" aria-label="Buscar">
  <select id="bank" aria-label="Filtrar por escriturador"><option value="">Todos os escrituradores</option></select>
  <select id="mk" aria-label="Filtrar por segmento">
    <option value="">Todos os segmentos</option>
    {''.join(f'<option value="{k}">{v}</option>' for k,v in MKT.items())}
  </select>
  <label class="chk"><input type="checkbox" id="onlyT" checked> Somente com ticker</label>
  <span id="count"></span>
</div></div>
<main>
<div class="wrap">
<table id="t">
<thead><tr>
<th data-k="0">Empresa</th><th data-k="1">Código</th><th data-k="2">Tickers</th>
<th data-k="3">Escriturador ON</th><th data-k="4">Escriturador PN</th><th data-k="5">Segmento</th>
<th data-k="6">Setor</th><th data-k="7">CNPJ</th><th data-k="8">Cód. CVM</th>
</tr></thead>
<tbody>
{chr(10).join(trs)}
</tbody>
</table>
</div>
</main>
<footer>
<p><b>Fonte:</b> B3 – Empresas Listadas (sistemaswebb3-listados.b3.com.br, endpoints <span class="mono">GetInitialCompanies</span> e <span class="mono">GetDetail</span>), filtro de emissores do tipo “ações”.</p>
<p><b>Escriturador:</b> instituição responsável pelo livro de registro das ações (campos <span class="mono">institutionCommon</span> / <span class="mono">institutionPreferred</span>). “Própria empresa” indica escrituração feita pela própria companhia. Passe o mouse sobre o nome para ver o valor original da API.</p>
<p><b>Tickers:</b> códigos de negociação informados pela B3 (debêntures foram excluídas). Empresas de balcão não organizado geralmente não têm ticker. Oito empresas não retornaram detalhe na API e aparecem como “Sem dados”.</p>
</footer>
<script>
(function(){{
  const tb=document.querySelector('#t tbody'), rows=[...tb.rows];
  const q=document.getElementById('q'), bank=document.getElementById('bank'), mk=document.getElementById('mk'), onlyT=document.getElementById('onlyT'), cnt=document.getElementById('count');
  const banks=new Set(); rows.forEach(r=>{{[3,4].forEach(i=>{{const t=r.cells[i].innerText.trim(); if(t&&t!=='—'&&t!=='mesmo')banks.add(t)}})}});
  [...banks].sort((a,b)=>a.localeCompare(b,'pt')).forEach(b=>{{const o=document.createElement('option');o.value=b;o.textContent=b;bank.appendChild(o)}});
  const norm=s=>s.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase();
  const idx=rows.map(r=>norm(r.innerText+' '+[...r.querySelectorAll('[title]')].map(e=>e.title).join(' ')+' '+r.cells[7].innerText.replace(/\\D/g,'')));
  function apply(){{
    const v=norm(q.value.trim()), b=bank.value, m=mk.value, t=onlyT.checked; let n=0;
    rows.forEach((r,i)=>{{
      let ok=(!v||idx[i].includes(v))&&(!t||r.dataset.t==='1')&&(!m||r.dataset.mk===m||(m==='?'&&r.dataset.mk==='?'));
      if(ok&&b){{const on=r.cells[3].innerText.trim(), pn=r.cells[4].innerText.trim(); ok=on===b||pn===b;}}
      r.hidden=!ok; if(ok)n++;
    }});
    cnt.textContent=n+' de '+rows.length+' empresas';
  }}
  [q,bank,mk,onlyT].forEach(e=>e.addEventListener('input',apply));
  document.querySelectorAll('th').forEach(th=>th.addEventListener('click',()=>{{
    const k=+th.dataset.k, dir=th.getAttribute('aria-sort')==='ascending'?-1:1;
    document.querySelectorAll('th').forEach(h=>h.removeAttribute('aria-sort'));
    th.setAttribute('aria-sort',dir===1?'ascending':'descending');
    rows.sort((a,b)=>a.cells[k].innerText.localeCompare(b.cells[k].innerText,'pt',{{numeric:true}})*dir);
    rows.forEach(r=>tb.appendChild(r));
  }}));
  apply();
}})();
</script>
</body>
</html>"""
Path("empresas_acoes_b3.html").write_text(page, encoding="utf-8")
print(n_total, n_tick, n_tickers, top)
