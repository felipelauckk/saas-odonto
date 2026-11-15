import "server-only";

/**
 * Cliente do Asaas com a conta DA CLÍNICA (cobrança do paciente).
 * Diferente de src/lib/asaas.ts, que cobra a mensalidade do SaaS.
 */
export type AsaasCredentials = { apiKey: string; environment: "sandbox" | "production" };

type AsaasError = { errors?: { description?: string }[] };

export class AsaasClinicError extends Error {}

function baseUrl(env: AsaasCredentials["environment"]) {
  return env === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
}

async function request<T>(cred: AsaasCredentials, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${baseUrl(cred.environment)}${path}`, {
    ...init,
    headers: { access_token: cred.apiKey, "Content-Type": "application/json", "User-Agent": "odonto-saas", ...init.headers },
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as T & AsaasError;
  if (response.status === 401) throw new AsaasClinicError("Chave de API do Asaas inválida.");
  if (!response.ok) throw new AsaasClinicError(data.errors?.[0]?.description ?? `Asaas respondeu ${response.status}.`);
  return data;
}

/** Confere se a chave funciona (consulta o saldo). */
export async function checkCredentials(cred: AsaasCredentials) {
  await request<{ balance: number }>(cred, "/finance/balance");
}

export async function createCustomer(cred: AsaasCredentials, input: { name: string; cpfCnpj: string; email?: string | null; mobilePhone?: string | null; externalReference: string }) {
  // Avisos por e-mail/SMS do Asaas desligados: a clínica envia pelo WhatsApp.
  return request<{ id: string }>(cred, "/customers", { method: "POST", body: JSON.stringify({ ...input, notificationDisabled: true }) });
}

export type AsaasPayment = {
  id: string;
  status: string;
  value: number;
  netValue?: number;
  invoiceUrl: string;
  bankSlipUrl?: string | null;
  installment?: string | null;
  externalReference?: string | null;
  paymentDate?: string | null;
  clientPaymentDate?: string | null;
  confirmedDate?: string | null;
  billingType?: string;
};

export async function createPayment(
  cred: AsaasCredentials,
  input: { customer: string; billingType: "PIX" | "BOLETO" | "CREDIT_CARD" | "UNDEFINED"; value: number; dueDate: string; description: string; externalReference: string; installmentCount?: number },
) {
  const body: Record<string, unknown> = { ...input };
  if (input.installmentCount && input.installmentCount > 1) {
    // Parcelado no cartão: o Asaas divide o total.
    body.totalValue = input.value;
    delete body.value;
  } else {
    delete body.installmentCount;
  }
  return request<AsaasPayment>(cred, "/payments", { method: "POST", body: JSON.stringify(body) });
}

export async function getPixQrCode(cred: AsaasCredentials, paymentId: string) {
  return request<{ encodedImage: string; payload: string; expirationDate?: string }>(cred, `/payments/${paymentId}/pixQrCode`);
}

export async function cancelPayment(cred: AsaasCredentials, paymentId: string) {
  return request<{ deleted: boolean }>(cred, `/payments/${paymentId}`, { method: "DELETE" });
}

// Nota fiscal de serviço (NFS-e) --------------------------------------------------------------

export type AsaasInvoice = {
  id: string;
  status: string; // SCHEDULED, SYNCHRONIZED, AUTHORIZED, PROCESSING_CANCELLATION, CANCELED, CANCELLATION_DENIED, ERROR
  number?: string | null;
  pdfUrl?: string | null;
  xmlUrl?: string | null;
  statusDescription?: string | null;
};

/** Como a prefeitura da clínica autentica (certificado ou usuário/senha) — o Asaas informa. */
export async function getMunicipalOptions(cred: AsaasCredentials) {
  return request<{ authenticationType?: string; supportsCancellation?: boolean; municipalInscriptionHelp?: string; specialTaxRegimesList?: { label: string; value: string }[] }>(cred, "/fiscalInfo/municipalOptions");
}

/**
 * Envia os dados fiscais da clínica ao Asaas. O certificado A1 vai direto
 * para o Asaas (não fica guardado no nosso banco).
 */
export async function saveFiscalInfo(
  cred: AsaasCredentials,
  input: { email: string; municipalInscription: string; simplesNacional: boolean; cnae?: string | null; serviceListItem?: string | null; rpsSerie?: string | null; rpsNumber?: number | null; certificate?: { file: Blob; fileName: string; password: string } | null },
) {
  const form = new FormData();
  form.set("email", input.email);
  form.set("municipalInscription", input.municipalInscription);
  form.set("simplesNacional", String(input.simplesNacional));
  if (input.cnae) form.set("cnae", input.cnae);
  if (input.serviceListItem) form.set("serviceListItem", input.serviceListItem);
  if (input.rpsSerie) form.set("rpsSerie", input.rpsSerie);
  if (input.rpsNumber) form.set("rpsNumber", String(input.rpsNumber));
  if (input.certificate) {
    form.set("certificateFile", input.certificate.file, input.certificate.fileName);
    form.set("certificatePassword", input.certificate.password);
  }
  const response = await fetch(`${baseUrl(cred.environment)}/fiscalInfo`, {
    method: "POST",
    headers: { access_token: cred.apiKey, "User-Agent": "odonto-saas" },
    body: form,
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as AsaasError;
  if (response.status === 401) throw new AsaasClinicError("Chave de API do Asaas inválida.");
  if (!response.ok) throw new AsaasClinicError(data.errors?.[0]?.description ?? `Asaas respondeu ${response.status}.`);
}

export async function createInvoice(
  cred: AsaasCredentials,
  input: {
    customer: string;
    serviceDescription: string;
    observations: string;
    value: number;
    effectiveDate: string;
    municipalServiceCode: string;
    municipalServiceName: string;
    externalReference: string;
    taxes: { retainIss: boolean; iss: number; cofins: number; csll: number; inss: number; ir: number; pis: number };
  },
) {
  return request<AsaasInvoice>(cred, "/invoices", { method: "POST", body: JSON.stringify({ ...input, deductions: 0 }) });
}

/** Emite já (sem esperar a data agendada). */
export async function authorizeInvoice(cred: AsaasCredentials, id: string) {
  return request<AsaasInvoice>(cred, `/invoices/${id}/authorize`, { method: "POST" });
}

export async function cancelInvoice(cred: AsaasCredentials, id: string) {
  return request<AsaasInvoice>(cred, `/invoices/${id}/cancel`, { method: "POST" });
}

export async function getInvoice(cred: AsaasCredentials, id: string) {
  return request<AsaasInvoice>(cred, `/invoices/${id}`);
}
