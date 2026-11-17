import { existsSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

// Banco de testes separado: o .env.test.local (projeto Supabase só de testes)
// vem antes do .env.local e vale também para o servidor que o Playwright sobe.
// Variáveis já definidas não são sobrescritas pelos arquivos seguintes.
if (existsSync(".env.test.local")) process.loadEnvFile(".env.test.local");
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // A suíte usa um único servidor e o mesmo projeto Supabase (Nano, plano
  // gratuito): com 4 processos o banco esgotava a CPU no meio da suíte e tudo
  // passava a estourar o tempo. E2E_WORKERS ajusta quando o banco for maior.
  workers: Number(process.env.E2E_WORKERS ?? 2),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "celular", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // Versão de produção: o servidor de desenvolvimento compila cada página no
    // primeiro acesso e, com vários testes em paralelo, estourava o tempo.
    // Use E2E_DEV=1 para testar contra o `next dev` (mais rápido para iterar).
    command: process.env.E2E_DEV ? `npm run dev -- --port ${PORT}` : `npm run build && npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
