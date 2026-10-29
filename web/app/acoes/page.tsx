import type { Metadata } from "next";
import { PainelAcoes } from "@/components/paineis/PainelAcoes";

export const metadata: Metadata = {
  title: "Ações: escrituradores",
  description:
    "Escriturador atual, data de início e escriturador anterior de cada companhia com ações na B3.",
};

export default function Page() {
  return <PainelAcoes />;
}
