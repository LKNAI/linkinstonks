// Aviso de dados desatualizados (seção 11.4): fonte diária parada há mais de 3 dias úteis, ou semanal há mais de 10 dias.
import type { Meta } from "@/lib/schemas";

export const FONTES_DIARIAS = ["b3_listed", "b3_cotahist", "b3_bdr_api", "cvm_fca"] as const;
export const FONTES_SEMANAIS = ["b3_finservices", "bradesco", "cvm_cad"] as const;
export const LIMITE_DIARIA_DIAS_UTEIS = 3;
export const LIMITE_SEMANAL_DIAS = 10;

const ROTULO: Record<string, string> = {
  b3_listed: "B3 (empresas listadas)",
  b3_cotahist: "B3 (cotações)",
  b3_bdr_api: "B3 (BDRs)",
  cvm_fca: "CVM (formulário cadastral)",
  b3_finservices: "Banco B3 (depositárias)",
  bradesco: "Bradesco (depositárias)",
  cvm_cad: "CVM (cadastro)",
};

const dia = (iso: string): number => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));

/** Dias úteis (seg-sex) no intervalo (de, até]. */
export function diasUteisEntre(de: string, ate: string): number {
  let n = 0;
  for (let t = dia(de) + 86400000; t <= dia(ate); t += 86400000) {
    const w = new Date(t).getUTCDay();
    if (w !== 0 && w !== 6) n++;
  }
  return n;
}

export const diasEntre = (de: string, ate: string): number => Math.round((dia(ate) - dia(de)) / 86400000);

export interface Atraso {
  fonte: string;
  rotulo: string;
  motivo: string;
}

export function fontesDesatualizadas(meta: Meta, hoje: string): Atraso[] {
  const saida: Atraso[] = [];
  const checar = (fonte: string, excedeu: (ultimo: string) => boolean, texto: string) => {
    const f = meta.fontes[fonte];
    if (!f) return;
    const rotulo = ROTULO[fonte] ?? fonte;
    if (f.status !== "ok")
      saida.push({
        fonte,
        rotulo,
        motivo: f.status === "erro" ? "com erro na última coleta" : "fora do ar na última coleta",
      });
    else if (f.ultimo_sucesso && excedeu(f.ultimo_sucesso)) saida.push({ fonte, rotulo, motivo: texto });
  };
  for (const f of FONTES_DIARIAS)
    checar(
      f,
      (u) => diasUteisEntre(u, hoje) > LIMITE_DIARIA_DIAS_UTEIS,
      `sem atualização há mais de ${LIMITE_DIARIA_DIAS_UTEIS} dias úteis`,
    );
  for (const f of FONTES_SEMANAIS)
    checar(
      f,
      (u) => diasEntre(u, hoje) > LIMITE_SEMANAL_DIAS,
      `sem atualização há mais de ${LIMITE_SEMANAL_DIAS} dias`,
    );
  return saida;
}

/** Data de hoje em Brasília, AAAA-MM-DD. */
export function hojeEmBrasilia(agora: Date = new Date()): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
  return p; // en-CA já formata como AAAA-MM-DD
}

export function ultimaAtualizacao(meta: Meta): string | null {
  const datas = Object.values(meta.datasets).map((d) => d.atualizado_em);
  return datas.length ? (datas.sort().at(-1) ?? null) : null;
}
