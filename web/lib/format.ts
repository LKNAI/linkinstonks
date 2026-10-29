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
