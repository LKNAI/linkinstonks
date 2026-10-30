import type { Metadata } from "next";
import { Catalogo } from "@/components/design/Catalogo";

// Catálogo interno do design system: fora do sitemap e sem indexação.
export const metadata: Metadata = {
  title: "Design system",
  description: "Catálogo interno: tokens, tipografia, cores e componentes com todos os estados.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <Catalogo />;
}
