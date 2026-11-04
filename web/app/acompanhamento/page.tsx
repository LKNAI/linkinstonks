import type { Metadata } from "next";
import { Acompanhamento } from "@/components/paineis/Acompanhamento";

export const metadata: Metadata = {
  title: "Minha lista",
  description: "Companhias, BDRs e instituições que você acompanha, guardados só neste navegador.",
  robots: { index: false },
};

export default function Page() {
  return <Acompanhamento />;
}
