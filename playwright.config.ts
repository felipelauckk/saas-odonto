import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // A suíte usa um único servidor e o mesmo projeto Supabase: com um processo
  // por núcleo, o servidor ficava lento e os testes estouravam o tempo à toa.
  workers: process.env.CI ? 2 : 4,
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
