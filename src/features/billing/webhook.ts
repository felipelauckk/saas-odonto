import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type AsaasEvent = {
  id?: string;
  event: string;
  payment?: { id: string; subscription?: string | null; externalReference?: string | null; status?: string };
  subscription?: { id: string; externalReference?: string | null };
};

const PAID = ["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"];
const OVERDUE = ["PAYMENT_OVERDUE"];
const CANCELED = ["SUBSCRIPTION_DELETED", "SUBSCRIPTION_INACTIVATED"];

/**
 * Aplica um evento do Asaas na clínica. Idempotente: o mesmo evento (id) não é
 * aplicado duas vezes. Devolve false se o evento não for de nenhuma clínica.
 */
export async function applyAsaasEvent(event: AsaasEvent): Promise<boolean> {
  const admin = createAdminClient();
  const subscriptionId = event.payment?.subscription ?? event.subscription?.id ?? null;
  const reference = event.payment?.externalReference ?? event.subscription?.externalReference ?? null;

  let clinicQuery = admin.from("clinics").select("id, subscription_status, past_due_since");
  clinicQuery = subscriptionId ? clinicQuery.eq("asaas_subscription_id", subscriptionId) : clinicQuery.eq("id", reference ?? "00000000-0000-0000-0000-000000000000");
  const { data: clinic } = await clinicQuery.maybeSingle();

  const eventId = event.id ?? `${event.event}:${event.payment?.id ?? event.subscription?.id ?? ""}`;
  const { error: duplicate } = await admin.from("billing_events").insert({
    clinic_id: clinic?.id ?? null,
    event_id: eventId,
    event: event.event,
    payload: event as never,
  });
  if (duplicate?.code === "23505") return Boolean(clinic); // já processado
  if (!clinic) return false;

  if (PAID.includes(event.event)) {
    await admin.from("clinics").update({ subscription_status: "active", past_due_since: null, canceled_at: null }).eq("id", clinic.id);
  } else if (OVERDUE.includes(event.event) && clinic.subscription_status !== "canceled") {
    await admin
      .from("clinics")
      .update({ subscription_status: "past_due", past_due_since: clinic.past_due_since ?? new Date().toISOString() })
      .eq("id", clinic.id);
  } else if (CANCELED.includes(event.event)) {
    await admin.from("clinics").update({ subscription_status: "canceled", canceled_at: new Date().toISOString() }).eq("id", clinic.id);
  }
  return true;
}
