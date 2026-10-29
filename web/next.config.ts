import type { NextConfig } from "next";

// Site 100% estático (ADR 0002). Cabeçalhos de segurança e cache ficam no vercel.json:
// `headers`, `redirects` e `rewrites` do Next não funcionam com `output: "export"`.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  // Processa o Tailwind v4 no Turbopack (vem do scaffold; sem isso o CSS sai sem utilitários).
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
