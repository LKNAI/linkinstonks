// Peças das páginas de detalhe (renderizadas no build, sem JavaScript para o conteúdo principal).
import Link from "next/link";
import type { ReactNode } from "react";
import { coresDoConjunto } from "@/lib/colors";
import { formatDate } from "@/lib/format";
import type { Acao, Passagem, TrechoSegmento } from "@/lib/schemas";

export function Migalhas({ itens }: { itens: { href?: string; texto: string }[] }) {
  return (
    <nav className="crumb" aria-label="Você está em">
      {itens.map((i, n) => (
        <span key={i.texto}>
          {n > 0 ? " › " : ""}
          {i.href ? (
            <Link href={i.href} prefetch={false}>
              {i.texto}
            </Link>
          ) : (
            i.texto
          )}
        </span>
      ))}
    </nav>
  );
}

export function Cartao({
  titulo,
  descricao,
  coluna,
  children,
}: {
  titulo: string;
  descricao?: string;
  coluna: string;
  children: ReactNode;
}) {
  return (
    <section className={`card ${coluna}`}>
      <h2>{titulo}</h2>
      {descricao ? <p className="desc">{descricao}</p> : <div style={{ height: 12 }} />}
      {children}
    </section>
  );
}

export function Lista({ linhas }: { linhas: [string, ReactNode][] }) {
  return (
    <dl className="dl">
      {linhas.map(([k, v]) => (
        <div key={k} style={{ display: "contents" }}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function LinhaDoTempo({ passagens, anoFinal }: { passagens: Passagem[]; anoFinal: number }) {
  if (!passagens.length)
    return <p className="muted">Sem histórico de escriturador na CVM para esta companhia.</p>;
  const cor = coresDoConjunto(passagens.map((p) => p.instituicao));
  const ini = Math.min(...passagens.map((p) => p.primeiro_ano));
  const total = Math.max(1, anoFinal - ini + 1);
  const ultima = passagens.reduce((a, p) => (p.ultimo_ano >= a.ultimo_ano ? p : a), passagens[0]);
  return (
    <>
      <div className="tlbar" role="img" aria-label="Anos de atuação de cada escriturador">
        {passagens.map((p) => {
          const fim = p === ultima ? anoFinal : p.ultimo_ano;
          return (
            <i
              key={p.instituicao}
              title={`${p.instituicao}: ${p.primeiro_ano}–${fim}`}
              style={{
                width: `${((fim - p.primeiro_ano + 1) / total) * 100}%`,
                background: cor(p.instituicao),
              }}
            />
          );
        })}
      </div>
      <div className="tlaxis" aria-hidden="true">
        <span>{ini}</span>
        <span>{anoFinal}</span>
      </div>
      <ol className="tl">
        {passagens.map((p) => (
          <li key={p.instituicao + p.primeiro_ano}>
            <span className="pt" style={{ background: cor(p.instituicao) }} />
            <div>
              <div className="nm">
                {p.instituicao} {p === ultima ? <span className="badge ok">atual</span> : null}
              </div>
              <div className="qd">
                {p.inicio
                  ? p.inicio_aproximado
                    ? `~${formatDate(p.inicio).slice(3)}`
                    : `desde ${formatDate(p.inicio)}`
                  : `consta desde ${p.primeiro_ano}`}
                {p.fim
                  ? ` · até ${formatDate(p.fim)}`
                  : p === ultima
                    ? ""
                    : ` · consta até o FCA de ${p.ultimo_ano}`}
                {` · FCA ${p.primeiro_ano}–${p.ultimo_ano}`}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

/** Listagem na CVM e, juntos em ordem cronológica, os segmentos e os escrituradores da companhia. */
export function Listagem({
  listagem,
  segmentos,
  passagens,
}: {
  listagem: Acao["listagem"];
  segmentos: TrechoSegmento[];
  passagens: Passagem[];
}) {
  const fatos = [
    ...segmentos.map((s, i) => ({
      data: s.desde,
      ano: s.desde.slice(0, 4),
      texto: i === 0 ? `Segmento ${s.segmento}, no início da série` : `Segmento ${s.segmento}`,
      aprox: true,
      fonte: "CVM",
    })),
    ...passagens.map((p) => ({
      data: p.inicio ?? `${p.primeiro_ano}-01-01`,
      ano: (p.inicio ?? String(p.primeiro_ano)).slice(0, 4),
      texto: `Escriturador ${p.instituicao}`,
      aprox: p.inicio_aproximado || !p.inicio,
      fonte: "CVM",
    })),
  ].sort((a, b) => b.data.localeCompare(a.data));
  return (
    <Cartao
      coluna="c12"
      titulo="Listagem"
      descricao="Segmentos e escrituradores em ordem cronológica, do mais recente ao mais antigo"
    >
      <Lista
        linhas={[
          [
            "Listada desde",
            listagem?.desde
              ? `${formatDate(listagem.desde)}${listagem.desde_incerto ? " (data incerta)" : ""}`
              : "Não informado",
          ],
          ["Segmento na CVM", listagem?.segmento_cvm ?? "Não informado"],
          ["Mercado", listagem?.mercado ?? "Não informado"],
        ]}
      />
      {listagem?.segmento_divergente ? (
        <p className="note">
          <span className="badge">CVM indica {listagem.segmento_cvm}</span> O segmento informado pela CVM
          difere do informado pela B3. Nenhuma fonte corrige a outra.
        </p>
      ) : null}
      {fatos.length ? (
        <ol className="fatos">
          {fatos.map((f) => (
            <li key={f.data + f.texto}>
              <span className="fatos-ano">{f.ano}</span>
              <span>
                {f.texto}
                {f.aprox ? <span className="muted"> (aprox.)</span> : null}
              </span>
              <span className="muted">{f.fonte}</span>
            </li>
          ))}
        </ol>
      ) : null}
      <p className="note">
        A data de um segmento é a da primeira referência anual em que ele aparece no Formulário Cadastral, e a
        série começa em 2018.{" "}
        <Link prefetch={false} href="/sobre/#metodologia-listagem" className="fonte-link">
          Metodologia
        </Link>
      </p>
    </Cartao>
  );
}
