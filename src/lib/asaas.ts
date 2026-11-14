import "server-only";

/**
 * Cliente mínimo da API do Asaas (cobrança recorrente).
 * ASAAS_ENV=production usa a API real; qualquer outro valor, o sandbox.
 */

type AsaasError = { errors?: { description?: string }[] };

export function isAsaasConfigured(): boolean {
  return Boolean(process.env.ASAAS_API_KEY);
}

function baseUrl() {
  return process.env.ASAAS_ENV === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new Error("Cobrança não configurada (ASAAS_API_KEY).");
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: { access_token: key, "Content-Type": "application/json", "User-Agent": "odonto-saas", ...init.headers },
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as T & AsaasError;
  if (!response.ok) throw new Error(data.errors?.[0]?.description ?? `Asaas respondeu ${response.status}.`);
  return data;
}

export async function createCustomer(input: { name: string; cpfCnpj: string; email?: string | null; mobilePhone?: string | null; externalReference: string }) {
  return request<{ id: string }>("/customers", { method: "POST", body: JSON.stringify(input) });
}

/** Assinatura mensal; billingType UNDEFINED deixa o cliente escolher Pix, boleto ou cartão na fatura. */
export async function createSubscription(input: { customer: string; value: number; nextDueDate: string; description: string; externalReference: string }) {
  return request<{ id: string }>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({ ...input, billingType: "UNDEFINED", cycle: "MONTHLY" }),
  });
}

export async function updateSubscriptionValue(id: string, value: number, description: string) {
  return request<{ id: string }>(`/subscriptions/${id}`, {
    method: "PUT",
    body: JSON.stringify({ value, description, updatePendingPayments: true }),
  });
}

export async function cancelSubscription(id: string) {
  return request<{ deleted: boolean }>(`/subscriptions/${id}`, { method: "DELETE" });
}

/** Link da fatura em aberto mais próxima (página do Asaas para pagar). */
export async function nextInvoiceUrl(subscriptionId: string): Promise<string | null> {
  const data = await request<{ data: { invoiceUrl: string; status: string; dueDate: string }[] }>(
    `/subscriptions/${subscriptionId}/payments?limit=20`,
  );
  const open = data.data
    .filter((p) => ["PENDING", "OVERDUE"].includes(p.status))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return open[0]?.invoiceUrl ?? null;
}
