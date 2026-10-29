import type { Metadata } from "next";
import { Novidades } from "@/components/paineis/Novidades";

export const metadata: Metadata = {
  title: "Novidades",
  description: "Trocas de escriturador, novas listagens e novos BDRs detectados a cada coleta.",
};

export default function Page() {
  return <Novidades />;
}
