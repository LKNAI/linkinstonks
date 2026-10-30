import type { Metadata } from "next";
import { PainelAcoes } from "@/components/paineis/PainelAcoes";

export const metadata: Metadata = {
  title: "Ações: escrituradores e volume",
  description:
    "Escriturador atual, data de início, escriturador anterior e volume negociado de cada companhia com ações na B3.",
};

export default function Page() {
  return <PainelAcoes />;
}
