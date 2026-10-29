import type { Metadata } from "next";
import { TabelaAcoes } from "@/components/paineis/TabelaAcoes";

export const metadata: Metadata = {
  title: "Tabela de ações",
  description: "Todas as empresas com ações na B3, com tickers, escriturador e histórico na CVM.",
};

export default function Page() {
  return <TabelaAcoes />;
}
