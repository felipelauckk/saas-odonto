import { expect, test, type Page } from "@playwright/test";

import { createTestUser, hasSupabase, seedAgenda, signIn, type TestUser } from "./support/test-user";

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
  if (data.birth) await page.getByLabel("Data de nascimento", { exact: true }).fill(data.birth);
  if (data.guardian) await page.getByLabel("Nome do responsável").fill(data.guardian);
  if (data.phone) await page.getByLabel("Celular", { exact: true }).fill(data.phone);
  await page.getByRole("button", { name: "Cadastrar paciente" }).click();
  await expect(page.getByRole("heading", { level: 1, name: data.name })).toBeVisible();
}

test("cadastra paciente com CEP preenchendo o endereço e consentimento LGPD", async ({ page }) => {
  await page.goto("/pacientes");
  await expect(page.getByText("Nenhum paciente por enquanto")).toBeVisible();
  await page.getByRole("link", { name: "Novo paciente" }).first().click();

  // Cadastro rápido no painel; o endereço fica no completo.
  await page.getByLabel("Nome completo").fill("Joana Conceição");
  await page.getByLabel("CPF", { exact: true }).fill("529.982.247-25");
  await page.getByLabel("Celular", { exact: true }).fill("(11) 98888-7777");
  await expect(page.getByLabel("CEP")).toBeHidden();
  await page.getByRole("button", { name: "Preencher cadastro completo" }).click();
  // O que já foi digitado continua lá.
  await expect(page.getByLabel("Nome completo")).toHaveValue("Joana Conceição");
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
  await expect(page.getByRole("main").getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/5511988887777");
});

test("menor de idade exige responsável: o erro aparece no bloco certo e a tela rola até ele", async ({ page }) => {
  await page.goto("/pacientes/novo");
  await page.getByLabel("Nome completo").fill("Pedro Criança");
  await page.getByLabel("Data de nascimento", { exact: true }).fill("2020-03-10");
  await expect(page.getByText("6 anos · menor de idade")).toBeVisible();
  await page.getByRole("button", { name: "Cadastrar paciente" }).click();
  const block = page.getByRole("region", { name: "Responsável e família" });
  await expect(block.getByText("Paciente menor de idade: informe o nome do responsável.")).toBeVisible();
  await expect(block.getByText("Informe o CPF do responsável.")).toBeVisible();
  await expect(block.getByLabel("Nome do responsável")).toBeInViewport();

  await page.getByLabel("Nome do responsável").fill("Carla Criança");
  await page.getByLabel("CPF do responsável").fill("529.982.247-25");
  await page.getByLabel("Telefone do responsável").fill("(11) 97777-6666");
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
  await page.getByRole("textbox", { name: /E-mail/ }).fill("bruno@example.com");
  await page.getByLabel("Profissão").fill("Engenheiro");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("bruno@example.com")).toBeVisible();
  await expect(page.getByText("Engenheiro")).toBeVisible();

  // Histórico: quem mudou o quê.
  await page.getByRole("button", { name: "Ver histórico" }).click();
  const history = page.getByRole("dialog");
  await expect(history.getByText("Cadastro alterado · Pessoa Teste")).toBeVisible();
  await expect(history.getByText("Profissão:")).toBeVisible();
  await expect(history.getByText("Engenheiro")).toBeVisible();
  await page.keyboard.press("Escape");

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

test("origens da clínica: a nova aparece no cadastro, no filtro de Pacientes e no CRM", async ({ page }) => {
  await page.goto("/configuracoes/pacientes");
  await page.getByLabel("Nome da nova origem").fill("Feira de saúde");
  await page.getByRole("button", { name: "Incluir origem" }).click();
  await expect(page.getByText("Origem incluída.")).toBeVisible();
  await expect(page.getByRole("list", { name: "Origens" }).getByText("Feira de saúde")).toBeVisible();

  // Cadastro com a origem nova; "Indicação" mostra "Indicado por".
  await page.goto("/pacientes/novo");
  await page.getByLabel("Nome completo").fill("Rita Feira");
  await page.getByLabel("Como conheceu a clínica").selectOption({ label: "Indicação" });
  await expect(page.getByText("Indicado por")).toBeVisible();
  await page.getByLabel("Como conheceu a clínica").selectOption({ label: "Feira de saúde" });
  await page.getByRole("button", { name: "Cadastrar paciente" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Rita Feira" })).toBeVisible();
  await expect(page.getByText("feira de saúde").first()).toBeVisible();

  // Filtro de Pacientes.
  await page.goto("/pacientes");
  await page.getByLabel("Origem").click();
  await page.getByRole("option", { name: "Feira de saúde" }).click();
  await expect(page).toHaveURL(/source=/);
  await expect(page.getByRole("link", { name: /Rita Feira/ })).toBeVisible();

  // CRM: a mesma lista no novo lead.
  await page.goto("/crm");
  await page.getByRole("button", { name: "Novo lead" }).click();
  await page.getByRole("dialog").getByLabel("Origem").click();
  await expect(page.getByRole("option", { name: "Feira de saúde" })).toBeVisible();
});

test("outros telefones e redes sociais aparecem na aba Dados", async ({ page }) => {
  await page.goto("/pacientes/novo");
  await page.getByLabel("Nome completo").fill("Lia Contatos");
  await page.getByRole("button", { name: "Adicionar telefone" }).click();
  await page.getByLabel("Nome do telefone 1").fill("Trabalho");
  await page.getByLabel("Número do telefone 1").fill("(11) 3333-4444");
  await page.getByLabel("Instagram").fill("@lia.contatos");
  await page.getByText("Não tem e-mail").click();
  await page.getByRole("button", { name: "Cadastrar paciente" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Lia Contatos" })).toBeVisible();
  await expect(page.getByText("Telefone: Trabalho")).toBeVisible();
  await expect(page.getByText("(11) 3333-4444")).toBeVisible();
  await expect(page.getByText("@lia.contatos")).toBeVisible();
  await expect(page.getByText("Não tem e-mail")).toBeVisible();
});

test("cadastro rápido pela Nova consulta: cadastra e já seleciona o paciente", async ({ page }) => {
  await seedAgenda(user);
  await page.goto("/agenda?data=2030-03-04");
  await page.getByRole("button", { name: "Marcar consulta Dra. Ana às 09:00" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Paciente").fill("Nina Rápida");
  await dialog.getByRole("button", { name: 'Cadastrar "Nina Rápida"' }).click();
  const sheet = page.getByRole("dialog", { name: "Novo paciente" });
  await expect(sheet.getByLabel("Nome completo")).toHaveValue("Nina Rápida");
  await sheet.getByLabel("Celular", { exact: true }).fill("(11) 96666-5555");
  await sheet.getByRole("button", { name: "Cadastrar paciente" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("dialog").getByText("Nina Rápida")).toBeVisible();
  await expect(page.getByRole("dialog").getByText("WhatsApp (11) 96666-5555")).toBeVisible();
});
