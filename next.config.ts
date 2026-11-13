import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
