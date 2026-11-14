import { expect, test, type Page } from "@playwright/test";

import { createTestUser, hasSupabase, signIn, type TestUser } from "./support/test-user";

test.skip(!hasSupabase, "Precisa do Supabase configurado no .env.local");

let user: TestUser;

test.beforeEach(async ({ page }) => {
  user = await createTestUser();
  // CEP simulado: o teste não depende do ViaCEP estar no ar.
  await page.route("https://viacep.com.br/ws/**", (route) =>
    route.fulfill({
      json: { cep: "01310-100", logradouro: "Avenida Paulista", bairro: "Bela Vista", localidade: "São Paulo", uf: "SP" },
    }),
  );
  await signIn(page, user);
});

test.afterEach(async () => {
  await user.cleanup();
});

async function createPatient(page: Page, data: { name: string; cpf?: string; phone?: string; birth?: string; guardian?: string }) {
  await page.goto("/pacientes/novo");
  await page.getByLabel("Nome completo").fill(data.name);
  if (data.cpf) await page.getByLabel("CPF", { exact: true }).fill(data.cpf);
  if (data.birth) await page.getByLabel("Data de nascimento").fill(data.birth);
  if (data.guardian) await page.getByLabel("Nome do responsável").fill(data.guardian);
  if (data.phone) await page.getByLabel("Telefone", { exact: true }).fill(data.phone);
  await page.getByRole("button", { name: "Cadastrar paciente" }).click();
  await expect(page.getByRole("heading", { level: 1, name: data.name })).toBeVisible();
}

test("cadastra paciente com CEP preenchendo o endereço e consentimento LGPD", async ({ page }) => {
  await page.goto("/pacientes");
  await expect(page.getByText("Nenhum paciente por enquanto")).toBeVisible();
  await page.getByRole("link", { name: "Novo paciente" }).first().click();

  await page.getByLabel("Nome completo").fill("Joana Conceição");
  await page.getByLabel("CPF", { exact: true }).fill("529.982.247-25");
  await page.getByLabel("Telefone", { exact: true }).fill("(11) 98888-7777");
  await page.getByLabel("CEP").fill("01310-100");
  await expect(page.getByLabel("Rua")).toHaveValue("Avenida Paulista");
  await expect(page.getByLabel("Cidade")).toHaveValue("São Paulo");
  await page.getByLabel("Número", { exact: true }).fill("1000");
  await page.getByText(/autorizou a clínica a guardar/).click();
  await page.getByRole("button", { name: "Cadastrar paciente" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Joana Conceição" })).toBeVisible();
  await expect(page.getByText("529.982.247-25")).toBeVisible();
  await expect(page.getByText(/Avenida Paulista, 1000/)).toBeVisible();
  await expect(page.getByText(/Registrado em/)).toBeVisible();
  // WhatsApp igual ao telefone por padrão.
  await expect(page.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/5511988887777");
});

test("menor de idade exige responsável", async ({ page }) => {
  await page.goto("/pacientes/novo");
  await page.getByLabel("Nome completo").fill("Pedro Criança");
  await page.getByLabel("Data de nascimento").fill("2020-03-10");
  await page.getByRole("button", { name: "Cadastrar paciente" }).click();
  await expect(page.getByText("Paciente menor de idade: informe o responsável.")).toBeVisible();

  await page.getByLabel("Nome do responsável").fill("Carla Criança");
  await page.getByRole("button", { name: "Cadastrar paciente" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Pedro Criança" })).toBeVisible();
  await expect(page.getByText("Menor de idade")).toBeVisible();
  await expect(page.getByText("Carla Criança")).toBeVisible();
});

test("busca por nome sem acento, CPF e telefone", async ({ page }) => {
  await createPatient(page, { name: "Joana Conceição", cpf: "52998224725", phone: "11988887777" });
  await createPatient(page, { name: "Marcos Lima", phone: "21977776666" });

  await page.goto("/pacientes");
  const search = page.getByLabel("Buscar paciente");
  const list = page.getByRole("list").filter({ has: page.getByRole("link") });

  await search.fill("conceicao");
  await expect(page).toHaveURL(/q=conceicao/);
  await expect(list.getByRole("link")).toHaveCount(1);
  await expect(list).toContainText("Joana Conceição");

  await search.fill("529.982");
  await expect(page).toHaveURL(/q=529/);
  await expect(list).toContainText("Joana Conceição");

  await search.fill("97777");
  await expect(page).toHaveURL(/q=97777/);
  await expect(list).toContainText("Marcos Lima");
  await expect(list.getByRole("link")).toHaveCount(1);

  await search.fill("zzz");
  await expect(page.getByText("Nenhum paciente encontrado")).toBeVisible();
});

test("CPF duplicado mostra a ficha existente", async ({ page }) => {
  await createPatient(page, { name: "Joana Conceição", cpf: "52998224725" });
  await page.goto("/pacientes/novo");
  await page.getByLabel("Nome completo").fill("Outra Pessoa");
  await page.getByLabel("CPF", { exact: true }).fill("52998224725");
  await page.getByRole("button", { name: "Cadastrar paciente" }).click();
  await expect(page.getByText("Já existe um paciente com este CPF: Joana Conceição.")).toBeVisible();
  await page.getByRole("link", { name: "Abrir a ficha do paciente já cadastrado" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Joana Conceição" })).toBeVisible();
});

test("edita, arquiva e reativa", async ({ page }) => {
  await createPatient(page, { name: "Bruno Alves" });

  await page.getByRole("link", { name: "Editar dados" }).click();
  await page.getByLabel("E-mail").fill("bruno@example.com");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("bruno@example.com")).toBeVisible();

  await page.getByRole("button", { name: "Arquivar" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Arquivar" }).click();
  await expect(page.getByText("Arquivado", { exact: true })).toBeVisible();

  await page.goto("/pacientes");
  await expect(page.getByText("Todos os pacientes estão arquivados. Veja em Arquivados.")).toBeVisible();
  await page.getByRole("button", { name: "Arquivados" }).click();
  await expect(page.getByRole("link", { name: /Bruno Alves/ })).toBeVisible();
  await page.getByRole("link", { name: /Bruno Alves/ }).click();

  await page.getByRole("button", { name: "Reativar paciente" }).click();
  await expect(page.getByRole("button", { name: "Arquivar" })).toBeVisible();
});

test("abas futuras mostram aviso de em breve", async ({ page }) => {
  await createPatient(page, { name: "Clara Dias" });
  await page.getByRole("navigation", { name: "Ficha do paciente" }).getByRole("link", { name: "Orçamentos" }).click();
  await expect(page.getByText("Orçamentos em breve")).toBeVisible();
});
