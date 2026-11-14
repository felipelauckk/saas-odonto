import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gera PDFs no servidor (orçamentos, recibos).
  serverExternalPackages: ["@react-pdf/renderer"],
  experimental: {
    // Logo da clínica (até 1 MB) chega por Server Action; o padrão de 1 MB
    // não cabe o arquivo + o envelope do formulário. Arquivos clínicos maiores
    // vão direto do navegador para o Storage (limite de 4,5 MB da Vercel).
    serverActions: { bodySizeLimit: "2mb" },
  },
  // Cache Components desligado de propósito: quase tudo depende da sessão e de
  // dados por clínica (RLS). Ver docs/PROGRESS.md > Decisões técnicas.
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
