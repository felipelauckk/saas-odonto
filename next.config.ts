import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cabeçalhos de segurança em todas as respostas.
  async headers() {
    return [
      {
        // O formulário de captação pode ser incorporado no site da clínica (iframe).
        source: "/captacao/:token",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }],
      },
      {
        source: "/:path((?!captacao/).*)",
        headers: [{ key: "X-Frame-Options", value: "DENY" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
  // Gera PDFs no servidor (orçamentos, recibos).
  serverExternalPackages: ["@react-pdf/renderer"],
  // Fontes dos PDFs (Montserrat) lidas do disco: precisam ir junto nas funções da Vercel.
  outputFileTracingIncludes: { "/**": ["./src/lib/pdf/fonts/*.ttf"] },
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
