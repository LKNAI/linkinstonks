import type { Metadata } from "next";
import { PainelBdrs } from "@/components/paineis/PainelBdrs";

export const metadata: Metadata = {
  title: "BDRs: depositárias e volume",
  description: "BDRs negociados na B3: depositária, tipo de programa e volume financeiro mensal.",
};

export default function Page() {
  return <PainelBdrs />;
}
