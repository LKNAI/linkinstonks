import type { Metadata } from "next";
import { Capa } from "@/components/paineis/Capa";

export const metadata: Metadata = { title: "Painel B3: escrituradores e BDRs" };

export default function Home() {
  return <Capa />;
}
