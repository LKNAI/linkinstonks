// Rótulos legíveis para ids internos que vêm dos dados (fontes e eventos). Um só lugar para Capa, Novidades e Status.
import { SEGMENTO_NOME } from "@/lib/palette";
import type { Acao, Evento } from "@/lib/schemas";

export const NOME_FONTE: Record<string, string> = {
  b3_listed: "B3 · Empresas listadas",
  b3_bdr_api: "B3 · BDRs (API)",
  b3_cotahist: "B3 · Cotações de BDRs (COTAHIST)",
  b3_cotahist_acoes: "B3 · Cotações de ações (COTAHIST)",
  b3_finservices: "Banco B3 · programas de BDR",
  bradesco: "Bradesco Custódia",
  cvm_fca: "CVM · Formulário Cadastral",
  cvm_cad: "CVM · Cadastro de companhias",
};

export const ROTULO_TIPO: Record<string, string> = {
  nova_listagem: "Nova listagem",
  deslistagem: "Deslistagem",
  troca_escriturador: "Troca de escriturador",
  divergencia_b3_cvm: "Divergência B3 × CVM",
  ticker_novo: "Novo ticker",
  ticker_removido: "Ticker removido",
  mudanca_segmento: "Mudança de segmento",
  novo_bdr: "Novo BDR",
  bdr_cancelado: "BDR cancelado",
  troca_depositaria: "Troca de depositária",
};

export const NOME_DATASET: Record<string, string> = {
  acoes: "Ações",
  acoes_volume: "Volume das ações",
  bdrs: "BDRs",
};

// Status gravados pelo ETL em meta.json (schemas/meta.schema.json).
export const ROTULO_STATUS_FONTE: Record<string, string> = {
  ok: "Atualizada",
  desatualizado: "Desatualizada",
  erro: "Com erro",
};

/** Nome do item do evento: ações pelo nome de pregão (CVM 25887 → ARANDU), BDRs pelo próprio ticker. */
export function nomeDoItem(e: Evento, acoes: readonly Acao[] = []): string {
  if (e.dataset !== "acoes") return e.chave;
  const a = acoes.find((c) => c.codigo_cvm === e.chave);
  if (a) return a.pregao || a.razao_social;
  // Empresa que saiu da lista (deslistagem): o evento guarda o nome de pregão em `de`.
  if (e.tipo === "deslistagem" && e.de) return e.de;
  return `CVM ${e.chave}`;
}

const rotuloSegmento = (s: string | null | undefined): string => (s == null ? "—" : (SEGMENTO_NOME[s] ?? s));

/** "Novo Mercado → Tradicional" para mudança de segmento; "de → para" nos demais; null quando não há detalhe. */
export function mudancaDoEvento(e: Evento): string | null {
  if (!e.de && !e.para) return null;
  if (e.tipo === "mudanca_segmento") return `${rotuloSegmento(e.de)} → ${rotuloSegmento(e.para)}`;
  // Deslistagem: `de` é só o nome de pregão (já mostrado como item), sem destino.
  if (e.tipo === "deslistagem") return null;
  return `${e.de ?? "—"} → ${e.para ?? "—"}`;
}
