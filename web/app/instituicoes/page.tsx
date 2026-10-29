import type { Metadata } from "next";
import { Instituicoes } from "@/components/paineis/Instituicoes";

export const metadata: Metadata = {
  title: "Instituições",
  description: "Escrituradores e depositárias: ranking, ganhos e perdas de clientes",
};

export default function Page() {
  return <Instituicoes />;
}
