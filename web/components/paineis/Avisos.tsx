// Avisos repetidos nas telas de negociação: o texto é um só e sempre leva à metodologia.
import Link from "next/link";

export const TEXTO_SUSPEITO =
  "Os negócios podem estar subestimados e o ticket médio, superestimado: o campo da B3 tem 5 dígitos.";

export function NotaEstimativa() {
  return (
    <p className="note">
      Estimativa baseada no tamanho médio dos negócios; não identifica investidores.{" "}
      <Link prefetch={false} href="/sobre/#metodologia-ticket" className="fonte-link">
        Metodologia
      </Link>
    </p>
  );
}

/** Marca discreta antes de um número que pode estar errado na fonte. Sem cor de alerta: é ressalva, não problema. */
export function Aprox({ ativo }: { ativo: boolean }) {
  if (!ativo) return null;
  return (
    <abbr className="aprox" title={TEXTO_SUSPEITO}>
      ≈<span className="sr-only"> (valor aproximado: {TEXTO_SUSPEITO})</span>
    </abbr>
  );
}

export function NotaSuspeitos() {
  return (
    <p className="note">
      <span className="aprox" aria-hidden="true">
        ≈
      </span>{" "}
      {TEXTO_SUSPEITO}{" "}
      <Link prefetch={false} href="/sobre/#metodologia-negocios" className="fonte-link">
        Metodologia
      </Link>
    </p>
  );
}
