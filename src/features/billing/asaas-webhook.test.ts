/**
 * Webhook do Asaas: token obrigatório, pagamento ativa, atraso marca a data
 * (sem regravar), cancelamento e idempotência pelo id do evento.
 */
import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createTestEnv, hasSupabase } from "@/test/supabase";

describe.skipIf(!hasSupabase)("webhook do Asaas", () => {
  const env = createTestEnv("asaas");
  const admin = env.admin;
  const subscriptionId = `sub_teste_${randomUUID().slice(0, 8)}`;
  let clinicId = "";

  async function send(event: string, id = randomUUID(), token = "token-teste") {
    const { POST } = await import("@/app/api/asaas/webhook/route");
    return POST(
      new Request("http://x/api/asaas/webhook", {
        method: "POST",
        headers: { "asaas-access-token": token, "content-type": "application/json" },
        body: JSON.stringify({ id, event, payment: { id: `pay_${id}`, subscription: subscriptionId } }),
      }),
    );
  }
  const clinic = async () =>
    (await admin.from("clinics").select("subscription_status, past_due_since").eq("id", clinicId).single()).data!;

  beforeAll(async () => {
    vi.stubEnv("ASAAS_WEBHOOK_TOKEN", "token-teste");
    clinicId = (await env.createUser("owner", "Clínica Asaas")).clinicId!;
    await admin.from("clinics").update({ asaas_subscription_id: subscriptionId }).eq("id", clinicId);
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await admin.from("billing_events").delete().eq("clinic_id", clinicId);
    await env.cleanup();
  });

  it("recusa token errado", async () => {
    expect((await send("PAYMENT_CONFIRMED", randomUUID(), "outro-token")).status).toBe(401);
    expect((await clinic()).subscription_status).toBe("trialing");
  });

  it("atraso marca a data uma vez; pagamento reativa; evento repetido é ignorado", async () => {
    await send("PAYMENT_OVERDUE");
    const first = await clinic();
    expect(first.subscription_status).toBe("past_due");
    expect(first.past_due_since).not.toBeNull();

    await send("PAYMENT_OVERDUE");
    expect((await clinic()).past_due_since).toBe(first.past_due_since);

    const paymentEvent = randomUUID();
    await send("PAYMENT_RECEIVED", paymentEvent);
    expect(await clinic()).toEqual({ subscription_status: "active", past_due_since: null });

    await admin.from("clinics").update({ subscription_status: "past_due" }).eq("id", clinicId);
    await send("PAYMENT_RECEIVED", paymentEvent); // mesmo id: não aplica de novo
    expect((await clinic()).subscription_status).toBe("past_due");
  });

  it("assinatura removida cancela", async () => {
    await send("SUBSCRIPTION_DELETED");
    expect((await clinic()).subscription_status).toBe("canceled");
  });
});
