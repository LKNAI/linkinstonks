// Formatação pt-BR (seção 3.5): números com Intl, datas dd/mm/aaaa, fuso America/Sao_Paulo.
const TZ = "America/Sao_Paulo";

const inteiro = new Intl.NumberFormat("pt-BR");
const percentual = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export const formatInt = (n: number): string => inteiro.format(n);

export const formatPct = (parte: number, total: number): string =>
  total ? `${percentual.format((parte / total) * 100)}%` : "0%";

/** "2026-10-29" -> "29/10/2026". Sem `Date`, para não deslocar o dia por fuso. */
export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** Instante ISO (UTC) -> "dd/mm/aaaa hh:mm" em horário de Brasília. */
export function formatDateTime(isoUtc: string): string {
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) return "";
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: TZ,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;

/** "2026-09" -> "set/26". */
export const rotuloMes = (mes: string): string => `${MESES[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}`;
export const abreviaMes = (mes: string): string => MESES[Number(mes.slice(5, 7)) - 1];

const decimal1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const decimal0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Moeda compacta (valor em R$): "R$ 1,2 bi", "R$ 34,5 mi", "R$ 120 mil", "< R$ 1 mil" ou "—". */
export function formatDinheiro(reais: number): string {
  const a = Math.abs(reais);
  if (a >= 1e9)
    return `R$ ${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: a >= 1e11 ? 0 : 1 }).format(reais / 1e9)} bi`;
  if (a >= 1e6) return `R$ ${decimal1.format(reais / 1e6)} mi`;
  if (a >= 1e3) return `R$ ${decimal0.format(reais / 1e3)} mil`;
  return a ? "< R$ 1 mil" : "—";
}

export const formatBRL = (n: number): string => brl.format(n);

export interface Variacao {
  tipo: "novo" | "alta" | "queda" | "nenhuma";
  texto: string;
}

/** Variação de `a` sobre `b`: "novo" se `b` é zero e `a` não; ▲/▼ com percentual inteiro. */
export function variacao(a: number, b: number): Variacao {
  if (!b) return a ? { tipo: "novo", texto: "novo" } : { tipo: "nenhuma", texto: "" };
  const r = (a / b - 1) * 100;
  return { tipo: r >= 0 ? "alta" : "queda", texto: `${r >= 0 ? "▲" : "▼"} ${decimal0.format(Math.abs(r))}%` };
}
