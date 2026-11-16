"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { cancelSubscription, createCustomer, createSubscription, isAsaasConfigured, nextInvoiceUrl, updateSubscriptionValue } from "@/lib/asaas";
import { todayIso } from "@/lib/dates";
import { BRAND } from "@/lib/brand";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/features/tenancy/queries";

type Result = { error?: string; url?: string; message?: string };

async function ownerContext() {
  const session = await getSessionContext();
  if (!session?.clinic || session.clinic.role !== "owner") return null;
  return { clinic: session.clinic };
}

/**
 * Assina (ou troca de) plano. Cria cliente e assinatura no Asaas e devolve o link
 * da fatura. Os campos de cobrança da clínica só são gravados pelo servidor.
 */
export async function subscribeToPlan(planId: string): Promise<Result> {
  if (!z.uuid().safeParse(planId).success) return { error: "Plano inválido." };
  const session = await ownerContext();
  if (!session) return { error: "Só o proprietário da clínica pode assinar." };
  if (!isAsaasConfigured()) return { error: "A cobrança ainda não está configurada. Fale com o suporte." };

  const supabase = await createClient();
  const admin = createAdminClient();
  const [{ data: plan }, { data: clinic }] = await Promise.all([
    supabase.from("plans").select("id, name, price_cents, max_units, max_professionals").eq("id", planId).eq("active", true).single(),
    admin.from("clinics").select("id, name, legal_name, document_cnpj_cpf, email, phone, asaas_customer_id, asaas_subscription_id, trial_ends_at, subscription_status").eq("id", session.clinic.id).single(),
  ]);
  if (!plan || !clinic) return { error: "Plano não encontrado." };
  if (!clinic.document_cnpj_cpf) return { error: "Preencha o CNPJ ou CPF da clínica em Configurações → Clínica antes de assinar." };

  // O plano novo precisa caber no que a clínica já usa.
  const [{ count: units }, { count: pros }] = await Promise.all([
    supabase.from("units").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("professionals").select("id", { count: "exact", head: true }).eq("active", true),
  ]);
  if (plan.max_units && (units ?? 0) > plan.max_units) return { error: `Este plano permite ${plan.max_units} unidade(s); a clínica tem ${units} ativas.` };
  if (plan.max_professionals && (pros ?? 0) > plan.max_professionals) {
    return { error: `Este plano permite ${plan.max_professionals} profissional(is); a clínica tem ${pros} ativos.` };
  }

  try {
    const description = `${BRAND.name} — plano ${plan.name}`;
    let customerId = clinic.asaas_customer_id;
    if (!customerId) {
      customerId = (
        await createCustomer({
          name: clinic.legal_name ?? clinic.name,
          cpfCnpj: clinic.document_cnpj_cpf,
          email: clinic.email,
          mobilePhone: clinic.phone,
          externalReference: clinic.id,
        })
      ).id;
    }

    let subscriptionId = clinic.asaas_subscription_id;
    if (subscriptionId && clinic.subscription_status !== "canceled") {
      await updateSubscriptionValue(subscriptionId, plan.price_cents / 100, description);
    } else {
      // Primeira cobrança no fim do teste (ou hoje, se o teste já acabou).
      const trialEnd = clinic.trial_ends_at ? clinic.trial_ends_at.slice(0, 10) : todayIso();
      const firstDue = trialEnd > todayIso() ? trialEnd : todayIso();
      subscriptionId = (
        await createSubscription({ customer: customerId, value: plan.price_cents / 100, nextDueDate: firstDue, description, externalReference: clinic.id })
      ).id;
    }

    await admin
      .from("clinics")
      .update({ plan_id: plan.id, asaas_customer_id: customerId, asaas_subscription_id: subscriptionId })
      .eq("id", clinic.id);
    const url = await nextInvoiceUrl(subscriptionId);
    revalidatePath("/", "layout");
    return { url: url ?? undefined, message: url ? undefined : "Assinatura registrada. A fatura chega no e-mail da clínica." };
  } catch (error) {
    return { error: error instanceof Error ? `Asaas: ${error.message}` : "Não foi possível falar com o Asaas." };
  }
}

export async function openInvoice(): Promise<Result> {
  const session = await ownerContext();
  if (!session) return { error: "Só o proprietário da clínica vê as faturas." };
  const { data: clinic } = await createAdminClient().from("clinics").select("asaas_subscription_id").eq("id", session.clinic.id).single();
  if (!clinic?.asaas_subscription_id || !isAsaasConfigured()) return { error: "Nenhuma assinatura ativa." };
  try {
    const url = await nextInvoiceUrl(clinic.asaas_subscription_id);
    return url ? { url } : { message: "Nenhuma fatura em aberto." };
  } catch (error) {
    return { error: error instanceof Error ? `Asaas: ${error.message}` : "Não foi possível abrir a fatura." };
  }
}

export async function cancelClinicSubscription(): Promise<Result> {
  const session = await ownerContext();
  if (!session) return { error: "Só o proprietário pode cancelar." };
  const admin = createAdminClient();
  const { data: clinic } = await admin.from("clinics").select("asaas_subscription_id").eq("id", session.clinic.id).single();
  try {
    if (clinic?.asaas_subscription_id && isAsaasConfigured()) await cancelSubscription(clinic.asaas_subscription_id);
  } catch (error) {
    return { error: error instanceof Error ? `Asaas: ${error.message}` : "Não foi possível cancelar." };
  }
  await admin.from("clinics").update({ subscription_status: "canceled", canceled_at: new Date().toISOString() }).eq("id", session.clinic.id);
  revalidatePath("/", "layout");
  return { message: `Assinatura cancelada. Os dados continuam disponíveis para consulta.` };
}
