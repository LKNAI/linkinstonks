import type { Metadata } from "next";
import { PainelLiquidez } from "@/components/paineis/PainelLiquidez";

export const metadata: Metadata = {
  title: "Liquidez das ações",
  description:
    "Volume, presença e ticket médio de cada companhia em 3, 6 e 12 meses, com o critério de cada categoria.",
};

export default function Page() {
  return <PainelLiquidez />;
}
