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
