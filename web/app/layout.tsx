import type { Metadata } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { TooltipProvider } from "@/components/charts/Tooltip";
import { SiteFooter, SiteHeader, StaleBanner } from "@/components/layout/SiteChrome";
import "./dashboard.css";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], display: "swap" });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Painel B3", template: "%s · Painel B3" },
  description:
    "Escrituradores de ações e depositárias de BDRs na B3, a partir de dados públicos da B3 e da CVM.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${jakarta.variable} ${jetbrains.variable}`}>
      <body className="flex min-h-screen flex-col">
        <TooltipProvider>
          <SiteHeader />
          <StaleBanner />
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </TooltipProvider>
      </body>
    </html>
  );
}
