import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { TooltipProvider } from "@/components/charts/Tooltip";
import { SiteFooter, SiteHeader, StaleBanner } from "@/components/layout/SiteChrome";
import "./dashboard.css";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "linkinstonks", template: "%s · linkinstonks" },
  description:
    "Escrituradores de ações e depositárias de BDRs na B3, a partir de dados públicos da B3 e da CVM.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body className="flex min-h-screen flex-col">
        <TooltipProvider>
          <SiteHeader />
          <StaleBanner />
          <main id="conteudo" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </TooltipProvider>
      </body>
    </html>
  );
}
