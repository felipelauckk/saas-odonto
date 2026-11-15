import { expect, test } from "@playwright/test";

import { admin, createTestUser, hasSupabase, signIn, type TestUser } from "./support/test-user";

test.skip(!hasSupabase, "Precisa do Supabase configurado no .env.local");

let user: TestUser;

test.beforeEach(async ({ page }) => {
  user = await createTestUser();
  await signIn(page, user);
});

test.afterEach(async () => {
  await user.cleanup();
});

function todaySp() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

test("conta mensal fixa, pagamento, DRE e conciliação por OFX", async ({ page }) => {
  const today = todaySp();
  await page.goto("/financeiro/pagar");
  await page.getByRole("button", { name: "Nova conta" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Descrição").fill("Aluguel da sala");
  await dialog.getByLabel("Categoria").click();
  await page.getByRole("option", { name: "Aluguel e condomínio" }).click();
  await dialog.getByRole("button", { name: "Mensal fixa" }).click();
  await dialog.getByLabel("Valor (R$)").fill("3.000,00");
  await dialog.getByLabel("1º vencimento").fill(today);
  await dialog.getByRole("button", { name: "Lançar" }).click();
  await expect(dialog).toBeHidden();

  const { count } = await admin().from("payables").select("id", { count: "exact", head: true }).eq("clinic_id", user.clinicId);
  expect(count).toBe(12);

  const first = page.getByRole("listitem").filter({ hasText: "Aluguel da sala" }).first();
  await first.getByRole("button", { name: "Pagar" }).click();
  await page.getByRole("button", { name: "Confirmar pagamento" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.goto("/financeiro/caixa");
  await expect(page.getByText("Pagamento: Aluguel da sala")).toBeVisible();

  await page.goto(`/financeiro/dre?mes=${today.slice(0, 7)}`);
  await expect(page.getByRole("row", { name: /Aluguel e condomínio/ })).toContainText("3.000,00");
  await expect(page.getByRole("row", { name: /Resultado do mês/ })).toContainText("-R$");

  const ymd = today.replaceAll("-", "");
  const ofx = `<OFX><BANKACCTFROM><BANKID>001<ACCTID>999</BANKACCTFROM><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>${ymd}<TRNAMT>-3000.00<FITID>T1<MEMO>PAGAMENTO BOLETO ALUGUEL</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>${ymd}<TRNAMT>77.77<FITID>T2<MEMO>TED SEM PAR</STMTTRN>
</BANKTRANLIST></OFX>`;
  await page.goto("/financeiro/conciliacao");
  // Escolher o arquivo antes de a página terminar de carregar perderia o evento.
  await page.waitForLoadState("networkidle");
  await page.locator("#ofx-file").setInputFiles({ name: "extrato.ofx", mimeType: "application/x-ofx", buffer: Buffer.from(ofx) });
  await expect(page.getByText("2 lançamentos importados.")).toBeVisible();
  const line = page.getByRole("listitem").filter({ hasText: "PAGAMENTO BOLETO ALUGUEL" });
  await line.getByRole("button", { name: /Conciliar com: Aluguel da sala/ }).click();
  await expect(line.getByText("Conciliado")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "TED SEM PAR" })).toContainText("Sem par sugerido");

  // Reimportar não duplica.
  await page.locator("#ofx-file").setInputFiles({ name: "extrato.ofx", mimeType: "application/x-ofx", buffer: Buffer.from(ofx) });
  await expect(page.getByText(/0 lançamentos importados \(2 já existiam\)/)).toBeVisible();

  // Cancelar as próximas da recorrência.
  await page.goto("/financeiro/pagar");
  await page.getByRole("button", { name: "Mais ações: Aluguel da sala" }).first().click();
  await page.getByRole("menuitem", { name: "Cancelar esta e as próximas" }).click();
  await expect(page.getByText("11 contas canceladas.")).toBeVisible();
});
