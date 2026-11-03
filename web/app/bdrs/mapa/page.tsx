import type { Metadata } from "next";
import { PainelMapa } from "@/components/paineis/PainelMapa";

export const metadata: Metadata = {
  title: "Mapa de calor dos BDRs",
  description:
    "Volume mensal de cada BDR em 24 meses: intensidade em relação ao pico e variação contra a média.",
};

export default function Page() {
  return <PainelMapa />;
}
