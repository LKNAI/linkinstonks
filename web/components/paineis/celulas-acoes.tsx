// Colunas da tabela de ações, compartilhadas por /acoes e /acoes/tabela (paridade com o seed).
import type { ColunaSpec } from "@/components/table/DataTable";
import { detalheAnterior, textoDesde, type AcaoRow } from "@/lib/acoes";
import { corEscriturador } from "@/lib/colors";
import { SEGMENTO_NOME } from "@/lib/palette";

export function Banco({ nome }: { nome: string | null | undefined }) {
  if (!nome) return <span className="muted">—</span>;
  return (
    <span className="bk">
      <span className="dot" style={{ background: corEscriturador(nome) }} />
      {nome}
    </span>
  );
}

function CelulaEmpresa({ d }: { d: AcaoRow }) {
  return (
    <div className="co">
      <b>{d.pregao}</b>
      <div>{d.razao_social}</div>
      <span className="cd">{d.emissor}</span>
    </div>
  );
}

function CelulaTickers({ d }: { d: AcaoRow }) {
  if (!d.tickers.length) return <span className="muted">sem ticker</span>;
  return (
    <>
      {d.tickers.map((t) => (
        <span className="tk" key={t.ticker}>
          {t.ticker}
          <i>{t.classe === "Outros" ? "" : t.classe}</i>
        </span>
      ))}
    </>
  );
}

function CelulaEscriturador({ d }: { d: AcaoRow }) {
  const f = d.escriturador_cvm;
  return (
    <>
      <span title={d.escriturador_b3.bruto_on || d.escriturador_b3.bruto_pn}>
        <Banco nome={d.b} />
      </span>
      {d.escriturador_b3.pn && d.escriturador_b3.pn !== d.b ? (
        <div className="small">PN: {d.escriturador_b3.pn}</div>
      ) : null}
      {f && f.atual !== d.b ? (
        <div className="warn" title="Escriturador no FCA mais recente">
          ⚠ CVM indica {f.atual}
        </div>
      ) : null}
    </>
  );
}

function CelulaDesde({ d }: { d: AcaoRow }) {
  const t = textoDesde(d);
  if (t.tipo === "sem-cvm" || t.tipo === "nao-informada") return <span className="muted">{t.texto}</span>;
  return t.tipo === "aprox" ? (
    <span className="date ax" title="Data não informada no FCA; primeiro formulário com este escriturador">
      {t.texto}
    </span>
  ) : (
    <span className="date">{t.texto}</span>
  );
}

function CelulaAnterior({ d }: { d: AcaoRow }) {
  if (!d.escriturador_cvm) return <span className="muted">—</span>;
  const a = detalheAnterior(d);
  if (!a) return <span className="muted">Sem troca registrada</span>;
  return (
    <div className="prev">
      <Banco nome={a.nome} />
      <div className="when">{a.quando}</div>
      {a.muitos ? <div className="small">{a.muitos}</div> : null}
    </div>
  );
}

export function colunasAcoes(comCodigoCvm: boolean): ColunaSpec<AcaoRow>[] {
  const colunas: ColunaSpec<AcaoRow>[] = [
    { id: "pregao", titulo: "Empresa", celula: (d) => <CelulaEmpresa d={d} /> },
    { id: "tickers", titulo: "Tickers", celula: (d) => <CelulaTickers d={d} /> },
    { id: "b", titulo: "Escriturador atual", celula: (d) => <CelulaEscriturador d={d} /> },
    {
      id: "since",
      titulo: "Escriturador desde",
      classeTh: "trace",
      classeTd: () => "trace",
      celula: (d) => <CelulaDesde d={d} />,
    },
    {
      id: "prev",
      titulo: "Escriturador anterior",
      classeTh: "trace",
      classeTd: () => "trace",
      celula: (d) => <CelulaAnterior d={d} />,
    },
    {
      id: "segmento",
      titulo: "Segmento",
      celula: (d) => (
        <span className={`seg ${d.segmento === "?" ? "" : d.segmento}`}>
          {SEGMENTO_NOME[d.segmento] ?? d.segmento}
        </span>
      ),
    },
    { id: "setor", titulo: "Setor", classeTd: () => "sec", celula: (d) => d.setor },
    { id: "cnpj", titulo: "CNPJ", classeTd: () => "mono", celula: (d) => d.cnpj },
  ];
  if (comCodigoCvm)
    colunas.push({
      id: "codigo_cvm",
      titulo: "Cód. CVM",
      classeTd: () => "mono",
      celula: (d) => d.codigo_cvm,
    });
  return colunas;
}
